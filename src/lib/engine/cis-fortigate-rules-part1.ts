import { AuditRule } from '../types/audit';
import { NormalizedConfig } from '../types/normalized-config';
import { extractSnippet } from "./snippet-extractor";

export const CIS_FORTIGATE_RULES_PART1: AuditRule[] = [
  // --- Section 1: Network Settings ---
  {
    id: 'CIS-1.1',
    vendor: 'fortigate',
    code: '1.1',
    title: 'Ensure DNS server is configured',
    section: 'Network Settings',
    category: 'Network Settings',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'config system dns',
    expected_value: 'Trusted DNS configured (not left unconfigured)',
    audit_hint: 'config system dns primary/secondary',
    remediation: 'Set primary and secondary DNS servers to trusted internal or secure public resolvers.',
    default_value: '96.45.45.45',
    cis_controls: ['v8 8.9', 'v7 6.3'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure trusted DNS servers (enterprise DNS, FortiGuard DNS, or secure public resolvers like Cloudflare 1.1.1.1 or Google 8.8.8.8).',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      // Only flag if DNS is truly unconfigured (no servers at all)
      // FortiGuard DNS (96.45.45.45/96.45.46.46) is a legitimate secure DNS service from Fortinet
      if (!config.system.dns_servers || config.system.dns_servers.length === 0) {
        return {
          title: 'Ensure DNS server is configured',
          description: 'No DNS servers are configured on this device. DNS resolution is required for FortiGuard updates, certificate validation, and FQDN-based firewall policies.',
          category: 'Network Settings',
          severity: 'Medium',
          recommendation: 'Configure trusted DNS servers (enterprise DNS, FortiGuard DNS, or secure public resolvers like Cloudflare 1.1.1.1 or Google 8.8.8.8).',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system dns'),
          system_check: 'auto',
          cis_code: '1.1',
          cis_level: 'L1',
          cis_section: 'Network Settings',
          config_key: 'config system dns',
          expected_value: 'Trusted DNS configured (not left unconfigured)',
          audit_hint: 'config system dns primary/secondary',
          remediation: 'Set primary and secondary DNS servers to trusted internal or secure public resolvers.',
          default_value: 'None',
          cis_controls: ['v8 8.9', 'v7 6.3']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-1.2',
    vendor: 'fortigate',
    code: '1.2',
    title: 'Ensure intra-zone traffic is not always allowed',
    section: 'Network Settings',
    category: 'Network Settings',
    cis_level: 'L1',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'Medium',
    config_key: 'config system zone',
    expected_value: 'intrazone=deny on relevant zones',
    audit_hint: 'config system zone intrazone',
    remediation: 'Set intrazone to deny on all defined security zones unless explicitly required.',
    default_value: 'allow',
    cis_controls: ['v8 12.2', 'v7 14.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Disable automatic intra-zone traffic allowing to enforce explicit firewall policy verification.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.zones || config.zones.length === 0) {
        return null;
      }
      const openZones = config.zones.filter(z => !z.intrazone_deny);
      if (openZones.length > 0) {
        return {
          title: 'Ensure intra-zone traffic is not always allowed',
          description: `Found ${openZones.length} zone(s) allowing intra-zone traffic without explicit rules. Requires auditor review.`,
          category: 'Network Settings',
          severity: 'Medium',
          recommendation: 'Disable automatic intra-zone traffic allowing to enforce explicit firewall policy verification.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: '# Configuration not found in actual file',
          system_check: 'semi',
          cis_code: '1.2',
          cis_level: 'L1',
          cis_section: 'Network Settings',
          config_key: 'config system zone',
          expected_value: 'intrazone=deny on relevant zones',
          audit_hint: 'config system zone intrazone',
          remediation: 'Set intrazone to deny on all defined security zones unless explicitly required.',
          default_value: 'allow',
          cis_controls: ['v8 12.2', 'v7 14.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-1.3',
    vendor: 'fortigate',
    code: '1.3',
    title: 'Disable all management services on WAN port',
    section: 'Network Settings',
    category: 'Network Settings',
    cis_level: 'L1',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'Critical',
    config_key: 'system interface allowaccess (WAN)',
    expected_value: 'No http/https/ping/ssh/snmp/radius-acct on WAN interfaces',
    audit_hint: 'config system interface -> edit wan -> set allowaccess',
    remediation: 'Remove administrative protocols (http, https, ssh, telnet, snmp) from external WAN interfaces.',
    default_value: 'ping https ssh',
    cis_controls: ['v8 4.4', 'v7 4.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Remove all management protocols from external WAN interfaces immediately to eliminate public administrative exposure.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const wanExposed = config.interfaces.filter(i => i.zone === 'WAN' && i.allowaccess && i.allowaccess.some(a => ['http', 'https', 'ssh', 'telnet', 'snmp'].includes(a.toLowerCase())));
      if (wanExposed.length > 0 || config.management_access.allowed_from_wan) {
        return {
          title: 'Disable all management services on WAN port',
          description: `WAN interface(s) (${wanExposed.map(i => i.name).join(', ') || 'WAN'}) have administrative services enabled on public interfaces.`,
          category: 'Network Settings',
          severity: 'Critical',
          recommendation: 'Remove all management protocols from external WAN interfaces immediately to eliminate public administrative exposure.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: wanExposed.map(i => `config system interface\n    edit "${i.name}"\n        set allowaccess ${i.allowaccess.join(' ')}\n    next`).join('\n') || 'set allowaccess https ssh http',
          system_check: 'semi',
          cis_code: '1.3',
          cis_level: 'L1',
          cis_section: 'Network Settings',
          config_key: 'system interface allowaccess (WAN)',
          expected_value: 'No http/https/ping/ssh/snmp/radius-acct on WAN interfaces',
          audit_hint: 'config system interface -> edit wan -> set allowaccess',
          remediation: 'Remove administrative protocols (http, https, ssh, telnet, snmp) from external WAN interfaces.',
          default_value: 'ping https ssh',
          cis_controls: ['v8 4.4', 'v7 4.5']
        };
      }
      return null;
    }
  },

  // --- Section 2.1: System > General Settings ---
  {
    id: 'CIS-2.1.1',
    vendor: 'fortigate',
    code: '2.1.1',
    title: "Ensure 'Pre-Login Banner' is set",
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system global pre-login-banner',
    expected_value: 'enable',
    audit_hint: 'config system global -> set pre-login-banner enable',
    remediation: 'Enable pre-login-banner and set appropriate legal warning message.',
    default_value: 'disable',
    cis_controls: ['v8 3.3', 'v7 5.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable pre-login banner displaying legal notice and unauthorized access warnings.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.pre_login_banner_enabled) {
        return {
          title: "Ensure 'Pre-Login Banner' is set",
          description: 'Pre-login banner is disabled. Legal notices are required prior to authentication for accountability and legal compliance.',
          category: 'System Settings',
          severity: 'Low',
          recommendation: 'Enable pre-login banner displaying legal notice and unauthorized access warnings.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.1',
          cis_level: 'L1',
          cis_section: 'System Settings > General',
          config_key: 'system global pre-login-banner',
          expected_value: 'enable',
          audit_hint: 'config system global -> set pre-login-banner enable',
          remediation: 'Enable pre-login-banner and set appropriate legal warning message.',
          default_value: 'disable',
          cis_controls: ['v8 3.3', 'v7 5.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.2',
    vendor: 'fortigate',
    code: '2.1.2',
    title: "Ensure 'Post-Login-Banner' is set",
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system global post-login-banner',
    expected_value: 'enable',
    audit_hint: 'config system global -> set post-login-banner enable',
    remediation: 'Enable post-login-banner to notify administrators upon successful login.',
    default_value: 'disable',
    cis_controls: ['v8 3.3', 'v7 5.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable post-login banner to remind authenticated users of monitoring policies.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.post_login_banner_enabled) {
        return {
          title: "Ensure 'Post-Login-Banner' is set",
          description: 'Post-login banner is not enabled in global system settings.',
          category: 'System Settings',
          severity: 'Low',
          recommendation: 'Enable post-login banner to remind authenticated users of monitoring policies.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.2',
          cis_level: 'L1',
          cis_section: 'System Settings > General',
          config_key: 'system global post-login-banner',
          expected_value: 'enable',
          audit_hint: 'config system global -> set post-login-banner enable',
          remediation: 'Enable post-login-banner to notify administrators upon successful login.',
          default_value: 'disable',
          cis_controls: ['v8 3.3', 'v7 5.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.3',
    vendor: 'fortigate',
    code: '2.1.3',
    title: 'Ensure timezone is properly configured',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system global timezone',
    expected_value: 'Matches device location (not default GMT-8)',
    audit_hint: 'config system global -> set timezone <id>',
    remediation: 'Set timezone ID corresponding to actual geographic location.',
    default_value: '01 (GMT-8)',
    cis_controls: ['v8 8.8', 'v7 6.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure accurate local timezone to ensure precise correlation of security event timestamps.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.system.timezone === '01' || config.system.timezone === '00' || !config.system.timezone) {
        return {
          title: 'Ensure timezone is properly configured',
          description: `Default or unverified timezone detected (${config.system.timezone || 'default GMT-8'}). Accurate timestamps are critical for incident correlation.`,
          category: 'System Settings',
          severity: 'Low',
          recommendation: 'Configure accurate local timezone to ensure precise correlation of security event timestamps.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.3',
          cis_level: 'L1',
          cis_section: 'System Settings > General',
          config_key: 'system global timezone',
          expected_value: 'Matches device location (not default GMT-8)',
          audit_hint: 'config system global -> set timezone <id>',
          remediation: 'Set timezone ID corresponding to actual geographic location.',
          default_value: '01 (GMT-8)',
          cis_controls: ['v8 8.8', 'v7 6.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.4',
    vendor: 'fortigate',
    code: '2.1.4',
    title: 'Ensure correct system time via NTP',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L1',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'Medium',
    config_key: 'config system ntp',
    expected_value: 'Trusted NTP server configured',
    audit_hint: 'config system ntp -> set type custom/fortinet',
    remediation: 'Enable NTP synchronization and specify reliable NTP servers.',
    default_value: 'fortinet ntp',
    cis_controls: ['v8 8.8', 'v7 6.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Synchronize system clock with trusted NTP servers for forensic readiness.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.ntp_configured || !config.system.ntp_server) {
        return {
          title: 'Ensure correct system time via NTP',
          description: 'NTP synchronization is not explicitly configured or requires auditor confirmation of time server reliability.',
          category: 'System Settings',
          severity: 'Medium',
          recommendation: 'Synchronize system clock with trusted NTP servers for forensic readiness.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system ntp'),
          system_check: 'semi',
          cis_code: '2.1.4',
          cis_level: 'L1',
          cis_section: 'System Settings > General',
          config_key: 'config system ntp',
          expected_value: 'Trusted NTP server configured',
          audit_hint: 'config system ntp -> set type custom/fortinet',
          remediation: 'Enable NTP synchronization and specify reliable NTP servers.',
          default_value: 'fortinet ntp',
          cis_controls: ['v8 8.8', 'v7 6.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.5',
    vendor: 'fortigate',
    code: '2.1.5',
    title: 'Ensure hostname is set',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system global hostname',
    expected_value: 'Custom hostname set (not factory default model number)',
    audit_hint: 'config system global -> set hostname <name>',
    remediation: 'Set a descriptive hostname adhering to enterprise naming conventions.',
    default_value: 'FortiGate-60F',
    cis_controls: ['v8 1.1', 'v7 1.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Assign a unique, descriptive hostname to identify the firewall in syslog and monitoring tools.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const h = config.device.hostname.toLowerCase();
      // Only flag truly default hostnames, NOT custom ones like FGT-EVT-Batam
      const defaultHostnames = ['fgt-device', 'fortigate', 'localhost', ''];
      const isDefault = !h || defaultHostnames.includes(h) || /^fortigate-\d+[a-z]?$/i.test(h) || /^fgt\d+[a-z]?$/i.test(h);
      if (isDefault) {
        return {
          title: 'Ensure hostname is set',
          description: `Default or non-descriptive hostname detected ("${config.device.hostname}"). Unique identification is necessary in multi-device environments.`,
          category: 'System Settings',
          severity: 'Low',
          recommendation: 'Assign a unique, descriptive hostname to identify the firewall in syslog and monitoring tools.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.5',
          cis_level: 'L1',
          cis_section: 'System Settings > General',
          config_key: 'system global hostname',
          expected_value: 'Custom hostname set (not factory default model number)',
          audit_hint: 'config system global -> set hostname <name>',
          remediation: 'Set a descriptive hostname adhering to enterprise naming conventions.',
          default_value: 'FortiGate-60F',
          cis_controls: ['v8 1.1', 'v7 1.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.6',
    vendor: 'fortigate',
    code: '2.1.6',
    title: 'Ensure the latest firmware is installed',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'manual',
    severity: 'High',
    config_key: 'get system status Version',
    expected_value: 'Compare against Fortinet PSIRT advisories / upgrade-tool (external verification)',
    audit_hint: 'get system status -> check firmware release notes',
    remediation: 'Upgrade FortiOS firmware to the latest supported patch release.',
    default_value: 'current release',
    cis_controls: ['v8 7.1', 'v7 3.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Verify and maintain current stable firmware release to mitigate known PSIRT vulnerabilities.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.system.firmware_outdated) {
        return {
          title: 'Ensure the latest firmware is installed',
          description: `Firmware version "${config.device.os_version}" may be outdated or require manual PSIRT verification against latest Fortinet advisories.`,
          category: 'System Settings',
          severity: 'High',
          recommendation: 'Verify and maintain current stable firmware release to mitigate known PSIRT vulnerabilities.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: true,
          evidence_snippet: '# Configuration not found in actual file',
          system_check: 'manual',
          cis_code: '2.1.6',
          cis_level: 'L2',
          cis_section: 'System Settings > General',
          config_key: 'get system status Version',
          expected_value: 'Compare against Fortinet PSIRT advisories / upgrade-tool (external verification)',
          audit_hint: 'get system status -> check firmware release notes',
          remediation: 'Upgrade FortiOS firmware to the latest supported patch release.',
          default_value: 'current release',
          cis_controls: ['v8 7.1', 'v7 3.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.7',
    vendor: 'fortigate',
    code: '2.1.7',
    title: 'Disable USB firmware & config installation',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system auto-install',
    expected_value: 'auto-install-config & image = disable',
    audit_hint: 'config system auto-install -> set auto-install-config disable',
    remediation: 'Disable USB auto-install directives to prevent unauthorized local configuration injection.',
    default_value: 'enable',
    cis_controls: ['v8 4.1', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Disable automatic installation of firmware and configuration from USB devices.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.usb_auto_install_disabled) {
        return {
          title: 'Disable USB firmware & config installation',
          description: 'USB auto-install for config or firmware is enabled. Physical access could allow unauthorized configuration override.',
          category: 'System Settings',
          severity: 'Medium',
          recommendation: 'Disable automatic installation of firmware and configuration from USB devices.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system auto-install'),
          system_check: 'auto',
          cis_code: '2.1.7',
          cis_level: 'L2',
          cis_section: 'System Settings > General',
          config_key: 'system auto-install',
          expected_value: 'auto-install-config & image = disable',
          audit_hint: 'config system auto-install -> set auto-install-config disable',
          remediation: 'Disable USB auto-install directives to prevent unauthorized local configuration injection.',
          default_value: 'enable',
          cis_controls: ['v8 4.1', 'v7 8.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.8',
    vendor: 'fortigate',
    code: '2.1.8',
    title: 'Disable static keys for TLS',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system global ssl-static-key-ciphers',
    expected_value: 'disable',
    audit_hint: 'config system global -> set ssl-static-key-ciphers disable',
    remediation: 'Disable static key ciphers to enforce Perfect Forward Secrecy (PFS).',
    default_value: 'enable',
    cis_controls: ['v8 3.10', 'v7 14.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Disable static key SSL/TLS ciphers to enforce Perfect Forward Secrecy across administrative web interfaces.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.ssl_static_key_ciphers_disabled) {
        return {
          title: 'Disable static keys for TLS',
          description: 'Static key SSL/TLS ciphers are permitted, allowing potential decryption of recorded sessions without Perfect Forward Secrecy.',
          category: 'System Settings',
          severity: 'Medium',
          recommendation: 'Disable static key SSL/TLS ciphers to enforce Perfect Forward Secrecy across administrative web interfaces.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.8',
          cis_level: 'L2',
          cis_section: 'System Settings > General',
          config_key: 'system global ssl-static-key-ciphers',
          expected_value: 'disable',
          audit_hint: 'config system global -> set ssl-static-key-ciphers disable',
          remediation: 'Disable static key ciphers to enforce Perfect Forward Secrecy (PFS).',
          default_value: 'enable',
          cis_controls: ['v8 3.10', 'v7 14.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.9',
    vendor: 'fortigate',
    code: '2.1.9',
    title: 'Enable Global Strong Encryption',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'system global strong-crypto',
    expected_value: 'enable',
    audit_hint: 'config system global -> set strong-crypto enable',
    remediation: 'Enable strong-crypto to disallow weak ciphers globally.',
    default_value: 'enable (varies by OS)',
    cis_controls: ['v8 3.10', 'v7 14.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable global strong encryption to eliminate deprecated cryptographic algorithms (DES, 3DES, RC4, MD5).',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.strong_crypto_enabled) {
        return {
          title: 'Enable Global Strong Encryption',
          description: 'Global strong encryption is disabled. Weak cryptographic algorithms could be negotiated during TLS/VPN sessions.',
          category: 'System Settings',
          severity: 'High',
          recommendation: 'Enable global strong encryption to eliminate deprecated cryptographic algorithms (DES, 3DES, RC4, MD5).',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.9',
          cis_level: 'L2',
          cis_section: 'System Settings > General',
          config_key: 'system global strong-crypto',
          expected_value: 'enable',
          audit_hint: 'config system global -> set strong-crypto enable',
          remediation: 'Enable strong-crypto to disallow weak ciphers globally.',
          default_value: 'enable (varies by OS)',
          cis_controls: ['v8 3.10', 'v7 14.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.10',
    vendor: 'fortigate',
    code: '2.1.10',
    title: 'Mgmt GUI on secure TLS version',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'system global admin-https-ssl-versions',
    expected_value: 'tlsv1-3 (min tls1-2)',
    audit_hint: 'config system global -> set admin-https-ssl-versions tlsv1-3 tlsv1-2',
    remediation: 'Configure admin HTTPS SSL versions to allow only TLS 1.2 and TLS 1.3.',
    default_value: 'tlsv1-2 tlsv1-3',
    cis_controls: ['v8 3.10', 'v7 14.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enforce modern TLS 1.2 and TLS 1.3 protocols exclusively for web GUI administrative management.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const v = config.system.admin_https_ssl_versions || ['tlsv1-2', 'tlsv1-3'];
      if (v.some(ver => ['tlsv1-0', 'tlsv1-1', 'ssl-3-0'].includes(ver.toLowerCase()))) {
        return {
          title: 'Mgmt GUI on secure TLS version',
          description: `Deprecated TLS version(s) permitted for management GUI (${v.join(', ')}).`,
          category: 'System Settings',
          severity: 'High',
          recommendation: 'Enforce modern TLS 1.2 and TLS 1.3 protocols exclusively for web GUI administrative management.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.10',
          cis_level: 'L1',
          cis_section: 'System Settings > General',
          config_key: 'system global admin-https-ssl-versions',
          expected_value: 'tlsv1-3 (min tls1-2)',
          audit_hint: 'config system global -> set admin-https-ssl-versions tlsv1-3 tlsv1-2',
          remediation: 'Configure admin HTTPS SSL versions to allow only TLS 1.2 and TLS 1.3.',
          default_value: 'tlsv1-2 tlsv1-3',
          cis_controls: ['v8 3.10', 'v7 14.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.11',
    vendor: 'fortigate',
    code: '2.1.11',
    title: 'Ensure CDN enabled for GUI performance',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system global gui-cdn-usage',
    expected_value: 'enable (not security/informational control)',
    audit_hint: 'config system global -> set gui-cdn-usage enable',
    remediation: 'Enable gui-cdn-usage to optimize web UI responsiveness.',
    default_value: 'enable',
    cis_controls: ['v8 2.1', 'v7 2.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable GUI CDN usage to improve management interface asset loading speed.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.gui_cdn_usage_enabled) {
        return {
          title: 'Ensure CDN enabled for GUI performance',
          description: 'GUI CDN usage is disabled, which may degrade management console responsiveness over remote connections.',
          category: 'System Settings',
          severity: 'Low',
          recommendation: 'Enable GUI CDN usage to improve management interface asset loading speed.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.11',
          cis_level: 'L2',
          cis_section: 'System Settings > General',
          config_key: 'system global gui-cdn-usage',
          expected_value: 'enable (not security/informational control)',
          audit_hint: 'config system global -> set gui-cdn-usage enable',
          remediation: 'Enable gui-cdn-usage to optimize web UI responsiveness.',
          default_value: 'enable',
          cis_controls: ['v8 2.1', 'v7 2.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.12',
    vendor: 'fortigate',
    code: '2.1.12',
    title: 'Single CPU core overload logged',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system global log-single-cpu-high',
    expected_value: 'enable',
    audit_hint: 'config system global -> set log-single-cpu-high enable',
    remediation: 'Enable logging for high single Core CPU utilization.',
    default_value: 'disable',
    cis_controls: ['v8 8.2', 'v7 6.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable event logging for single CPU core high utilization to detect denial of service or traffic anomalies.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.log_single_cpu_high_enabled) {
        return {
          title: 'Single CPU core overload logged',
          description: 'Single CPU high utilization logging is disabled. Early warning of CPU exhaustion attacks may be missed.',
          category: 'System Settings',
          severity: 'Low',
          recommendation: 'Enable event logging for single CPU core high utilization to detect denial of service or traffic anomalies.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.12',
          cis_level: 'L1',
          cis_section: 'System Settings > General',
          config_key: 'system global log-single-cpu-high',
          expected_value: 'enable',
          audit_hint: 'config system global -> set log-single-cpu-high enable',
          remediation: 'Enable logging for high single Core CPU utilization.',
          default_value: 'disable',
          cis_controls: ['v8 8.2', 'v7 6.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.1.13',
    vendor: 'fortigate',
    code: '2.1.13',
    title: 'Hostname not displayed on login GUI',
    section: 'System Settings > General',
    category: 'System Settings',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system global gui-display-hostname',
    expected_value: 'disable',
    audit_hint: 'config system global -> set gui-display-hostname disable',
    remediation: 'Disable displaying hostname on login GUI to prevent information disclosure.',
    default_value: 'enable',
    cis_controls: ['v8 4.1', 'v7 1.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Disable displaying the device hostname on the pre-authentication web login screen to avoid reconnaissance leakage.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.gui_display_hostname_disabled) {
        return {
          title: 'Hostname not displayed on login GUI',
          description: 'System hostname is displayed on the login page before authentication, exposing internal naming structure.',
          category: 'System Settings',
          severity: 'Low',
          recommendation: 'Disable displaying the device hostname on the pre-authentication web login screen to avoid reconnaissance leakage.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.1.13',
          cis_level: 'L2',
          cis_section: 'System Settings > General',
          config_key: 'system global gui-display-hostname',
          expected_value: 'disable',
          audit_hint: 'config system global -> set gui-display-hostname disable',
          remediation: 'Disable displaying hostname on login GUI to prevent information disclosure.',
          default_value: 'enable',
          cis_controls: ['v8 4.1', 'v7 1.1']
        };
      }
      return null;
    }
  },

  // --- Section 2.2: Password Policy ---
  {
    id: 'CIS-2.2.1',
    vendor: 'fortigate',
    code: '2.2.1',
    title: "Ensure 'Password Policy' is enabled",
    section: 'Password Policy',
    category: 'Password Policy',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'system password-policy',
    expected_value: 'status enable, min-length >= 14 characters, scope both',
    audit_hint: 'config system password-policy -> set status enable, set min-length 14',
    remediation: 'Enable global password policy with minimum length 14 characters applying to all administrative users.',
    default_value: 'disable',
    cis_controls: ['v8 5.2', 'v7 4.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enforce a robust password policy requiring minimum 14 characters and complexity rules for all admin accounts.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const p = config.password_policy || { enabled: false, min_length: 8 };
      if (!p.enabled || p.min_length < 14) {
        return {
          title: "Ensure 'Password Policy' is enabled",
          description: `Password policy is disabled or minimum length (${p.min_length}) is below CIS requirement (14 characters).`,
          category: 'Password Policy',
          severity: 'High',
          recommendation: 'Enforce a robust password policy requiring minimum 14 characters and complexity rules for all admin accounts.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system password-policy'),
          system_check: 'auto',
          cis_code: '2.2.1',
          cis_level: 'L1',
          cis_section: 'Password Policy',
          config_key: 'system password-policy',
          expected_value: 'status enable, min-length >= 14 characters, scope both',
          audit_hint: 'config system password-policy -> set status enable, set min-length 14',
          remediation: 'Enable global password policy with minimum length 14 characters applying to all administrative users.',
          default_value: 'disable',
          cis_controls: ['v8 5.2', 'v7 4.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.2.2',
    vendor: 'fortigate',
    code: '2.2.2',
    title: 'Admin password retries & lockout configured',
    section: 'Password Policy',
    category: 'Password Policy',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system global lockout-threshold/duration',
    expected_value: 'threshold<=3, duration<=900',
    audit_hint: 'config system global -> set admin-lockout-threshold 3, set admin-lockout-duration 900',
    remediation: 'Configure account lockout after maximum 3 failed login attempts for at least 900 seconds (15 min).',
    default_value: 'threshold 3, duration 60',
    cis_controls: ['v8 5.3', 'v7 4.3'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure administrative lockout threshold (<=3 retries) and lockout duration (>=900s) to prevent brute-force attacks.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const th = config.system.admin_lockout_threshold ?? 3;
      const dur = config.system.admin_lockout_duration ?? 60;
      if (th > 3 || dur < 900) {
        return {
          title: 'Admin password retries & lockout configured',
          description: `Lockout threshold (${th}) or duration (${dur}s) fails CIS benchmark criteria (threshold <= 3, duration >= 900s).`,
          category: 'Password Policy',
          severity: 'Medium',
          recommendation: 'Configure administrative lockout threshold (<=3 retries) and lockout duration (>=900s) to prevent brute-force attacks.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.2.2',
          cis_level: 'L1',
          cis_section: 'Password Policy',
          config_key: 'system global lockout-threshold/duration',
          expected_value: 'threshold<=3, duration<=900',
          audit_hint: 'config system global -> set admin-lockout-threshold 3, set admin-lockout-duration 900',
          remediation: 'Configure account lockout after maximum 3 failed login attempts for at least 900 seconds (15 min).',
          default_value: 'threshold 3, duration 60',
          cis_controls: ['v8 5.3', 'v7 4.3']
        };
      }
      return null;
    }
  },

  // --- Section 2.3: SNMP ---
  {
    id: 'CIS-2.3.1',
    vendor: 'fortigate',
    code: '2.3.1',
    title: 'Ensure only SNMPv3 is enabled',
    section: 'SNMP',
    category: 'SNMP',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system snmp community/user',
    expected_value: 'No v1/v2c community strings; only v3 users',
    audit_hint: 'config system snmp community -> delete all v1/v2c communities',
    remediation: 'Remove all SNMPv1 and SNMPv2c community strings. Use SNMPv3 with authPriv for encrypted monitoring.',
    default_value: 'disabled',
    cis_controls: ['v8 4.4', 'v7 4.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Eliminate unencrypted SNMPv1/v2c community strings and enforce encrypted SNMPv3 (authPriv) exclusively.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.snmp?.v1_v2c_enabled || config.management_access.snmp_community_default) {
        return {
          title: 'Ensure only SNMPv3 is enabled',
          description: 'SNMPv1/v2c community strings detected. Unencrypted SNMP transmits system metrics and community strings in cleartext.',
          category: 'SNMP',
          severity: 'Medium',
          recommendation: 'Eliminate unencrypted SNMPv1/v2c community strings and enforce encrypted SNMPv3 (authPriv) exclusively.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system snmp community'),
          system_check: 'auto',
          cis_code: '2.3.1',
          cis_level: 'L1',
          cis_section: 'SNMP',
          config_key: 'system snmp community/user',
          expected_value: 'No v1/v2c community strings; only v3 users',
          audit_hint: 'config system snmp community -> delete all v1/v2c communities',
          remediation: 'Remove all SNMPv1 and SNMPv2c community strings. Use SNMPv3 with authPriv for encrypted monitoring.',
          default_value: 'disabled',
          cis_controls: ['v8 4.4', 'v7 4.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.3.2',
    vendor: 'fortigate',
    code: '2.3.2',
    title: 'Allow only trusted hosts in SNMPv3',
    section: 'SNMP',
    category: 'SNMP',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'snmp user notify-hosts',
    expected_value: 'Specific IP addresses only, no 0.0.0.0 wildcards',
    audit_hint: 'config system snmp user -> edit <user> -> set notify-hosts <ip>',
    remediation: 'Restrict SNMPv3 user access to specific authorized NMS/monitoring server IP addresses.',
    default_value: '0.0.0.0/0',
    cis_controls: ['v8 4.4', 'v7 4.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure strict trusted host IP restrictions on all SNMPv3 user accounts.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      const openV3 = config.snmp?.v3_users?.filter(u => !u.notify_hosts || u.notify_hosts.length === 0 || u.notify_hosts.includes('0.0.0.0/0')) || [];
      if (openV3.length > 0) {
        return {
          title: 'Allow only trusted hosts in SNMPv3',
          description: `SNMPv3 user(s) (${openV3.map(u => u.name).join(', ') || 'user'}) allow queries or traps from unrestricted IP addresses (0.0.0.0/0).`,
          category: 'SNMP',
          severity: 'Medium',
          recommendation: 'Configure strict trusted host IP restrictions on all SNMPv3 user accounts.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: '# Configuration not found in actual file',
          system_check: 'auto',
          cis_code: '2.3.2',
          cis_level: 'L2',
          cis_section: 'SNMP',
          config_key: 'snmp user notify-hosts',
          expected_value: 'Specific IP addresses only, no 0.0.0.0 wildcards',
          audit_hint: 'config system snmp user -> edit <user> -> set notify-hosts <ip>',
          remediation: 'Restrict SNMPv3 user access to specific authorized NMS/monitoring server IP addresses.',
          default_value: '0.0.0.0/0',
          cis_controls: ['v8 4.4', 'v7 4.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.3.3',
    vendor: 'fortigate',
    code: '2.3.3',
    title: 'Disable SNMPv3 Query Per User',
    section: 'SNMP',
    category: 'SNMP',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'snmp user queries',
    expected_value: 'queries disabled (trap-only user)',
    audit_hint: 'config system snmp user -> edit <user> -> set queries disable',
    remediation: 'Disable SNMP queries on user accounts used strictly for sending outbound traps.',
    default_value: 'enable',
    cis_controls: ['v8 4.4', 'v7 4.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Disable inbound SNMP query capabilities on trap-only SNMPv3 accounts following least privilege.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      const queryUsers = config.snmp?.v3_users?.filter(u => !u.queries_disabled) || [];
      if (queryUsers.length > 0) {
        return {
          title: 'Disable SNMPv3 Query Per User',
          description: `SNMPv3 user(s) have query capabilities enabled. For trap-only monitoring accounts, disable query permissions.`,
          category: 'SNMP',
          severity: 'Low',
          recommendation: 'Disable inbound SNMP query capabilities on trap-only SNMPv3 accounts following least privilege.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system snmp user'),
          system_check: 'auto',
          cis_code: '2.3.3',
          cis_level: 'L2',
          cis_section: 'SNMP',
          config_key: 'snmp user queries',
          expected_value: 'queries disabled (trap-only user)',
          audit_hint: 'config system snmp user -> edit <user> -> set queries disable',
          remediation: 'Disable SNMP queries on user accounts used strictly for sending outbound traps.',
          default_value: 'enable',
          cis_controls: ['v8 4.4', 'v7 4.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.3.4',
    vendor: 'fortigate',
    code: '2.3.4',
    title: 'Enable SNMP trap for memory usage',
    section: 'SNMP',
    category: 'SNMP',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'snmp sysinfo trap thresholds',
    expected_value: 'trap-free/freeable-memory configured',
    audit_hint: 'config system snmp sysinfo -> set trap-free-memory <threshold>',
    remediation: 'Configure SNMP trap thresholds for low free memory warning alert.',
    default_value: 'disabled',
    cis_controls: ['v8 8.2', 'v7 6.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable SNMP memory utilization alerts to detect resource starvation and prevent service outages.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const traps = config.snmp?.trap_thresholds || [];
      if (!traps.includes('trap-free-memory') && !traps.includes('freeable-memory')) {
        return {
          title: 'Enable SNMP trap for memory usage',
          description: 'SNMP sysinfo trap thresholds for free memory monitoring are not configured.',
          category: 'SNMP',
          severity: 'Low',
          recommendation: 'Enable SNMP memory utilization alerts to detect resource starvation and prevent service outages.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system snmp sysinfo'),
          system_check: 'auto',
          cis_code: '2.3.4',
          cis_level: 'L1',
          cis_section: 'SNMP',
          config_key: 'snmp sysinfo trap thresholds',
          expected_value: 'trap-free/freeable-memory configured',
          audit_hint: 'config system snmp sysinfo -> set trap-free-memory <threshold>',
          remediation: 'Configure SNMP trap thresholds for low free memory warning alert.',
          default_value: 'disabled',
          cis_controls: ['v8 8.2', 'v7 6.2']
        };
      }
      return null;
    }
  }
];
