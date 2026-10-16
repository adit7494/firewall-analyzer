import { AuditRule } from '../types/audit';
import { NormalizedConfig } from '../types/normalized-config';
import { extractSnippet } from "./snippet-extractor";

export const CIS_FORTIGATE_RULES_PART2: AuditRule[] = [
  // --- Section 2.4: Administrators & Admin Profiles ---
  {
    id: 'CIS-2.4.1',
    vendor: 'fortigate',
    code: '2.4.1',
    title: 'Remove default admin, create new name',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Critical',
    config_key: 'system admin (username "admin")',
    expected_value: 'No account named "admin"',
    audit_hint: 'config system admin -> check username list',
    remediation: 'Create a new super_admin account with a unique username and delete/disable the default "admin" account.',
    default_value: 'username admin',
    cis_controls: ['v8 5.4', 'v7 4.3'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Eliminate the well-known default administrative username "admin" to prevent automated credential stuffing.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.admin_accounts.some(a => a.name.toLowerCase() === 'admin')) {
        return {
          title: 'Remove default admin, create new name',
          description: 'Default account "admin" exists. Attackers routinely target the default "admin" username in password guessing attacks.',
          category: 'Administrators',
          severity: 'Critical',
          recommendation: 'Eliminate the well-known default administrative username "admin" to prevent automated credential stuffing.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system admin'),
          system_check: 'auto',
          cis_code: '2.4.1',
          cis_level: 'L1',
          cis_section: 'Administrators',
          config_key: 'system admin (username "admin")',
          expected_value: 'No account named "admin"',
          audit_hint: 'config system admin -> check username list',
          remediation: 'Create a new super_admin account with a unique username and delete/disable the default "admin" account.',
          default_value: 'username admin',
          cis_controls: ['v8 5.4', 'v7 4.3']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.4.2',
    vendor: 'fortigate',
    code: '2.4.2',
    title: 'Trusted hosts on all login accounts',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'system admin trusthost',
    expected_value: 'Specific IP list only, no 0.0.0.0/0 wildcards',
    audit_hint: 'config system admin -> edit <user> -> set trusthost1 <ip>',
    remediation: 'Configure trustedhost subnets for every admin account to restrict login origins.',
    default_value: '0.0.0.0/0 (0.0.0.0 0.0.0.0)',
    cis_controls: ['v8 4.4', 'v7 4.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure trusted host IP filters on all administrator accounts to restrict management logins to authorized management subnets.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const openAdmins = config.admin_accounts.filter(a => !a.trusted_hosts || a.trusted_hosts.length === 0 || a.trusted_hosts.includes('0.0.0.0/0') || a.trusted_hosts.includes('0.0.0.0 0.0.0.0'));
      if (openAdmins.length > 0) {
        return {
          title: 'Trusted hosts on all login accounts',
          description: `Administrator account(s) (${openAdmins.map(a => a.name).join(', ')}) can login from any source IP address without trusted host restrictions.`,
          category: 'Administrators',
          severity: 'High',
          recommendation: 'Configure trusted host IP filters on all administrator accounts to restrict management logins to authorized management subnets.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: openAdmins.map(a => extractSnippet(config, 'config system admin', `edit "${a.name}"`)).join('\n'),
          system_check: 'auto',
          cis_code: '2.4.2',
          cis_level: 'L1',
          cis_section: 'Administrators',
          config_key: 'system admin trusthost',
          expected_value: 'Specific IP list only, no 0.0.0.0/0 wildcards',
          audit_hint: 'config system admin -> edit <user> -> set trusthost1 <ip>',
          remediation: 'Configure trustedhost subnets for every admin account to restrict login origins.',
          default_value: '0.0.0.0/0 (0.0.0.0 0.0.0.0)',
          cis_controls: ['v8 4.4', 'v7 4.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.4.3',
    vendor: 'fortigate',
    code: '2.4.3',
    title: 'Correct admin privilege profiles assigned',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'Medium',
    config_key: 'system accprofile',
    expected_value: 'Not super_admin for daily operations; custom profile with comments',
    audit_hint: 'config system accprofile -> review custom privileges and comments',
    remediation: 'Assign custom least-privilege administrative profiles with descriptive comments instead of super_admin.',
    default_value: 'super_admin assigned to all',
    cis_controls: ['v8 5.4', 'v7 4.3'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Implement least-privilege administrative access profiles for daily operational management.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const superAdmins = config.admin_accounts.filter(a => a.profile === 'super_admin');
      if (superAdmins.length > 1) {
        return {
          title: 'Correct admin privilege profiles assigned',
          description: `Found ${superAdmins.length} accounts with super_admin profile (${superAdmins.map(a => a.name).join(', ')}). Requires auditor verification of least-privilege separation.`,
          category: 'Administrators',
          severity: 'Medium',
          recommendation: 'Implement least-privilege administrative access profiles for daily operational management.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: superAdmins.map(a => extractSnippet(config, 'config system admin', `edit "${a.name}"`)).join('\n'),
          system_check: 'semi',
          cis_code: '2.4.3',
          cis_level: 'L2',
          cis_section: 'Administrators',
          config_key: 'system accprofile',
          expected_value: 'Not super_admin for daily operations; custom profile with comments',
          audit_hint: 'config system accprofile -> review custom privileges and comments',
          remediation: 'Assign custom least-privilege administrative profiles with descriptive comments instead of super_admin.',
          default_value: 'super_admin assigned to all',
          cis_controls: ['v8 5.4', 'v7 4.3']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.4.4',
    vendor: 'fortigate',
    code: '2.4.4',
    title: 'Admin idle timeout configured',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system global admintimeout',
    expected_value: '<= 15 minutes (900 seconds)',
    audit_hint: 'config system global -> set admintimeout 15',
    remediation: 'Set admintimeout to maximum 15 minutes (900 seconds equivalent) to automatically log out idle administrative sessions.',
    default_value: '5 (varies)',
    cis_controls: ['v8 4.1', 'v7 4.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enforce an administrative idle session timeout of 15 minutes or less to prevent unattended console hijacking.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const timeout = config.system.admin_idle_timeout ?? 10;
      if (timeout > 15) {
        return {
          title: 'Admin idle timeout configured',
          description: `Administrative session idle timeout is set to ${timeout} minutes, exceeding CIS benchmark maximum of 15 minutes.`,
          category: 'Administrators',
          severity: 'Medium',
          recommendation: 'Enforce an administrative idle session timeout of 15 minutes or less to prevent unattended console hijacking.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.4.4',
          cis_level: 'L1',
          cis_section: 'Administrators',
          config_key: 'system global admintimeout',
          expected_value: '<= 15 minutes (900 seconds)',
          audit_hint: 'config system global -> set admintimeout 15',
          remediation: 'Set admintimeout to maximum 15 minutes (900 seconds equivalent) to automatically log out idle administrative sessions.',
          default_value: '5 (varies)',
          cis_controls: ['v8 4.1', 'v7 4.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.4.5',
    vendor: 'fortigate',
    code: '2.4.5',
    title: 'Only encrypted access channels enabled',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'system interface allowaccess (HTTP/Telnet)',
    expected_value: 'No http or telnet on any interface',
    audit_hint: 'config system interface -> check allowaccess for http and telnet',
    remediation: 'Remove cleartext administrative protocols (HTTP, Telnet) from allowaccess on all network interfaces.',
    default_value: 'ping https ssh http',
    cis_controls: ['v8 4.4', 'v7 4.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Disable unencrypted management access channels (HTTP and Telnet) on all interfaces to prevent credential eavesdropping.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const cleartextIntf = config.interfaces.filter(i => i.allowaccess && i.allowaccess.some(a => ['http', 'telnet'].includes(a.toLowerCase())));
      if (cleartextIntf.length > 0 || config.management_access.http || config.management_access.telnet) {
        return {
          title: 'Only encrypted access channels enabled',
          description: `Interface(s) (${cleartextIntf.map(i => i.name).join(', ') || 'Internal'}) allow cleartext management access via HTTP or Telnet.`,
          category: 'Administrators',
          severity: 'High',
          recommendation: 'Disable unencrypted management access channels (HTTP and Telnet) on all interfaces to prevent credential eavesdropping.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: cleartextIntf.map(i => `config system interface\n    edit "${i.name}"\n        set allowaccess ${i.allowaccess.join(' ')}\n    next`).join('\n') || 'set allowaccess http telnet',
          system_check: 'auto',
          cis_code: '2.4.5',
          cis_level: 'L1',
          cis_section: 'Administrators',
          config_key: 'system interface allowaccess (HTTP/Telnet)',
          expected_value: 'No http or telnet on any interface',
          audit_hint: 'config system interface -> check allowaccess for http and telnet',
          remediation: 'Remove cleartext administrative protocols (HTTP, Telnet) from allowaccess on all network interfaces.',
          default_value: 'ping https ssh http',
          cis_controls: ['v8 4.4', 'v7 4.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.4.6',
    vendor: 'fortigate',
    code: '2.4.6',
    title: 'Apply Local-in Policies',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'Medium',
    config_key: 'config firewall local-in-policy',
    expected_value: 'At least one local-in policy restricting device self-access is configured',
    audit_hint: 'config firewall local-in-policy -> show',
    remediation: 'Configure firewall local-in-policy to restrict access to the firewall self-IPs and administrative services.',
    default_value: 'empty / unconfigured',
    cis_controls: ['v8 12.2', 'v7 14.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure Local-in policies to harden firewall self-protection by controlling access to device management interfaces.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.local_in_policies || config.local_in_policies.length === 0) {
        return {
          title: 'Apply Local-in Policies',
          description: 'No explicit Local-in policies configured. The firewall management plane relies solely on interface allowaccess without granular ACLs.',
          category: 'Administrators',
          severity: 'Medium',
          recommendation: 'Configure Local-in policies to harden firewall self-protection by controlling access to device management interfaces.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config firewall local-in-policy'),
          system_check: 'semi',
          cis_code: '2.4.6',
          cis_level: 'L2',
          cis_section: 'Administrators',
          config_key: 'config firewall local-in-policy',
          expected_value: 'At least one local-in policy restricting device self-access is configured',
          audit_hint: 'config firewall local-in-policy -> show',
          remediation: 'Configure firewall local-in-policy to restrict access to the firewall self-IPs and administrative services.',
          default_value: 'empty / unconfigured',
          cis_controls: ['v8 12.2', 'v7 14.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.4.7',
    vendor: 'fortigate',
    code: '2.4.7',
    title: 'Change default Admin ports',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system global admin-port / admin-sport',
    expected_value: 'Not port 80 (HTTP) or 443 (HTTPS); redirect disable recommended',
    audit_hint: 'config system global -> set admin-sport <non-443>, set admin-port <non-80>',
    remediation: 'Change default admin HTTPS port from 443 and HTTP port from 80 to non-standard ports.',
    default_value: 'admin-sport 443, admin-port 80',
    cis_controls: ['v8 4.1', 'v7 4.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Change default management ports (80/443) to non-standard ports to evade automated scanning and botnets.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const p = config.system.admin_port ?? 80;
      const sp = config.system.admin_sport ?? 443;
      if (p === 80 || sp === 443) {
        return {
          title: 'Change default Admin ports',
          description: `Default administrative ports in use (HTTP port ${p}, HTTPS port ${sp}). Using well-known ports increases exposure to automated vulnerability scanners.`,
          category: 'Administrators',
          severity: 'Medium',
          recommendation: 'Change default management ports (80/443) to non-standard ports to evade automated scanning and botnets.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.4.7',
          cis_level: 'L2',
          cis_section: 'Administrators',
          config_key: 'system global admin-port / admin-sport',
          expected_value: 'Not port 80 (HTTP) or 443 (HTTPS); redirect disable recommended',
          audit_hint: 'config system global -> set admin-sport <non-443>, set admin-port <non-80>',
          remediation: 'Change default admin HTTPS port from 443 and HTTP port from 80 to non-standard ports.',
          default_value: 'admin-sport 443, admin-port 80',
          cis_controls: ['v8 4.1', 'v7 4.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.4.8',
    vendor: 'fortigate',
    code: '2.4.8',
    title: 'Virtual patching on local-in mgmt',
    section: 'Administrators',
    category: 'Administrators',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system global virtual-patch',
    expected_value: 'enable',
    audit_hint: 'config system global -> set virtual-patch enable',
    remediation: 'Enable virtual patching to protect local management interfaces from newly disclosed exploits.',
    default_value: 'disable',
    cis_controls: ['v8 7.3', 'v7 3.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable virtual patching on local management interfaces to automatically shield against emerging zero-day vulnerabilities.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.system.virtual_patch_enabled) {
        return {
          title: 'Virtual patching on local-in mgmt',
          description: 'Virtual patching is disabled. Enabling this feature shields local management interfaces against unpatched FortiOS vulnerabilities.',
          category: 'Administrators',
          severity: 'Medium',
          recommendation: 'Enable virtual patching on local management interfaces to automatically shield against emerging zero-day vulnerabilities.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system global'),
          system_check: 'auto',
          cis_code: '2.4.8',
          cis_level: 'L2',
          cis_section: 'Administrators',
          config_key: 'system global virtual-patch',
          expected_value: 'enable',
          audit_hint: 'config system global -> set virtual-patch enable',
          remediation: 'Enable virtual patching to protect local management interfaces from newly disclosed exploits.',
          default_value: 'disable',
          cis_controls: ['v8 7.3', 'v7 3.5']
        };
      }
      return null;
    }
  },

  // --- Section 2.5: High Availability ---
  {
    id: 'CIS-2.5.1',
    vendor: 'fortigate',
    code: '2.5.1',
    title: 'Ensure HA configuration is enabled',
    section: 'High Availability',
    category: 'High Availability',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'manual',
    severity: 'High',
    config_key: 'system ha mode',
    expected_value: 'a-p or a-a (per business requirements)',
    audit_hint: 'config system ha -> set mode a-p',
    remediation: 'Configure High Availability (Active-Passive or Active-Active) for mission-critical firewall deployments.',
    default_value: 'standalone',
    cis_controls: ['v8 11.1', 'v7 11.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Verify High Availability architecture (a-p or a-a) to ensure uninterrupted service availability during hardware failures.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.device.ha_status === 'Standalone' || config.ha?.mode === 'standalone') {
        return {
          title: 'Ensure HA configuration is enabled',
          description: 'Device is running in Standalone mode without High Availability redundancy. Requires auditor assessment of business continuity requirements.',
          category: 'High Availability',
          severity: 'High',
          recommendation: 'Verify High Availability architecture (a-p or a-a) to ensure uninterrupted service availability during hardware failures.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: true,
          evidence_snippet: extractSnippet(config, 'config system ha'),
          system_check: 'manual',
          cis_code: '2.5.1',
          cis_level: 'L2',
          cis_section: 'High Availability',
          config_key: 'system ha mode',
          expected_value: 'a-p or a-a (per business requirements)',
          audit_hint: 'config system ha -> set mode a-p',
          remediation: 'Configure High Availability (Active-Passive or Active-Active) for mission-critical firewall deployments.',
          default_value: 'standalone',
          cis_controls: ['v8 11.1', 'v7 11.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.5.2',
    vendor: 'fortigate',
    code: '2.5.2',
    title: 'Enable Monitor Interfaces for HA',
    section: 'High Availability',
    category: 'High Availability',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'Medium',
    config_key: 'system ha monitor',
    expected_value: 'Critical interfaces (WAN/LAN) included in HA monitor list',
    audit_hint: 'config system ha -> set monitor wan1 internal',
    remediation: 'Add all critical upstream and downstream network interfaces to the HA interface monitoring list.',
    default_value: 'empty / none',
    cis_controls: ['v8 11.1', 'v7 11.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure HA interface monitoring on critical interfaces to trigger automatic failover upon link disconnection.',
    compliance_tags: ['CIS FortiGate', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.device.ha_status !== 'Standalone' && (!config.ha?.monitor_interfaces || config.ha.monitor_interfaces.length === 0)) {
        return {
          title: 'Enable Monitor Interfaces for HA',
          description: 'High Availability is active, but no interfaces are configured for HA monitoring. Link loss will not trigger HA failover.',
          category: 'High Availability',
          severity: 'Medium',
          recommendation: 'Configure HA interface monitoring on critical interfaces to trigger automatic failover upon link disconnection.',
          compliance_tags: ['CIS FortiGate', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system ha'),
          system_check: 'semi',
          cis_code: '2.5.2',
          cis_level: 'L2',
          cis_section: 'High Availability',
          config_key: 'system ha monitor',
          expected_value: 'Critical interfaces (WAN/LAN) included in HA monitor list',
          audit_hint: 'config system ha -> set monitor wan1 internal',
          remediation: 'Add all critical upstream and downstream network interfaces to the HA interface monitoring list.',
          default_value: 'empty / none',
          cis_controls: ['v8 11.1', 'v7 11.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.5.3',
    vendor: 'fortigate',
    code: '2.5.3',
    title: 'HA Reserved Mgmt Interface configured',
    section: 'High Availability',
    category: 'High Availability',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system ha ha-mgmt-status',
    expected_value: 'enable',
    audit_hint: 'config system ha -> set ha-mgmt-status enable',
    remediation: 'Enable HA reserved management interface to allow independent out-of-band management of both HA cluster members.',
    default_value: 'disable',
    cis_controls: ['v8 4.4', 'v7 4.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure HA reserved management interface for reliable out-of-band management access to individual cluster units.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.device.ha_status !== 'Standalone' && !config.ha?.reserved_mgmt?.enabled) {
        return {
          title: 'HA Reserved Mgmt Interface configured',
          description: 'HA reserved management interface is not enabled. Without reserved management, accessing a standby HA node directly during troubleshooting is impaired.',
          category: 'High Availability',
          severity: 'Medium',
          recommendation: 'Configure HA reserved management interface for reliable out-of-band management access to individual cluster units.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system ha'),
          system_check: 'auto',
          cis_code: '2.5.3',
          cis_level: 'L2',
          cis_section: 'High Availability',
          config_key: 'system ha ha-mgmt-status',
          expected_value: 'enable',
          audit_hint: 'config system ha -> set ha-mgmt-status enable',
          remediation: 'Enable HA reserved management interface to allow independent out-of-band management of both HA cluster members.',
          default_value: 'disable',
          cis_controls: ['v8 4.4', 'v7 4.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-2.5.4',
    vendor: 'fortigate',
    code: '2.5.4',
    title: 'HA Group-ID configured',
    section: 'High Availability',
    category: 'High Availability',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'system ha group-id',
    expected_value: 'Configured (not default 0 if >1 cluster on L2)',
    audit_hint: 'config system ha -> set group-id <id>',
    remediation: 'Set a unique HA group-id to prevent virtual MAC collisions when multiple HA clusters share Layer 2 broadcast domains.',
    default_value: '0',
    cis_controls: ['v8 11.1', 'v7 11.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Assign a unique HA Group ID to avoid heartbeat collisions and virtual MAC conflicts in multi-cluster broadcast domains.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.device.ha_status !== 'Standalone' && (config.ha?.group_id === undefined || config.ha.group_id === 0)) {
        return {
          title: 'HA Group-ID configured',
          description: 'HA Group ID is set to default (0). If multiple HA clusters share the same Layer 2 segment, virtual MAC collisions will occur.',
          category: 'High Availability',
          severity: 'Low',
          recommendation: 'Assign a unique HA Group ID to avoid heartbeat collisions and virtual MAC conflicts in multi-cluster broadcast domains.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system ha'),
          system_check: 'auto',
          cis_code: '2.5.4',
          cis_level: 'L2',
          cis_section: 'High Availability',
          config_key: 'system ha group-id',
          expected_value: 'Configured (not default 0 if >1 cluster on L2)',
          audit_hint: 'config system ha -> set group-id <id>',
          remediation: 'Set a unique HA group-id to prevent virtual MAC collisions when multiple HA clusters share Layer 2 broadcast domains.',
          default_value: '0',
          cis_controls: ['v8 11.1', 'v7 11.2']
        };
      }
      return null;
    }
  },

  // --- Section 3: Policy & Objects ---
  {
    id: 'CIS-3.1',
    vendor: 'fortigate',
    code: '3.1',
    title: 'Unused policies reviewed regularly',
    section: 'Policy & Objects',
    category: 'Policy & Objects',
    cis_level: 'L1',
    cis_status: 'Manual',
    system_check: 'manual',
    severity: 'Medium',
    config_key: 'firewall policy hit-count / review',
    expected_value: 'Periodic review confirms old/zero-hit policies are removed (manual verification)',
    audit_hint: 'diagnose firewall policy hitcount -> check unused rules',
    remediation: 'Review firewall policy hit counts quarterly and remove or disable obsolete firewall policies.',
    default_value: 'N/A (operational)',
    cis_controls: ['v8 12.2', 'v7 14.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Periodically review firewall rules and remove unused policies to reduce policy clutter and attack surface.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      // This is a manual-only check — it requires an auditor to verify hit counts
      // and review policies periodically. It cannot be determined from config text alone.
      // Return null so it does not auto-generate a finding. Auditors should manually
      // review 'diagnose firewall policy hitcount' output on the live device.
      void config;
      return null;
    }
  },
  {
    id: 'CIS-3.2',
    vendor: 'fortigate',
    code: '3.2',
    title: 'Policies do not use "ALL" as Service',
    section: 'Policy & Objects',
    category: 'Policy & Objects',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'firewall policy service',
    expected_value: 'Specific services (not "ALL")',
    audit_hint: 'config firewall policy -> edit <id> -> check set service ALL',
    remediation: 'Replace generic "ALL" service definitions in firewall allow rules with explicit required protocols and port numbers.',
    default_value: 'ALL',
    cis_controls: ['v8 12.2', 'v7 14.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Restrict firewall policy service definitions to specific required protocols and ports instead of generic "ALL".',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const allServiceRules = config.firewall_rules.filter(r => r.enabled && r.action === 'accept' && r.service && r.service.some(s => s.toUpperCase() === 'ALL'));
      if (allServiceRules.length > 0) {
        return {
          title: 'Policies do not use "ALL" as Service',
          description: `Found ${allServiceRules.length} active allow policy(ies) (${allServiceRules.map(r => `ID ${r.id}: "${r.name}"`).join(', ')}) permitting ALL services/ports.`,
          category: 'Policy & Objects',
          severity: 'High',
          recommendation: 'Restrict firewall policy service definitions to specific required protocols and ports instead of generic "ALL".',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: allServiceRules.map(r => r.raw_snippet || '# Configuration missing').join('\n'),
          system_check: 'auto',
          cis_code: '3.2',
          cis_level: 'L1',
          cis_section: 'Policy & Objects',
          config_key: 'firewall policy service',
          expected_value: 'Specific services (not "ALL")',
          audit_hint: 'config firewall policy -> edit <id> -> check set service ALL',
          remediation: 'Replace generic "ALL" service definitions in firewall allow rules with explicit required protocols and port numbers.',
          default_value: 'ALL',
          cis_controls: ['v8 12.2', 'v7 14.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-3.3',
    vendor: 'fortigate',
    code: '3.3',
    title: 'Deny traffic to/from Tor/malicious/scanner ISDB',
    section: 'Policy & Objects',
    category: 'Policy & Objects',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'High',
    config_key: 'firewall policy internet-service / ISDB',
    expected_value: 'Deny policy for Tor, Malicious, and Scanner ISDB groups exists above allow rules',
    audit_hint: 'config firewall policy -> check for ISDB deny rules at top of rulebase',
    remediation: 'Create global deny firewall policies at the top of the rulebase targeting FortiGuard Malicious, Tor, and Scanner ISDB groups.',
    default_value: 'unconfigured',
    cis_controls: ['v8 13.5', 'v7 12.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Implement explicit top-of-rulebase deny policies blocking known Tor nodes, malicious IPs, and vulnerability scanners via ISDB.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const hasIsdbDeny = config.firewall_rules.some(r => r.enabled && r.action === 'deny' && (r.has_isdb || r.name?.toLowerCase().includes('isdb') || r.name?.toLowerCase().includes('tor') || r.name?.toLowerCase().includes('malicious')));
      if (!hasIsdbDeny) {
        return {
          title: 'Deny traffic to/from Tor/malicious/scanner ISDB',
          description: 'No top-level ISDB deny policies found for Tor nodes, malicious IPs, or vulnerability scanners. Requires auditor review.',
          category: 'Policy & Objects',
          severity: 'High',
          recommendation: 'Implement explicit top-of-rulebase deny policies blocking known Tor nodes, malicious IPs, and vulnerability scanners via ISDB.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config firewall policy'),
          system_check: 'semi',
          cis_code: '3.3',
          cis_level: 'L2',
          cis_section: 'Policy & Objects',
          config_key: 'firewall policy internet-service / ISDB',
          expected_value: 'Deny policy for Tor, Malicious, and Scanner ISDB groups exists above allow rules',
          audit_hint: 'config firewall policy -> check for ISDB deny rules at top of rulebase',
          remediation: 'Create global deny firewall policies at the top of the rulebase targeting FortiGuard Malicious, Tor, and Scanner ISDB groups.',
          default_value: 'unconfigured',
          cis_controls: ['v8 13.5', 'v7 12.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-3.4',
    vendor: 'fortigate',
    code: '3.4',
    title: 'Logging enabled on all firewall policies',
    section: 'Policy & Objects',
    category: 'Policy & Objects',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'firewall policy logtraffic',
    expected_value: 'all or utm (not disable)',
    audit_hint: 'config firewall policy -> edit <id> -> check set logtraffic',
    remediation: 'Enable traffic logging (set logtraffic all or utm) on all active firewall policies.',
    default_value: 'utm (varies)',
    cis_controls: ['v8 8.2', 'v7 6.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable traffic logging on all active firewall policies to maintain a complete audit trail of network communication.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const unlogged = config.firewall_rules.filter(r => r.enabled && !r.logging_enabled);
      if (unlogged.length > 0) {
        return {
          title: 'Logging enabled on all firewall policies',
          description: `Found ${unlogged.length} active policy(ies) (${unlogged.map(r => `ID ${r.id}: "${r.name}"`).join(', ')}) with traffic logging disabled.`,
          category: 'Policy & Objects',
          severity: 'Medium',
          recommendation: 'Enable traffic logging on all active firewall policies to maintain a complete audit trail of network communication.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: unlogged.map(r => r.raw_snippet || '# Configuration missing').join('\n'),
          system_check: 'auto',
          cis_code: '3.4',
          cis_level: 'L1',
          cis_section: 'Policy & Objects',
          config_key: 'firewall policy logtraffic',
          expected_value: 'all or utm (not disable)',
          audit_hint: 'config firewall policy -> edit <id> -> check set logtraffic',
          remediation: 'Enable traffic logging (set logtraffic all or utm) on all active firewall policies.',
          default_value: 'utm (varies)',
          cis_controls: ['v8 8.2', 'v7 6.2']
        };
      }
      return null;
    }
  },
  {
    id: 'FW-ANY',
    vendor: 'common',
    code: 'FW-ANY',
    title: 'Any-Any-Any policy detected',
    section: 'Policy & Objects',
    category: 'Policy & Objects',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Critical',
    config_key: 'firewall policy srcaddr/dstaddr/service',
    expected_value: 'No allow rule from any to any with service any',
    audit_hint: 'config firewall policy -> check for set srcaddr all, dstaddr all, service ALL, action accept',
    remediation: 'Remove overly permissive Any-Any-Any allow rules and replace with granular network segmentation policies.',
    default_value: 'none',
    cis_controls: ['v8 12.2', 'v7 14.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Eliminate Any-Any-Any firewall allow policies immediately to prevent complete bypass of network segmentation.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const anyAny = config.firewall_rules.filter(r => 
        r.enabled && 
        r.action === 'accept' && 
        r.src.some(s => s.toLowerCase() === 'all' || s === '0.0.0.0/0' || s.toLowerCase() === 'any') && 
        r.dst.some(d => d.toLowerCase() === 'all' || d === '0.0.0.0/0' || d.toLowerCase() === 'any') && 
        r.service.some(s => s.toUpperCase() === 'ALL' || s.toLowerCase() === 'any' || s === '*')
      );
      if (anyAny.length > 0) {
        return {
          title: 'Any-Any-Any policy detected',
          description: `CRITICAL: Found ${anyAny.length} overly permissive allow policy(ies) (${anyAny.map(r => `ID ${r.id}: "${r.name}"`).join(', ')}) permitting ALL traffic from ANY source to ANY destination.`,
          category: 'Policy & Objects',
          severity: 'Critical',
          recommendation: 'Eliminate Any-Any-Any firewall allow policies immediately to prevent complete bypass of network segmentation.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: anyAny.map(r => r.raw_snippet || '# Configuration missing').join('\n'),
          system_check: 'auto',
          cis_code: 'FW-ANY',
          cis_level: 'L1',
          cis_section: 'Policy & Objects',
          config_key: 'firewall policy srcaddr/dstaddr/service',
          expected_value: 'No allow rule from any to any with service any',
          audit_hint: 'config firewall policy -> check for set srcaddr all, dstaddr all, service ALL, action accept',
          remediation: 'Remove overly permissive Any-Any-Any allow rules and replace with granular network segmentation policies.',
          default_value: 'none',
          cis_controls: ['v8 12.2', 'v7 14.1']
        };
      }
      return null;
    }
  }
];
