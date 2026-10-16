/**
 * AI Block Evaluator
 *
 * Sends extracted configuration blocks to the AI for security analysis.
 * Each block type has a unique, detailed prompt that lists every CIS/custom rule
 * to check for that block — the AI returns an array of findings for failed rules only.
 *
 * One AI call covers ALL rules related to a particular config block type.
 * This is more accurate than rule-by-rule static parsing because:
 *  - AI sees the COMPLETE block (all interfaces, all policies, all admin accounts)
 *  - AI has contextual understanding (e.g. "is this IP a public WAN address?")
 *  - No information is lost due to incomplete regex-based parsing
 */

import { callAI } from './ai-client';
import type { ExtractedBlocks } from './block-extractor';
import type { RuleCategory, Severity, ComplianceStandard } from '../types/audit';

export interface AIFinding {
  rule_id: string;
  title: string;
  status: 'failed' | 'passed';
  severity: Severity;
  category: RuleCategory;
  reason: string;
  evidence: string;
  recommendation: string;
  compliance_tags?: ComplianceStandard[];
  cis_code?: string;
  cis_level?: 'L1' | 'L2';
  cis_section?: string;
}

export interface BlockEvalResult {
  blockType: keyof ExtractedBlocks;
  findings: AIFinding[];
  rawResponse?: string;
  telemetry?: {
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  prompt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared JSON format instruction appended to every prompt
// ─────────────────────────────────────────────────────────────────────────────
const JSON_FORMAT = `
RESPONSE FORMAT — MANDATORY:
Return ONLY valid JSON. You may return either a JSON object with a "findings" array:
{
  "findings": [ ... ]
}
or a JSON array: [ ... ]. Do NOT include any markdown, explanation, or extra text.
Return ONLY findings for rules that FAILED. If a rule passes, omit it.
If ALL rules pass, return: { "findings": [] } or []

Each failed finding must follow this exact schema:
{
  "rule_id": "<rule ID from the list above>",
  "title": "<exact rule title from the list above>",
  "status": "failed",
  "severity": "<Critical|High|Medium|Low|Info>",
  "category": "<category from the rule list>",
  "reason": "<clear explanation of WHY this rule failed based on the config>",
  "evidence": "<exact lines from the config that prove the failure>",
  "recommendation": "<specific actionable remediation step>",
  "cis_code": "<CIS code if applicable, else null>",
  "cis_level": "<L1 or L2 if applicable, else null>"
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// System prompt shared by all block evaluations
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a certified firewall security auditor specializing in CIS FortiGate Benchmark v1.0.1 (FortiOS 7.4.x) compliance assessments. You analyze raw FortiGate configuration blocks and identify security weaknesses, misconfigurations, and compliance violations. You always base your findings strictly on the provided configuration — never assume or infer missing settings. You respond ONLY with valid JSON as instructed.`;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders — one per block type
// ─────────────────────────────────────────────────────────────────────────────

function promptSystemGlobal(block: string): string {
  return `Analyze the FortiGate "config system global" block below and evaluate ALL of the following rules:

RULES TO CHECK:
- CIS-2.1.1 [L1, Low, System Settings]: Pre-Login Banner must be set to "enable". Default is "disable".
- CIS-2.1.2 [L1, Low, System Settings]: Post-Login Banner must be set to "enable". Default is "disable".
- CIS-2.4.4 [L1, Medium, System Settings]: Admin idle timeout (admintimeout) must be 5 minutes or less. Default is 5. Flag if greater than 5.
- CIS-2.1.4 [L1, High, System Settings]: HTTPS redirect must be enabled (https-redirect should NOT be "disable"). HTTP management access should redirect to HTTPS.
- CIS-2.1.9 [L2, Medium, System Settings]: Strong crypto must be enabled (strong-crypto = enable). This enforces TLS 1.2+ and strong cipher suites.
- CIS-2.1.8 [L1, Medium, System Settings]: SSL static key ciphers must be disabled (ssl-static-key-ciphers = disable) to prevent RSA key exchange attacks.
- CIS-2.1.11 [L1, Low, System Settings]: GUI CDN usage should be disabled (gui-cdn-usage = disable) to avoid loading resources from external CDN.
- CIS-2.1.10 [L2, Medium, System Settings]: Admin HTTPS SSL versions should only allow TLS 1.2 and TLS 1.3 (admin-https-ssl-versions = tlsv1-2 tlsv1-3). Flag if tlsv1-0 or tlsv1-1 are included.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptSystemInterface(block: string): string {
  return `Analyze the complete FortiGate "config system interface" block below, which contains ALL network interfaces.

RULES TO CHECK:
- CIS-1.3 [L1, Critical, Network Settings]: No management services (http, https, ssh, telnet, snmp, fmg-access, radius-acct) should be enabled on external WAN-facing interfaces. WAN interfaces are those named "wan", "wan1", "wan2", "internet", "outside", "untrust", or any interface with a public/routable IP address (not RFC1918: not 10.x.x.x, 172.16-31.x.x, 192.168.x.x). List the interface name and the exposed services in your evidence.
- NET-001 [L1, High, Network Settings]: Insecure management protocols (HTTP, Telnet) must not be enabled on interfaces.
- NET-002 [L1, Critical, Network Settings]: If a dedicated management interface exists, it should not be reachable from external zones. Flag if a management interface (named "mgmt", "ha", "management") has an allowaccess setting that includes public-facing services.

CONFIGURATION BLOCK (ALL interfaces):
${block}

${JSON_FORMAT}`;
}

function promptSystemAdmin(block: string): string {
  return `Analyze the complete FortiGate "config system admin" block below, which contains ALL administrator accounts.

RULES TO CHECK:
- CIS-2.4.8 [L1, Critical, Administrators]: The default "admin" account must be renamed. If any account with the username exactly "admin" exists, this is a critical failure.
- CIS-2.4.1 [L1, High, Administrators]: Every administrator account must have explicit trusted host IP restrictions configured (trusthost1, trusthost2, or trusthost3 must be set to a specific IP/subnet — NOT 0.0.0.0 0.0.0.0 and NOT the default wildcard). An account with trusthost1=0.0.0.0 0.0.0.0 or no trusthost set at all is a high-severity finding. List each affected account.
- CIS-2.4.7 [L1, High, Administrators]: Every administrator account must have two-factor authentication enabled (two-factor field must NOT be "disable"). If two-factor is "disable" or not set, this is a finding. List each affected account by username.
- CIS-2.4.3 [L1, Medium, Administrators]: Administrator profiles should use the principle of least privilege. Flag any non-service accounts (not API/automation accounts) using "super_admin" profile except where justified.

CONFIGURATION BLOCK (ALL admin accounts):
${block}

${JSON_FORMAT}`;
}

function promptSystemNtp(block: string): string {
  return `Analyze the FortiGate "config system ntp" block below.

RULES TO CHECK:
- CIS-8.1 [L1, Medium, System Settings]: NTP must be enabled and synchronized (ntpsync = enable). Centralized NTP servers must be configured. NOTE: If "set type fortiguard" is present OR if "set ntpsync enable" is present without any explicitly defined ntpserver block, FortiGate automatically uses default FortiGuard NTP servers. This is acceptable and should NOT fail. Only fail if ntpserver block is explicitly missing AND ntpsync is not enabled, or if it syncs to an unknown/private host without justification.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptSystemDns(block: string): string {
  return `Analyze the FortiGate "config system dns" block below.

RULES TO CHECK:
- CIS-1.1 [L1, Medium, Network Settings]: At least one DNS server must be configured (primary or secondary must be set and not 0.0.0.0). If no DNS servers are configured, this is a failure. DNS servers should be trustworthy (e.g. FortiGuard 96.45.45.45, Cloudflare 1.1.1.1, Google 8.8.8.8, Quad9 9.9.9.9, or internal enterprise DNS).

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptSystemSnmpSysinfo(block: string): string {
  return `Analyze the FortiGate "config system snmp sysinfo" block below.

RULES TO CHECK:
- CIS-3.4 [L1, Medium, SNMP]: SNMP traps should be configured for critical events (trap-free-memory, trap-freeable-memory, etc.).
- CIS-3.1 [L1, High, SNMP]: If SNMP is enabled, the system contact and location fields should be configured (not empty) to identify the device owner and physical location.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptSystemSnmpCommunity(block: string): string {
  return `Analyze the FortiGate "config system snmp community" block below, which lists all SNMP v1/v2c communities.

RULES TO CHECK:
- CIS-3.2 [L1, Critical, SNMP]: SNMP v1/v2c communities must NOT be configured. Any community entry present here means SNMPv1/v2c is in use, which transmits credentials in plaintext. All community entries are a critical finding.
- CIS-3.1 [L1, Critical, SNMP]: The default community string "public" or "private" must never be used. If a community with name "public" or "private" exists, this is a critical finding regardless of other settings.

CONFIGURATION BLOCK (ALL SNMP communities — empty means SNMPv1/v2c not configured):
${block}

${JSON_FORMAT}`;
}

function promptSystemPasswordPolicy(block: string): string {
  return `Analyze the FortiGate "config system password-policy" block below.

RULES TO CHECK:
- CIS-2.2.1 [L1, Medium, Password Policy]: Password policy must be enabled (status = enable). If disabled or not set, this is a failure.
- CIS-2.2.2 [L1, Medium, Password Policy]: Minimum password length must be at least 8 characters (minimum-length >= 8). Recommended is 12 or more.
- CIS-2.3.1 [L1, Medium, Password Policy]: Admin lockout must be configured. The lockout-threshold should be 5 or fewer failed attempts.
- CIS-2.3.2 [L1, Medium, Password Policy]: Admin lockout duration should be configured.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptSystemZone(block: string): string {
  return `Analyze the FortiGate "config system zone" block below, which lists all network security zones.

RULES TO CHECK:
- CIS-1.2 [L1, Medium, Network Settings]: All security zones must have intrazone traffic set to deny (intrazone = deny). The default behavior is "allow", meaning hosts within the same zone can communicate without explicit firewall policy. Any zone with intrazone = allow (or intrazone not set, defaulting to allow) is a finding. List each affected zone name.

CONFIGURATION BLOCK (ALL zones — empty means no custom zones defined):
${block}

${JSON_FORMAT}`;
}

function promptSystemHa(block: string): string {
  return `Analyze the FortiGate "config system ha" block below.

RULES TO CHECK:
- CIS-2.5.1 [L2, Medium, High Availability]: If HA mode is active-passive or active-active, a dedicated out-of-band management interface (mgmt-interface) should be configured for HA heartbeat and management traffic (reserved-mgmt-interface should be set).
- CIS-2.5.4 [L2, Low, High Availability]: HA group password should be set (password field must not be empty) to prevent unauthorized nodes from joining the cluster.
- CIS-2.5.2 [L2, Low, High Availability]: HA session synchronization should be enabled (session-sync-dev should be configured, or sync-config = enable) to ensure stateful failover.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptSystemCsf(block: string): string {
  return `Analyze the FortiGate "config system csf" (Security Fabric) block below.

RULES TO CHECK:
- CIS-5.1.2 [L2, Medium, Security Fabric]: Security Fabric status (status) should be enabled if this device is part of a larger Fortinet ecosystem. If disabled, flag as informational (Info severity) noting that Security Fabric integration is not configured.
- CIS-5.1.1 [L2, Medium, Security Fabric]: Security Fabric group password must be set (group-password must not be empty) when Security Fabric is enabled, to prevent unauthorized fabric members.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptLogFortianalyzer(block: string): string {
  return `Analyze the FortiGate FortiAnalyzer logging configuration block below (may be "config log fortianalyzer setting" or "config log fortianalyzer2 setting").

RULES TO CHECK:
- CIS-7.2.2 [L1, High, Logs & Reports]: FortiAnalyzer logging must be enabled (status = enable). If disabled, logs are not being centrally stored.
- CIS-7.2.3 [L1, High, Logs & Reports]: Log transmission to FortiAnalyzer must be reliable (reliable = enable). Without reliable logging, log entries may be lost during network disruptions.
- CIS-7.2.4 [L2, Medium, Logs & Reports]: Log encryption algorithm should be high (enc-algorithm = high). Using "default" or "low" means logs are transmitted with weaker encryption. "high" enforces AES-256 encryption.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptLogSyslogd(block: string): string {
  return `Analyze the FortiGate syslog logging configuration block below ("config log syslogd setting").

RULES TO CHECK:
- CIS-7.2.1 [L1, High, Logs & Reports]: If FortiAnalyzer is not configured, syslog must be enabled (status = enable) to ensure logs are sent to an external SIEM or log server.
- CIS-7.2.3 [L2, Medium, Logs & Reports]: Syslog should use a reliable transport (reliable = enable uses TCP instead of UDP, preventing log loss).
- CIS-7.2.4 [L2, Medium, Logs & Reports]: Syslog encryption algorithm should use high strength (enc-algorithm = high or AES encryption). "default" or "low" is a finding.

Note: If syslog is disabled AND FortiAnalyzer logging is also not configured, syslog being disabled is a high-severity finding. If FortiAnalyzer IS configured and enabled, syslog being disabled is acceptable (Low severity / informational).

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptFirewallPolicy(block: string): string {
  return `Analyze the complete FortiGate "config firewall policy" block below, which contains ALL firewall policies.

RULES TO CHECK:
- CIS-4.1.2 [L1, High, Security Profiles]: Every "accept" action policy must have an IPS sensor assigned (ips-sensor must be set). Policies with action=accept but no ips-sensor are a finding. List each policy ID and name.
- CIS-4.2.2 [L1, High, Security Profiles]: Every "accept" action policy should have an antivirus profile assigned (av-profile must be set). List each affected policy ID and name.
- CIS-4.3.1 [L1, Medium, Security Profiles]: Every "accept" action policy should have a DNS filter profile assigned (dnsfilter-profile must be set). List each affected policy ID and name.
- CIS-4.4.2 [L1, Medium, Security Profiles]: Every "accept" action policy should have a web filter profile assigned (webfilter-profile must be set). List each affected policy ID and name.
- CIS-4.5.2 [L1, Medium, Security Profiles]: Every "accept" action policy should have an application control profile assigned (application-list must be set). List each affected policy ID and name.
- FW-001 [L1, Critical, Firewall Rulebase]: No policy should be an unrestricted "any-any" rule — meaning srcaddr=all AND dstaddr=all AND service=ALL with action=accept. This is the most permissive possible rule and is a critical finding.
- FW-002 [L1, High, Firewall Rulebase]: All "accept" action policies must have traffic logging enabled (logtraffic must NOT be "disable"). Log all accepted traffic at minimum (logtraffic=all or logtraffic=utm).
- FW-003 [L1, Medium, Firewall Rulebase]: Disabled policies (status = disable) should be reviewed. Flag policies that have been disabled for an unknown period — they represent dead rules that clutter the rulebase.

CONFIGURATION BLOCK (ALL policies — this may be large):
${block}

${JSON_FORMAT}`;
}

function promptFirewallLocalInPolicy(block: string): string {
  return `Analyze the FortiGate "config firewall local-in-policy" block below, which controls traffic destined TO the FortiGate management plane itself.

RULES TO CHECK:
- CIS-1.3 [L1, High, Network Settings]: Local-in policies should restrict management access (HTTPS, SSH) to specific source IP addresses or management subnets. If no local-in policies are defined, management access is controlled only by interface allowaccess settings — flag this as a medium finding, noting that fine-grained local-in restrictions are not in place.
- FW-001 [L1, Critical, Network Settings]: If local-in policies exist, there must be an implicit deny rule (action=deny with srcaddr=all) at the end of the local-in policy list to block all other management access. A missing default-deny in local-in policies means any uncovered traffic reaches the FortiGate.

CONFIGURATION BLOCK (may be empty if not configured):
${block}

${JSON_FORMAT}`;
}

function promptIpsSensor(block: string): string {
  return `Analyze the complete FortiGate "config ips sensor" block below, which contains ALL IPS sensor profiles.

RULES TO CHECK:
- CIS-4.1.1 [L1, High, Security Profiles]: Every IPS sensor must have botnet connection scanning enabled (scan-botnet-connections = block or scan-botnet-connections = monitor). A sensor with this set to "disable" is a finding. List each sensor name.
- CIS-4.1.2 [L1, High, Security Profiles]: IPS sensors should not have an empty entries list (no signature overrides removing all protections). A sensor with all entries deleted and only custom exceptions may be leaving the device unprotected.
- CIS-4.1.3 [L2, Medium, Security Profiles]: IPS sensors should log all detected events (log = enable within entries or at the sensor level). Sensors that block without logging prevent incident investigation.

CONFIGURATION BLOCK (ALL IPS sensor profiles):
${block}

${JSON_FORMAT}`;
}

function promptAntivirusProfile(block: string): string {
  return `Analyze the complete FortiGate "config antivirus profile" block below, which contains ALL antivirus profiles.

RULES TO CHECK:
- CIS-4.2.1 [L1, High, Security Profiles]: Antivirus profiles should have outbreak prevention enabled (outbreak-prevention = block or monitor) to protect against zero-day threats. A profile with outbreak-prevention = disable is a finding.
- CIS-4.2.3 [L1, Medium, Security Profiles]: Machine learning detection should be enabled in antivirus profiles (machine-learning-detection = enable) for advanced threat protection.
- CIS-4.2.6 [L1, Medium, Security Profiles]: Content disarm and reconstruction (CDR) should be enabled in antivirus profiles where Office documents and PDFs are scanned (cdr = enable).
- CIS-4.2.4 [L2, Low, Security Profiles]: Grayware/PUA detection should be enabled (grayware = enable) to detect potentially unwanted applications.

CONFIGURATION BLOCK (ALL antivirus profiles):
${block}

${JSON_FORMAT}`;
}

function promptAntivirusSettings(block: string): string {
  return `Analyze the FortiGate "config antivirus settings" block below (global antivirus settings).

RULES TO CHECK:
- CIS-2.1.7 [L1, High, Security Profiles]: FortiGuard antivirus signature auto-update schedule must be configured. The update schedule should be set to at minimum daily updates (ideally every hour). If no schedule is configured or it is set to a very long interval (weekly), this is a finding.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptDnsfilterProfile(block: string): string {
  return `Analyze the complete FortiGate "config dnsfilter profile" block below, which contains ALL DNS filter profiles.

RULES TO CHECK:
- CIS-4.3.2 [L1, High, Security Profiles]: DNS filter profiles must have botnet domain blocking enabled (redirect-botnet = enable or block). A profile with this disabled allows DNS resolution of known malicious botnet domains.
- CIS-4.3.3 [L2, Low, Security Profiles]: DNS logging of all domains should be enabled (log-all-domain = enable) for forensic visibility. Not logging DNS queries hinders incident investigation.

CONFIGURATION BLOCK (ALL DNS filter profiles):
${block}

${JSON_FORMAT}`;
}

function promptWebfilterProfile(block: string): string {
  return `Analyze the complete FortiGate "config webfilter profile" block below, which contains ALL web filter profiles.

RULES TO CHECK:
- CIS-4.4.1 [L1, High, Security Profiles]: Web filter profiles must block malicious websites. The "web" section should have malicious URL blocking enabled (block-malicious-url = enable or equivalent). A profile that only monitors but does not block known malicious categories is a finding.
- CIS-4.4.2 [L2, Medium, Security Profiles]: FortiGuard category-based filtering should be enabled (fortiguard-wf-status = enable) so that known malicious web categories (hacking, malware, phishing) are blocked.

CONFIGURATION BLOCK (ALL webfilter profiles):
${block}

${JSON_FORMAT}`;
}

function promptApplicationList(block: string): string {
  return `Analyze the complete FortiGate "config application list" block below, which contains ALL application control profiles.

RULES TO CHECK:
- CIS-4.5.1 [L1, High, Security Profiles]: Application control profiles must block high-risk applications. The "entries" section should contain block actions for high-risk application categories (e.g., P2P, proxy, anonymizers, botnet). A profile with no blocked application categories is a finding.
- CIS-4.5.3 [L2, Low, Security Profiles]: Application enforcement of default ports should be enabled (enforce-default-app-port = enable) so that applications are only allowed on their standard ports, preventing port evasion.
- CIS-4.5.4 [L2, Low, Security Profiles]: All application control decisions should be logged (log = all or log = enable within entries) to maintain an audit trail of blocked applications.

CONFIGURATION BLOCK (ALL application control profiles):
${block}

${JSON_FORMAT}`;
}

function promptVpnSslSettings(block: string): string {
  return `Analyze the FortiGate "config vpn ssl settings" block below (SSL-VPN configuration).

CRITICAL RULE: If the block contains "set status disable", it means SSL-VPN is entirely disabled. In this case, it poses no security risk. You MUST return an empty array [] immediately and ignore all other rules.

RULES TO CHECK (Only if status is NOT disabled):
- CIS-6.1.1 [L1, High, VPN]: SSL-VPN must use a valid, non-default server certificate (servercert must NOT be "self-sign" or "Fortinet_Factory"). A self-signed or factory certificate exposes users to MITM attacks.
- CIS-6.1.3 [L1, Critical, VPN]: SSL-VPN must enforce TLS 1.2 as minimum version (ssl-min-proto-ver = tls1-2 or ssl-min-proto-ver = tls1-3). If ssl-min-proto-ver = tls1-0 or ssl-min-proto-ver = tls1-1, this is a critical finding.
- CIS-6.1.4 [L1, Medium, VPN]: SSL-VPN algorithm should use "high" or "AES" cipher suites only (algorithm = high or algorithm = custom with only strong ciphers). The value "default" or "medium" allows weaker ciphers.
- CIS-6.1.2 [L2, Medium, VPN]: SSL-VPN max TLS version should be TLS 1.3 (ssl-max-proto-ver = tls1-3).
- VPN-003 [L2, Medium, VPN]: Two-factor authentication should be required for all SSL-VPN authentication policies. Flag if auth-timeout is set to a very long value.

CONFIGURATION BLOCK:
${block}

${JSON_FORMAT}`;
}

function promptVpnIpsecPhase1(block: string): string {
  return `Analyze the complete FortiGate "config vpn ipsec phase1-interface" block below, which contains ALL IPsec VPN tunnels (Phase 1).

RULES TO CHECK:
- VPN-002 [L1, High, VPN]: IPsec tunnels must use strong IKE encryption. The proposal field must include only strong algorithms: aes128-sha256, aes256-sha256, aes128gcm-prfsha256, aes256gcm-prfsha384. Weak algorithms (des, 3des, md5, sha1) are a finding. List each tunnel name.
- CIS-2.5.3 [L1, High, VPN]: IPsec tunnels must use Diffie-Hellman groups 14 or higher (dhgrp must NOT include group 1, 2, or 5 which are vulnerable). Flag any tunnel using dhgrp 1, 2, or 5.
- VPN-002b [L2, Medium, VPN]: IKEv2 should be preferred over IKEv1 (ike-version = 2). IKEv1 has known weaknesses. List each tunnel still using IKEv1.
- VPN-002c [L1, Medium, VPN]: Dead peer detection (dpd) should be enabled (dpd = on-demand or dpd = on-idle) to detect and clean up dead tunnels automatically.

CONFIGURATION BLOCK (ALL IPsec Phase 1 tunnels):
${block}

${JSON_FORMAT}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block type → prompt builder mapping
// ─────────────────────────────────────────────────────────────────────────────

const PROMPT_BUILDERS: Partial<Record<keyof ExtractedBlocks, (block: string) => string>> = {
  system_global:          promptSystemGlobal,
  system_interface:       promptSystemInterface,
  system_admin:           promptSystemAdmin,
  system_ntp:             promptSystemNtp,
  system_dns:             promptSystemDns,
  system_snmp_sysinfo:    promptSystemSnmpSysinfo,
  system_snmp_community:  promptSystemSnmpCommunity,
  system_password_policy: promptSystemPasswordPolicy,
  system_zone:            promptSystemZone,
  system_ha:              promptSystemHa,
  system_csf:             promptSystemCsf,
  log_fortianalyzer:      promptLogFortianalyzer,
  log_fortianalyzer2:     promptLogFortianalyzer,
  log_syslogd:            promptLogSyslogd,
  firewall_policy:        promptFirewallPolicy,
  firewall_local_in_policy: promptFirewallLocalInPolicy,
  ips_sensor:             promptIpsSensor,
  antivirus_profile:      promptAntivirusProfile,
  antivirus_settings:     promptAntivirusSettings,
  dnsfilter_profile:      promptDnsfilterProfile,
  webfilter_profile:      promptWebfilterProfile,
  application_list:       promptApplicationList,
  vpn_ssl_settings:       promptVpnSslSettings,
  vpn_ipsec_phase1:       promptVpnIpsecPhase1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Main evaluator
// ─────────────────────────────────────────────────────────────────────────────


/**
 * Safely parses and normalizes AI JSON response.
 * Handles:
 *  - Markdown code fences (```json ... ```)
 *  - Top-level arrays: [ ... ]
 *  - Object root with findings array: { "findings": [ ... ] }
 *  - Object root with results or data array: { "results": [ ... ] }
 *  - Single finding object
 *  - Truncated JSON recovery
 */
export function parseAIResponse(raw: string, blockType: string = 'unknown'): AIFinding[] {
  const cleaned = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();

  let rawParsed: any;
  try {
    rawParsed = JSON.parse(cleaned);
  } catch (err) {
    // Auto-repair truncated JSON arrays/objects
    try {
      rawParsed = JSON.parse(cleaned + '}]');
    } catch (err2) {
      try {
        rawParsed = JSON.parse(cleaned + '}');
      } catch (err3) {
        try {
          rawParsed = JSON.parse(cleaned + ']}');
        } catch (err4) {
          throw new Error(
            `AI returned malformed JSON for block "${blockType}". Parse error: ${(err as Error).message}. Raw response: ${raw.slice(0, 500)}`
          );
        }
      }
    }
  }

  let parsed: AIFinding[];
  if (Array.isArray(rawParsed)) {
    parsed = rawParsed;
  } else if (rawParsed && typeof rawParsed === 'object') {
    if (Array.isArray(rawParsed.findings)) {
      parsed = rawParsed.findings;
    } else if (Array.isArray(rawParsed.results)) {
      parsed = rawParsed.results;
    } else if (Array.isArray(rawParsed.data)) {
      parsed = rawParsed.data;
    } else if (Array.isArray(rawParsed.rules)) {
      parsed = rawParsed.rules;
    } else if (Array.isArray(rawParsed.violations)) {
      parsed = rawParsed.violations;
    } else if (Array.isArray(rawParsed.issues)) {
      parsed = rawParsed.issues;
    } else if (Array.isArray(rawParsed[blockType])) {
      parsed = rawParsed[blockType];
    } else if (rawParsed.rule_id) {
      parsed = [rawParsed];
    } else {
      // Check if any property in the object is an array of findings
      const anyArray = Object.values(rawParsed).find(v => Array.isArray(v));
      if (Array.isArray(anyArray)) {
        parsed = anyArray as AIFinding[];
      } else {
        // If the object has no findings array, it typically represents a clean/disabled/passed status
        // (e.g. {} or {"status": "passed"} or {"message": "SSL-VPN disabled"}), so treat as 0 findings.
        parsed = [];
      }
    }
  } else {
    parsed = [];
  }

  return parsed.filter(f => f && f.status === 'failed' && f.rule_id && f.title);
}

export async function evaluateBlock(
  blockType: keyof ExtractedBlocks,
  blockContent: string
): Promise<BlockEvalResult> {
  const buildPrompt = PROMPT_BUILDERS[blockType];
  if (!buildPrompt) {
    // No prompt defined for this block type — skip it
    return { blockType, findings: [] };
  }

  const userPrompt = buildPrompt(blockContent);

  const aiResult = await callAI(SYSTEM_PROMPT, userPrompt);
  const raw = aiResult.content;
  const telemetry = {
    latencyMs: aiResult.latencyMs,
    promptTokens: aiResult.usage?.prompt_tokens,
    completionTokens: aiResult.usage?.completion_tokens,
    totalTokens: aiResult.usage?.total_tokens,
  };

  let failed: AIFinding[];
  try {
    failed = parseAIResponse(raw, blockType as string);
  } catch (err) {
    const error = err as Error;
    (error as any).rawResponse = raw;
    (error as any).telemetry = telemetry;
    throw error;
  }

  return {
    blockType,
    findings: failed,
    rawResponse: raw,
    telemetry,
    prompt: userPrompt,
  };
}

/**
 * Returns the list of block types that have a prompt defined (i.e. will be evaluated).
 */
export function getEvaluatableBlockTypes(): (keyof ExtractedBlocks)[] {
  return Object.keys(PROMPT_BUILDERS) as (keyof ExtractedBlocks)[];
}
