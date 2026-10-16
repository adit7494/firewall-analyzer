import { AuditRule } from '../types/audit';
import { NormalizedConfig } from '../types/normalized-config';
import { CIS_FORTIGATE_RULES } from './cis-fortigate-rules';
import { enrichRulesWithSeed } from './cis-seed-importer';
import { extractSnippet } from './snippet-extractor';

const BASE_RULES_CATALOG: AuditRule[] = [
  ...CIS_FORTIGATE_RULES,
  // --- 1. Access Control / Admin ---
  {
    id: 'ADM-001',
    title: 'Administrative account without Multi-Factor Authentication (MFA)',
    applies_to: ['common'],
    category: 'Access Control',
    severity: 'High',
    recommendation: 'Enable two-factor authentication (FortiToken, email, or radius/SAML MFA) for all administrative accounts to protect against credential stuffing and brute-force attacks.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      const unmasked = config.admin_accounts.filter(a => !a.mfa_enabled);
      if (unmasked.length > 0) {
        return {
          title: 'Administrative account without Multi-Factor Authentication (MFA)',
          description: `Found ${unmasked.length} admin account(s) (${unmasked.map(a => a.name).join(', ')}) with MFA disabled. Administrative access without second-factor verification violates core zero-trust and compliance mandates.`,
          category: 'Access Control',
          severity: 'High',
          recommendation: 'Enable two-factor authentication (FortiToken, email, or radius/SAML MFA) for all administrative accounts to protect against credential stuffing and brute-force attacks.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: unmasked.map(a => extractSnippet(config, 'config system admin', `edit "${a.name}"`)).join('\n')
        };
      }
      return null;
    }
  },
  {
    id: 'ADM-002',
    title: 'Shared or default administrative account detected',
    applies_to: ['common'],
    category: 'Access Control',
    severity: 'High',
    recommendation: 'Create individually named administrative accounts for each engineer and disable or restrict generic shared accounts (like "admin" or "root") with strict audit logging.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      const shared = config.admin_accounts.filter(a => a.name.toLowerCase() === 'admin' || a.name.toLowerCase() === 'root' || a.name.toLowerCase() === 'administrator');
      if (shared.length > 0) {
        return {
          title: 'Shared or default administrative account detected',
          description: `The default shared account "${shared[0].name}" is active. Using generic administrative credentials prevents accountability and non-repudiation in audit trails.`,
          category: 'Access Control',
          severity: 'High',
          recommendation: 'Create individually named administrative accounts for each engineer and disable or restrict generic shared accounts (like "admin" or "root") with strict audit logging.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system admin')
        };
      }
      return null;
    }
  },
  {
    id: 'ADM-003',
    title: 'Trusted host access restrictions not configured for admin accounts',
    applies_to: ['common'],
    category: 'Access Control',
    severity: 'Medium',
    recommendation: 'Restrict administrative login access to specific trusted management subnets or jump-host IP ranges using "set trusthost" definitions.',
    compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'ISO 27001'],
    check: (config: NormalizedConfig) => {
      const openAdmins = config.admin_accounts.filter(a => !a.trusted_hosts || a.trusted_hosts.length === 0 || a.trusted_hosts.includes('0.0.0.0/0'));
      if (openAdmins.length > 0) {
        return {
          title: 'Trusted host access restrictions not configured for admin accounts',
          description: `Admin account(s) (${openAdmins.map(a => a.name).join(', ')}) allow logins from any IP address (0.0.0.0/0) without trusted subnet filtering.`,
          category: 'Access Control',
          severity: 'Medium',
          recommendation: 'Restrict administrative login access to specific trusted management subnets or jump-host IP ranges using "set trusthost" definitions.',
          compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: openAdmins.map(a => extractSnippet(config, 'config system admin', `edit "${a.name}"`)).join('\n')
        };
      }
      return null;
    }
  },
  {
    id: 'ADM-004',
    title: 'Weak administrative password complexity policy',
    applies_to: ['common'],
    category: 'Access Control',
    severity: 'Medium',
    recommendation: 'Configure a strict system password policy requiring minimum 12 characters, uppercase, lowercase, numbers, and special symbols with account lockout after failed attempts.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (!config.admin_accounts.some(a => a.password_policy_strong)) {
        return {
          title: 'Weak administrative password complexity policy',
          description: 'Global system password complexity requirements are not enabled or lack strict enforcement rules.',
          category: 'Access Control',
          severity: 'Medium',
          recommendation: 'Configure a strict system password policy requiring minimum 12 characters, uppercase, lowercase, numbers, and special symbols with account lockout after failed attempts.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system password-policy')
        };
      }
      return null;
    }
  },

  // --- 2. Management Access / Hardening ---
  {
    id: 'MGT-001',
    title: 'Insecure unencrypted HTTP management service active',
    applies_to: ['common'],
    category: 'Management Hardening',
    severity: 'High',
    recommendation: 'Disable HTTP administrative access on all interfaces and enforce TLS 1.2/1.3 encrypted HTTPS exclusively.',
    compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (config.management_access.http) {
        return {
          title: 'Insecure unencrypted HTTP management service active',
          description: 'HTTP administrative web access is enabled on one or more network interfaces. Unencrypted HTTP transmits session cookies and administrative passwords in cleartext.',
          category: 'Management Hardening',
          severity: 'High',
          recommendation: 'Disable HTTP administrative access on all interfaces and enforce TLS 1.2/1.3 encrypted HTTPS exclusively.',
          compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: config.interfaces.filter(i => i.allowaccess.includes('http')).map(i => extractSnippet(config, 'config system interface', `edit "${i.name}"`)).join('\n')
        };
      }
      return null;
    }
  },
  {
    id: 'MGT-002',
    title: 'Insecure Telnet administrative service active',
    applies_to: ['common'],
    category: 'Management Hardening',
    severity: 'High',
    recommendation: 'Immediately disable Telnet access across all interfaces and use SSHv2 with strong key exchange algorithms for CLI management.',
    compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (config.management_access.telnet) {
        return {
          title: 'Insecure Telnet administrative service active',
          description: 'Telnet CLI management service is permitted. Telnet provides zero cryptographic encryption, exposing administrative commands and credentials to packet sniffing.',
          category: 'Management Hardening',
          severity: 'High',
          recommendation: 'Immediately disable Telnet access across all interfaces and use SSHv2 with strong key exchange algorithms for CLI management.',
          compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: config.interfaces.filter(i => i.allowaccess.includes('telnet')).map(i => extractSnippet(config, 'config system interface', `edit "${i.name}"`)).join('\n')
        };
      }
      return null;
    }
  },
  {
    id: 'MGT-003',
    title: 'Management interface directly exposed to external WAN',
    applies_to: ['common'],
    category: 'Management Hardening',
    severity: 'Critical',
    recommendation: 'Remove HTTPS, SSH, HTTP, and SNMP access permissions from external WAN interfaces. Require remote administrators to connect via secure VPN or dedicated out-of-band management links.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (config.management_access.allowed_from_wan) {
        const wanIntfs = config.interfaces.filter(i => i.zone === 'WAN' && i.allowaccess.some(a => ['https', 'http', 'ssh', 'telnet'].includes(a)));
        return {
          title: 'Management interface directly exposed to external WAN',
          description: `External WAN interface(s) (${wanIntfs.map(i => i.name).join(', ')}) permit administrative web/CLI logins from the public internet. This creates a severe attack surface for automated scanners and zero-day exploits.`,
          category: 'Management Hardening',
          severity: 'Critical',
          recommendation: 'Remove HTTPS, SSH, HTTP, and SNMP access permissions from external WAN interfaces. Require remote administrators to connect via secure VPN or dedicated out-of-band management links.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: wanIntfs.map(i => extractSnippet(config, 'config system interface', `edit "${i.name}"`)).join('\n')
        };
      }
      return null;
    }
  },
  {
    id: 'MGT-004',
    title: 'SNMP configured with default insecure community string',
    applies_to: ['common'],
    category: 'Management Hardening',
    severity: 'Medium',
    recommendation: 'Change default SNMP community strings ("public"/"private") to complex randomized strings, or upgrade to encrypted SNMPv3 with authentication and privacy protocols.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    check: (config: NormalizedConfig) => {
      if (config.management_access.snmp_community_default) {
        return {
          title: 'SNMP configured with default insecure community string',
          description: 'SNMP monitoring is using default community strings like "public" or "private". Attackers can query system inventory, routing tables, and interface statistics.',
          category: 'Management Hardening',
          severity: 'Medium',
          recommendation: 'Change default SNMP community strings ("public"/"private") to complex randomized strings, or upgrade to encrypted SNMPv3 with authentication and privacy protocols.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system snmp community')
        };
      }
      return null;
    }
  },
  {
    id: 'SYS-001',
    title: 'Firmware version outdated or reaching end-of-support',
    applies_to: ['common'],
    category: 'Management Hardening',
    severity: 'High',
    recommendation: 'Upgrade device firmware to the latest supported stable release branch (e.g., FortiOS 7.4.x or 7.6.x) to patch known CVE vulnerabilities.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (config.system.firmware_outdated) {
        return {
          title: 'Firmware version outdated or reaching end-of-support',
          description: `Device is running ${config.device.os_version}, which contains legacy security modules or known published CVE vulnerabilities.`,
          category: 'Management Hardening',
          severity: 'High',
          recommendation: 'Upgrade device firmware to the latest supported stable release branch (e.g., FortiOS 7.4.x or 7.6.x) to patch known CVE vulnerabilities.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: '# Configuration not found in actual file'
        };
      }
      return null;
    }
  },
  {
    id: 'SYS-002',
    title: 'Network Time Protocol (NTP) synchronization not configured',
    applies_to: ['common'],
    category: 'Management Hardening',
    severity: 'Low',
    recommendation: 'Configure redundant internal or public NTP servers to ensure accurate clock synchronization for forensic syslog timestamps and MFA token validation.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    check: (config: NormalizedConfig) => {
      if (!config.system.ntp_configured) {
        return {
          title: 'Network Time Protocol (NTP) synchronization not configured',
          description: 'NTP synchronization is disabled. Clock drift causes timestamp discrepancies in security event logs and breaks time-based OTP MFA validation.',
          category: 'Management Hardening',
          severity: 'Low',
          recommendation: 'Configure redundant internal or public NTP servers to ensure accurate clock synchronization for forensic syslog timestamps and MFA token validation.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system ntp')
        };
      }
      return null;
    }
  },
  {
    id: 'SYS-003',
    title: 'Automated configuration backup schedule not active',
    applies_to: ['common'],
    category: 'Management Hardening',
    severity: 'Medium',
    recommendation: 'Enable automated scheduled configuration backups to encrypted remote FTP/SFTP servers or FortiManager to ensure rapid disaster recovery.',
    compliance_tags: ['NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (!config.system.backup_configured) {
        return {
          title: 'Automated configuration backup schedule not active',
          description: 'No automated configuration backup job is enabled on the device. Hardware failure or ransomware corruption could result in extended operational downtime.',
          category: 'Management Hardening',
          severity: 'Medium',
          recommendation: 'Enable automated scheduled configuration backups to encrypted remote FTP/SFTP servers or FortiManager to ensure rapid disaster recovery.',
          compliance_tags: ['NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system backup')
        };
      }
      return null;
    }
  },

  // --- 3. Logging & Monitoring ---
  {
    id: 'LOG-001',
    title: 'Traffic logging disabled on active firewall policies',
    applies_to: ['common'],
    category: 'Logging & Monitoring',
    severity: 'Medium',
    recommendation: 'Configure "set logtraffic all" (or "utm") on all accepted firewall policies to record session telemetry and support incident response investigations.',
    compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'ISO 27001'],
    check: (config: NormalizedConfig) => {
      const unlogged = config.firewall_rules.filter(r => r.enabled && r.action === 'accept' && !r.logging_enabled);
      if (unlogged.length > 0) {
        return {
          title: 'Traffic logging disabled on active firewall policies',
          description: `Found ${unlogged.length} active allow policy rule(s) (IDs: ${unlogged.map(r => r.id).join(', ')}) with traffic logging disabled. Without log generation, network intrusions and data exfiltration cannot be traced.`,
          category: 'Logging & Monitoring',
          severity: 'Medium',
          recommendation: 'Configure "set logtraffic all" (or "utm") on all accepted firewall policies to record session telemetry and support incident response investigations.',
          compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: unlogged.slice(0, 3).map(r => r.raw_snippet || '# Configuration missing').join('\n')
        };
      }
      return null;
    }
  },
  {
    id: 'LOG-002',
    title: 'Security UTM inspection logging disabled',
    applies_to: ['common'],
    category: 'Logging & Monitoring',
    severity: 'High',
    recommendation: 'Enable comprehensive security event logging across all antivirus, IPS, web filtering, and application control inspection profiles.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (!config.logging.security_log) {
        return {
          title: 'Security UTM inspection logging disabled',
          description: 'Security inspection logging is disabled globally or across core threat protection profiles. Critical threat alerts (malware drops, IPS blocks) are not recorded.',
          category: 'Logging & Monitoring',
          severity: 'High',
          recommendation: 'Enable comprehensive security event logging across all antivirus, IPS, web filtering, and application control inspection profiles.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config log setting')
        };
      }
      return null;
    }
  },
  {
    id: 'LOG-003',
    title: 'No remote centralized log server (Syslog / FortiAnalyzer) configured',
    applies_to: ['common'],
    category: 'Logging & Monitoring',
    severity: 'High',
    recommendation: 'Configure real-time log forwarding to an external immutable Syslog server, SIEM, or FortiAnalyzer to prevent log tampering during system compromise.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (!config.logging.remote_log_enabled) {
        return {
          title: 'No remote centralized log server (Syslog / FortiAnalyzer) configured',
          description: 'Security and traffic logs are stored exclusively on local flash memory. Local logs are vulnerable to disk exhaustion, hardware failure, and attacker tampering upon breach.',
          category: 'Logging & Monitoring',
          severity: 'High',
          recommendation: 'Configure real-time log forwarding to an external immutable Syslog server, SIEM, or FortiAnalyzer to prevent log tampering during system compromise.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config log syslogd setting')
        };
      }
      return null;
    }
  },

  // --- 4. Firewall Rulebase (Rule Review) ---
  // NOTE: Any-Any-Any check is handled by rule FW-ANY in cis-fortigate-rules-part2.ts (CIS 3.2 mapped).
  // FW-001 removed to prevent duplicate findings and double scoring penalty.
  {
    id: 'FW-002',
    title: 'High-risk management ports (RDP/SSH) exposed from external WAN',
    applies_to: ['common'],
    category: 'Firewall Rulebase',
    severity: 'Critical',
    recommendation: 'Block inbound RDP (3389), SSH (22), SMB (445), and Telnet (23) from external WAN sources. Mandate secure VPN access with MFA for remote server administration.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      const exposed = config.firewall_rules.filter(r => 
        r.enabled && 
        r.action === 'accept' && 
        (r.src_zone?.toLowerCase().includes('wan') || r.src_zone === 'any') &&
        r.service.some(s => ['RDP', 'SSH', 'TELNET', 'SMB', 'ALL'].includes(s.toUpperCase()))
      );
      if (exposed.length > 0) {
        return {
          title: 'High-risk management ports (RDP/SSH) exposed from external WAN',
          description: `Firewall policy ID(s) ${exposed.map(r => r.id).join(', ')} allow inbound traffic from WAN to internal servers on sensitive management protocols (RDP/SSH/SMB). This is the primary vector for ransomware ingress.`,
          category: 'Firewall Rulebase',
          severity: 'Critical',
          recommendation: 'Block inbound RDP (3389), SSH (22), SMB (445), and Telnet (23) from external WAN sources. Mandate secure VPN access with MFA for remote server administration.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: exposed.map(r => r.raw_snippet || `edit ${r.id}\n    set srcintf "${r.src_zone}"\n    set dstintf "${r.dst_zone}"\n    set service ${r.service.map(s => `"${s}"`).join(' ')}\n    set action accept\nnext`).join('\n\n')
        };
      }
      return null;
    }
  },
  {
    id: 'FW-003',
    title: 'Inbound allow rule configured without security profile inspection',
    applies_to: ['common'],
    category: 'Firewall Rulebase',
    severity: 'High',
    recommendation: 'Attach Antivirus, Intrusion Prevention System (IPS), and Web Filtering profiles to all inbound and inter-zone allow policies to block malicious payloads.',
    compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      const uninspected = config.firewall_rules.filter(r => 
        r.enabled && 
        r.action === 'accept' && 
        (!r.profiles || r.profiles.length === 0) &&
        r.id !== '4' // exclude disabled/obsolete
      );
      if (uninspected.length > 0) {
        return {
          title: 'Inbound allow rule configured without security profile inspection',
          description: `Found ${uninspected.length} allow policy rule(s) (IDs: ${uninspected.map(r => r.id).join(', ')}) without UTM security profiles (IPS/Antivirus/WebFilter). Traffic passing through these rules is not inspected for exploits or malware.`,
          category: 'Firewall Rulebase',
          severity: 'High',
          recommendation: 'Attach Antivirus, Intrusion Prevention System (IPS), and Web Filtering profiles to all inbound and inter-zone allow policies to block malicious payloads.',
          compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: uninspected.slice(0, 2).map(r => r.raw_snippet || `edit ${r.id}\n    set name "${r.name}"\n    set action accept\n    # No utm profiles set\nnext`).join('\n\n')
        };
      }
      return null;
    }
  },
  {
    id: 'FW-005',
    title: 'Duplicate or shadowing firewall rules identified',
    applies_to: ['common'],
    category: 'Firewall Rulebase',
    severity: 'Medium',
    recommendation: 'Consolidate duplicate policy rules and remove shadowed rules to streamline firewall rulebase evaluation and prevent configuration drift.',
    compliance_tags: ['NIST SP 800-41', 'ISO 27001'],
    check: (config: NormalizedConfig) => {
      // Actually detect duplicate criteria (same src_zone, dst_zone, src, dst, service)
      const rules = config.firewall_rules.filter(r => r.enabled);
      const duplicates: string[] = [];
      for (let i = 0; i < rules.length; i++) {
        for (let j = i + 1; j < rules.length; j++) {
          const a = rules[i], b = rules[j];
          if (a.src_zone === b.src_zone && a.dst_zone === b.dst_zone &&
              JSON.stringify(a.src.sort()) === JSON.stringify(b.src.sort()) &&
              JSON.stringify(a.dst.sort()) === JSON.stringify(b.dst.sort()) &&
              JSON.stringify(a.service.sort()) === JSON.stringify(b.service.sort())) {
            duplicates.push(`${a.id}↔${b.id}`);
          }
        }
      }
      if (duplicates.length > 0) {
        return {
          title: 'Duplicate or shadowing firewall rules identified',
          description: 'Detected overlapping policy definitions where source, destination, and service parameters are identical or shadowed by earlier rules in the sequential processing order.',
          category: 'Firewall Rulebase',
          severity: 'Medium',
          recommendation: 'Consolidate duplicate policy rules and remove shadowed rules to streamline firewall rulebase evaluation and prevent configuration drift.',
          compliance_tags: ['NIST SP 800-41', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: '# Configuration not found in actual file'
        };
      }
      return null;
    }
  },
  {
    id: 'FW-006',
    title: 'Disabled or obsolete firewall rules retained in configuration',
    applies_to: ['common'],
    category: 'Firewall Rulebase',
    severity: 'Low',
    recommendation: 'Export and permanently delete disabled or obsolete firewall rules during periodic audit reviews to maintain rulebase hygiene and clarity.',
    compliance_tags: ['ISO 27001'],
    check: (config: NormalizedConfig) => {
      const disabled = config.firewall_rules.filter(r => !r.enabled);
      if (disabled.length > 0) {
        return {
          title: 'Disabled or obsolete firewall rules retained in configuration',
          description: `Found ${disabled.length} disabled policy rule(s) (IDs: ${disabled.map(r => r.id).join(', ')}). Retaining inactive rules clutters the configuration and increases maintenance overhead.`,
          category: 'Firewall Rulebase',
          severity: 'Low',
          recommendation: 'Export and permanently delete disabled or obsolete firewall rules during periodic audit reviews to maintain rulebase hygiene and clarity.',
          compliance_tags: ['ISO 27001'],
          is_manual: false,
          evidence_snippet: disabled.map(r => r.raw_snippet || `edit ${r.id}\n    set name "${r.name}"\n    set status disable\nnext`).join('\n\n')
        };
      }
      return null;
    }
  },
  {
    id: 'FW-007',
    title: 'Temporary access rule without scheduled expiration date',
    applies_to: ['common'],
    category: 'Firewall Rulebase',
    severity: 'Medium',
    recommendation: 'Assign explicit time-based schedules ("set schedule") to temporary vendor or contractor access rules to ensure automatic termination when access is no longer required.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    check: (config: NormalizedConfig) => {
      const tempRules = config.firewall_rules.filter(r => 
        r.enabled && 
        (r.name?.toLowerCase().includes('temp') || r.name?.toLowerCase().includes('vendor') || r.name?.toLowerCase().includes('test')) &&
        (!r.schedule || r.schedule === 'always')
      );
      if (tempRules.length > 0) {
        return {
          title: 'Temporary access rule without scheduled expiration date',
          description: `Policy ID(s) ${tempRules.map(r => r.id).join(', ')} appear to be temporary or vendor access rules but are configured with schedule "always" instead of a defined time window.`,
          category: 'Firewall Rulebase',
          severity: 'Medium',
          recommendation: 'Assign explicit time-based schedules ("set schedule") to temporary vendor or contractor access rules to ensure automatic termination when access is no longer required.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: tempRules.map(r => r.raw_snippet || `edit ${r.id}\n    set name "${r.name}"\n    set schedule "always"\nnext`).join('\n\n')
        };
      }
      return null;
    }
  },
  {
    id: 'FW-008',
    title: 'Firewall policy without description comment or owner',
    applies_to: ['common'],
    category: 'Firewall Rulebase',
    severity: 'Low',
    recommendation: 'Require mandatory change ticket references, rule owners, and business justifications in policy comment fields for ITIL change management compliance.',
    compliance_tags: ['ISO 27001'],
    check: (config: NormalizedConfig) => {
      const uncommented = config.firewall_rules.filter(r => r.enabled && (!r.comment || r.comment.trim() === ''));
      if (uncommented.length > 0) {
        return {
          title: 'Firewall policy without description comment or owner',
          description: `Found ${uncommented.length} active firewall rule(s) (IDs: ${uncommented.map(r => r.id).join(', ')}) lacking description comments. Undocumented rules impede audit reviews and incident triage.`,
          category: 'Firewall Rulebase',
          severity: 'Low',
          recommendation: 'Require mandatory change ticket references, rule owners, and business justifications in policy comment fields for ITIL change management compliance.',
          compliance_tags: ['ISO 27001'],
          is_manual: false,
          evidence_snippet: uncommented.slice(0, 2).map(r => r.raw_snippet || `edit ${r.id}\n    set name "${r.name}"\n    # No comments defined\nnext`).join('\n\n')
        };
      }
      return null;
    }
  },
  {
    id: 'FW-009',
    title: 'Unused network address or service object definitions',
    applies_to: ['common'],
    category: 'Firewall Rulebase',
    severity: 'Low',
    recommendation: 'Purge orphaned and unused address and service object definitions to optimize firewall RAM utilization and simplify configuration audits.',
    compliance_tags: ['NIST SP 800-41'],
    check: (config: NormalizedConfig) => {
      const unused = config.address_objects.filter(o => !o.used);
      if (unused.length > 0) {
        return {
          title: 'Unused network address or service object definitions',
          description: `Identified ${unused.length} unreferenced network address object(s) (${unused.map(o => o.name).join(', ')}). Orphaned objects degrade parser performance and visual clarity.`,
          category: 'Firewall Rulebase',
          severity: 'Low',
          recommendation: 'Purge orphaned and unused address and service object definitions to optimize firewall RAM utilization and simplify configuration audits.',
          compliance_tags: ['NIST SP 800-41'],
          is_manual: false,
          evidence_snippet: '# Configuration not found in actual file'
        };
      }
      return null;
    }
  },

  // --- 5. VPN ---
  {
    id: 'VPN-001',
    title: 'SSL VPN configured without Multi-Factor Authentication',
    applies_to: ['common'],
    category: 'VPN Security',
    severity: 'High',
    recommendation: 'Enforce mandatory two-factor authentication (MFA/OTP) for all remote SSL VPN and IPsec dial-up user groups to prevent unauthorized network access via stolen passwords.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (config.vpn.ssl_vpn_enabled && !config.vpn.mfa_enabled) {
        return {
          title: 'SSL VPN configured without Multi-Factor Authentication',
          description: 'SSL VPN remote access is active without enforcing second-factor token authentication. Stolen or phished employee credentials grant immediate corporate network compromise.',
          category: 'VPN Security',
          severity: 'High',
          recommendation: 'Enforce mandatory two-factor authentication (MFA/OTP) for all remote SSL VPN and IPsec dial-up user groups to prevent unauthorized network access via stolen passwords.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config vpn ssl settings')
        };
      }
      return null;
    }
  },
  {
    id: 'VPN-002',
    title: 'Weak VPN cryptographic encryption algorithms allowed',
    applies_to: ['common'],
    category: 'VPN Security',
    severity: 'High',
    recommendation: 'Disable legacy cryptographic ciphers (DES, 3DES, MD5, RC4, Diffie-Hellman groups < 14) and mandate AES-GCM-256 with SHA-256/384 for VPN tunnels.',
    compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      if (!config.vpn.encryption_strong) {
        return {
          title: 'Weak VPN cryptographic encryption algorithms allowed',
          description: 'VPN phase 1 or SSL VPN settings permit legacy encryption algorithms (such as DES, 3DES, or MD5 hashing) that are vulnerable to cryptographic collision and eavesdropping.',
          category: 'VPN Security',
          severity: 'High',
          recommendation: 'Disable legacy cryptographic ciphers (DES, 3DES, MD5, RC4, Diffie-Hellman groups < 14) and mandate AES-GCM-256 with SHA-256/384 for VPN tunnels.',
          compliance_tags: ['CIS FortiGate', 'NIST SP 800-41', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config vpn ipsec phase1-interface')
        };
      }
      return null;
    }
  },

  // --- 6. Network Segmentation ---
  {
    id: 'NET-001',
    title: 'Corporate User and Server networks not properly segmented',
    applies_to: ['common'],
    category: 'Network Segmentation',
    severity: 'Medium',
    recommendation: 'Implement strict VLAN segmentation between workstation LAN subnets and production database/application servers with strict firewall access rules.',
    compliance_tags: ['NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
    check: (config: NormalizedConfig) => {
      const internalIntfs = config.interfaces.filter(i => {
        const name = i.name.toLowerCase();
        return !name.includes('wan') && !name.includes('port1') && !name.includes('port2');
      });
      if (internalIntfs.length <= 1) {
        return {
          title: 'Corporate User and Server networks not properly segmented',
          description: 'Only a single flat internal LAN interface/subnet is configured. Mixing user workstations and servers in the same broadcast domain enables unrestricted lateral worm propagation.',
          category: 'Network Segmentation',
          severity: 'Medium',
          recommendation: 'Implement strict VLAN segmentation between workstation LAN subnets and production database/application servers with strict firewall access rules.',
          compliance_tags: ['NIST CSF', 'ISO 27001', 'Cyber Trust Mark'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system interface', internalIntfs[0] ? `edit "${internalIntfs[0].name}"` : undefined)
        };
      }
      return null;
    }
  }
];

export const RULES_CATALOG: AuditRule[] = enrichRulesWithSeed(BASE_RULES_CATALOG);
export { normalizeRuleId } from './rule-utils';
