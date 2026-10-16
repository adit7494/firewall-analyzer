import { AuditRule } from '../types/audit';
import { NormalizedConfig } from '../types/normalized-config';
import { extractSnippet } from "./snippet-extractor";

export const CIS_FORTIGATE_RULES_PART3: AuditRule[] = [
  // --- Section 4.1: IPS ---
  {
    id: 'CIS-4.1.1',
    vendor: 'fortigate',
    code: '4.1.1',
    title: 'Detect Botnet connections',
    section: 'Security Profiles > IPS',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'ips sensor scan-botnet-connections',
    expected_value: 'block or monitor on active sensors',
    audit_hint: 'config ips sensor -> edit <sensor> -> set scan-botnet-connections block',
    remediation: 'Enable scan-botnet-connections in all active IPS sensors to block C&C communications.',
    default_value: 'disable',
    cis_controls: ['v8 13.5', 'v7 12.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable botnet connection scanning in IPS sensors to detect and block known command-and-control server traffic.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const openIps = config.security_profiles?.ips?.filter(p => !p.scan_botnet_connections) || [];
      if (openIps.length > 0 || !config.security_profiles?.ips || config.security_profiles.ips.length === 0) {
        return {
          title: 'Detect Botnet connections',
          description: `IPS sensor(s) do not have scan-botnet-connections enabled. Communications with known botnet command-and-control servers will not be inspected or blocked.`,
          category: 'Security Profiles',
          severity: 'High',
          recommendation: 'Enable botnet connection scanning in IPS sensors to detect and block known command-and-control server traffic.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: openIps.length > 0 ? openIps.map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No IPS sensors configured with scan-botnet-connections enabled',
          system_check: 'auto',
          cis_code: '4.1.1',
          cis_level: 'L1',
          cis_section: 'Security Profiles > IPS',
          config_key: 'ips sensor scan-botnet-connections',
          expected_value: 'block or monitor on active sensors',
          audit_hint: 'config ips sensor -> edit <sensor> -> set scan-botnet-connections block',
          remediation: 'Enable scan-botnet-connections in all active IPS sensors to block C&C communications.',
          default_value: 'disable',
          cis_controls: ['v8 13.5', 'v7 12.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.1.2',
    vendor: 'fortigate',
    code: '4.1.2',
    title: 'Apply IPS Profile to Policies',
    section: 'Security Profiles > IPS',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'firewall policy ips-sensor',
    expected_value: 'All allow policies (especially inbound/outbound) have ips-sensor',
    audit_hint: 'config firewall policy -> check set ips-sensor on allow policies',
    remediation: 'Attach an appropriate IPS sensor profile to all active firewall allow policies.',
    default_value: 'none assigned',
    cis_controls: ['v8 13.5', 'v7 12.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Apply Intrusion Prevention System (IPS) profiles to all allow policies to dynamically detect and block network exploits.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const noIps = config.firewall_rules.filter(r => r.enabled && r.action === 'accept' && (!r.profiles || (!r.profiles.some(p => p.includes('ips')) && !r.ips_sensor)));
      if (noIps.length > 0) {
        return {
          title: 'Apply IPS Profile to Policies',
          description: `Found ${noIps.length} active allow policy(ies) (${noIps.map(r => `ID ${r.id}: "${r.name}"`).join(', ')}) without an attached IPS profile.`,
          category: 'Security Profiles',
          severity: 'High',
          recommendation: 'Apply Intrusion Prevention System (IPS) profiles to all allow policies to dynamically detect and block network exploits.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: noIps.map(r => r.raw_snippet || '# Configuration missing').join('\n'),
          system_check: 'auto',
          cis_code: '4.1.2',
          cis_level: 'L1',
          cis_section: 'Security Profiles > IPS',
          config_key: 'firewall policy ips-sensor',
          expected_value: 'All allow policies (especially inbound/outbound) have ips-sensor',
          audit_hint: 'config firewall policy -> check set ips-sensor on allow policies',
          remediation: 'Attach an appropriate IPS sensor profile to all active firewall allow policies.',
          default_value: 'none assigned',
          cis_controls: ['v8 13.5', 'v7 12.4']
        };
      }
      return null;
    }
  },

  // --- Section 4.2: Antivirus ---
  {
    id: 'CIS-4.2.1',
    vendor: 'fortigate',
    code: '4.2.1',
    title: 'AV Definition Push Updates configured',
    section: 'Security Profiles > Antivirus',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system autoupdate schedule',
    expected_value: 'frequency automatic / every / daily',
    audit_hint: 'config system autoupdate schedule -> set frequency automatic',
    remediation: 'Configure FortiGuard antivirus definition push updates or scheduled hourly autoupdates.',
    default_value: 'every (varies)',
    cis_controls: ['v8 10.1', 'v7 8.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable automatic antivirus definition updates to maintain continuous protection against newly discovered malware strains.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const sch = config.security_profiles?.av?.autoupdate_schedule;
      if (sch === 'disable' || sch === 'manual' || !sch) {
        return {
          title: 'AV Definition Push Updates configured',
          description: 'Automatic antivirus definition update schedule is disabled or not configured.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Enable automatic antivirus definition updates to maintain continuous protection against newly discovered malware strains.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system autoupdate schedule'),
          system_check: 'auto',
          cis_code: '4.2.1',
          cis_level: 'L1',
          cis_section: 'Security Profiles > Antivirus',
          config_key: 'system autoupdate schedule',
          expected_value: 'frequency automatic / every / daily',
          audit_hint: 'config system autoupdate schedule -> set frequency automatic',
          remediation: 'Configure FortiGuard antivirus definition push updates or scheduled hourly autoupdates.',
          default_value: 'every (varies)',
          cis_controls: ['v8 10.1', 'v7 8.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.2.2',
    vendor: 'fortigate',
    code: '4.2.2',
    title: 'Apply AV Profile to Policies',
    section: 'Security Profiles > Antivirus',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'firewall policy av-profile',
    expected_value: 'All relevant allow policies have av-profile',
    audit_hint: 'config firewall policy -> check set av-profile on allow policies',
    remediation: 'Attach an antivirus inspection profile to all firewall allow policies permitting web or file transfer protocols.',
    default_value: 'none assigned',
    cis_controls: ['v8 10.2', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Attach Antivirus inspection profiles to firewall allow policies to intercept malware before it reaches internal endpoints.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const noAv = config.firewall_rules.filter(r => r.enabled && r.action === 'accept' && r.service && r.service.some(s => ['HTTP', 'HTTPS', 'FTP', 'SMTP', 'POP3', 'IMAP', 'ALL'].includes(s.toUpperCase())) && (!r.profiles || (!r.profiles.some(p => p.includes('av')) && !r.av_profile)));
      if (noAv.length > 0) {
        return {
          title: 'Apply AV Profile to Policies',
          description: `Found ${noAv.length} allow policy(ies) (${noAv.map(r => `ID ${r.id}: "${r.name}"`).join(', ')}) handling file/web protocols without an antivirus profile attached.`,
          category: 'Security Profiles',
          severity: 'High',
          recommendation: 'Attach Antivirus inspection profiles to firewall allow policies to intercept malware before it reaches internal endpoints.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: noAv.map(r => r.raw_snippet || '# Configuration missing').join('\n'),
          system_check: 'auto',
          cis_code: '4.2.2',
          cis_level: 'L1',
          cis_section: 'Security Profiles > Antivirus',
          config_key: 'firewall policy av-profile',
          expected_value: 'All relevant allow policies have av-profile',
          audit_hint: 'config firewall policy -> check set av-profile on allow policies',
          remediation: 'Attach an antivirus inspection profile to all firewall allow policies permitting web or file transfer protocols.',
          default_value: 'none assigned',
          cis_controls: ['v8 10.2', 'v7 8.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.2.3',
    vendor: 'fortigate',
    code: '4.2.3',
    title: 'Enable Outbreak Prevention Database',
    section: 'Security Profiles > Antivirus',
    category: 'Security Profiles',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'antivirus profile outbreak-prevention',
    expected_value: 'block / archive / monitor',
    audit_hint: 'config antivirus profile -> edit <profile> -> set outbreak-prevention block',
    remediation: 'Enable FortiGuard Virus Outbreak Prevention in antivirus profiles to stop emerging zero-hour epidemics.',
    default_value: 'disabled',
    cis_controls: ['v8 10.1', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable FortiGuard Virus Outbreak Prevention database to block zero-hour virus epidemics during signature compilation gaps.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const outbreak = config.security_profiles?.av?.outbreak_prevention;
      if (outbreak !== 'block' && outbreak !== 'archive' && outbreak !== 'monitor' && outbreak !== 'enable') {
        return {
          title: 'Enable Outbreak Prevention Database',
          description: 'Outbreak Prevention is not enabled in antivirus profiles. Zero-hour virus threats may bypass standard signature matching.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Enable FortiGuard Virus Outbreak Prevention database to block zero-hour virus epidemics during signature compilation gaps.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: (config.security_profiles?.av?.profiles || []).length > 0 ? (config.security_profiles?.av?.profiles || []).map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Antivirus profiles with outbreak-prevention enabled',
          system_check: 'auto',
          cis_code: '4.2.3',
          cis_level: 'L2',
          cis_section: 'Security Profiles > Antivirus',
          config_key: 'antivirus profile outbreak-prevention',
          expected_value: 'block / archive / monitor',
          audit_hint: 'config antivirus profile -> edit <profile> -> set outbreak-prevention block',
          remediation: 'Enable FortiGuard Virus Outbreak Prevention in antivirus profiles to stop emerging zero-hour epidemics.',
          default_value: 'disabled',
          cis_controls: ['v8 10.1', 'v7 8.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.2.4',
    vendor: 'fortigate',
    code: '4.2.4',
    title: 'Enable AI/heuristic malware detection',
    section: 'Security Profiles > Antivirus',
    category: 'Security Profiles',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'antivirus profile machine-learning-detection',
    expected_value: 'enable / block',
    audit_hint: 'config antivirus profile -> edit <profile> -> set machine-learning-detection enable',
    remediation: 'Enable machine-learning / heuristic malware detection within antivirus profiles.',
    default_value: 'disable',
    cis_controls: ['v8 10.2', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable machine-learning/heuristic detection in antivirus profiles to intercept polymorphic and previously unseen malware.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.security_profiles?.av?.machine_learning_detection) {
        return {
          title: 'Enable AI/heuristic malware detection',
          description: 'AI / heuristic machine learning detection is disabled in antivirus profile settings.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Enable machine-learning/heuristic detection in antivirus profiles to intercept polymorphic and previously unseen malware.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: (config.security_profiles?.av?.profiles || []).length > 0 ? (config.security_profiles?.av?.profiles || []).map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Antivirus profiles with machine-learning-detection enabled',
          system_check: 'auto',
          cis_code: '4.2.4',
          cis_level: 'L2',
          cis_section: 'Security Profiles > Antivirus',
          config_key: 'antivirus profile machine-learning-detection',
          expected_value: 'enable / block',
          audit_hint: 'config antivirus profile -> edit <profile> -> set machine-learning-detection enable',
          remediation: 'Enable machine-learning / heuristic malware detection within antivirus profiles.',
          default_value: 'disable',
          cis_controls: ['v8 10.2', 'v7 8.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.2.5',
    vendor: 'fortigate',
    code: '4.2.5',
    title: 'Enable grayware detection',
    section: 'Security Profiles > Antivirus',
    category: 'Security Profiles',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'antivirus profile grayware',
    expected_value: 'enable / block',
    audit_hint: 'config antivirus profile -> edit <profile> -> set grayware enable',
    remediation: 'Enable grayware detection to block adware, spyware, and unwanted applications.',
    default_value: 'disable',
    cis_controls: ['v8 10.2', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable grayware detection in antivirus profiles to identify and block spyware, adware, and potentially unwanted programs.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.security_profiles?.av?.grayware) {
        return {
          title: 'Enable grayware detection',
          description: 'Grayware detection is disabled. Potentially unwanted programs (adware, spyware) may pass unblocked.',
          category: 'Security Profiles',
          severity: 'Low',
          recommendation: 'Enable grayware detection in antivirus profiles to identify and block spyware, adware, and potentially unwanted programs.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: (config.security_profiles?.av?.profiles || []).length > 0 ? (config.security_profiles?.av?.profiles || []).map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Antivirus profiles with grayware blocked',
          system_check: 'auto',
          cis_code: '4.2.5',
          cis_level: 'L2',
          cis_section: 'Security Profiles > Antivirus',
          config_key: 'antivirus profile grayware',
          expected_value: 'enable / block',
          audit_hint: 'config antivirus profile -> edit <profile> -> set grayware enable',
          remediation: 'Enable grayware detection to block adware, spyware, and unwanted applications.',
          default_value: 'disable',
          cis_controls: ['v8 10.2', 'v7 8.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.2.6',
    vendor: 'fortigate',
    code: '4.2.6',
    title: 'Inline scanning FortiGuard AI Sandbox',
    section: 'Security Profiles > Antivirus',
    category: 'Security Profiles',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'antivirus profile sandbox-inline',
    expected_value: 'enable',
    audit_hint: 'config antivirus profile -> edit <profile> -> set sandbox-inline enable',
    remediation: 'Enable inline sandbox inspection to hold suspicious files while awaiting FortiSandbox execution analysis.',
    default_value: 'disable',
    cis_controls: ['v8 10.2', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable inline AI sandbox scanning to hold suspicious files until dynamic behavioral analysis confirms safety.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.security_profiles?.av?.sandbox_inline) {
        return {
          title: 'Inline scanning FortiGuard AI Sandbox',
          description: 'Inline sandbox scanning is disabled. Files sent to sandbox for analysis may be delivered to users before detonation completes.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Enable inline AI sandbox scanning to hold suspicious files until dynamic behavioral analysis confirms safety.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: (config.security_profiles?.av?.profiles || []).length > 0 ? (config.security_profiles?.av?.profiles || []).map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Antivirus profiles with sandbox-inline enabled',
          system_check: 'auto',
          cis_code: '4.2.6',
          cis_level: 'L2',
          cis_section: 'Security Profiles > Antivirus',
          config_key: 'antivirus profile sandbox-inline',
          expected_value: 'enable',
          audit_hint: 'config antivirus profile -> edit <profile> -> set sandbox-inline enable',
          remediation: 'Enable inline sandbox inspection to hold suspicious files while awaiting FortiSandbox execution analysis.',
          default_value: 'disable',
          cis_controls: ['v8 10.2', 'v7 8.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.2.7',
    vendor: 'fortigate',
    code: '4.2.7',
    title: 'CDR proxy mode',
    section: 'Security Profiles > Antivirus',
    category: 'Security Profiles',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Low',
    config_key: 'antivirus profile content-disarm',
    expected_value: 'enable (proxy mode)',
    audit_hint: 'config antivirus profile -> edit <profile> -> set content-disarm enable',
    remediation: 'Enable Content Disarm and Reconstruction (CDR) in proxy mode to strip active macros from documents.',
    default_value: 'disable',
    cis_controls: ['v8 10.2', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable Content Disarm and Reconstruction (CDR) in proxy mode to sanitize active content and macros from inbound files.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.security_profiles?.av?.cdr) {
        return {
          title: 'CDR proxy mode',
          description: 'Content Disarm and Reconstruction (CDR) is not enabled. Active content (macros, embedded scripts) in documents is not stripped.',
          category: 'Security Profiles',
          severity: 'Low',
          recommendation: 'Enable Content Disarm and Reconstruction (CDR) in proxy mode to sanitize active content and macros from inbound files.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: (config.security_profiles?.av?.profiles || []).length > 0 ? (config.security_profiles?.av?.profiles || []).map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Antivirus profiles with content-disarm enabled',
          system_check: 'auto',
          cis_code: '4.2.7',
          cis_level: 'L2',
          cis_section: 'Security Profiles > Antivirus',
          config_key: 'antivirus profile content-disarm',
          expected_value: 'enable (proxy mode)',
          audit_hint: 'config antivirus profile -> edit <profile> -> set content-disarm enable',
          remediation: 'Enable Content Disarm and Reconstruction (CDR) in proxy mode to strip active macros from documents.',
          default_value: 'disable',
          cis_controls: ['v8 10.2', 'v7 8.1']
        };
      }
      return null;
    }
  },

  // --- Section 4.3: DNS Filter ---
  {
    id: 'CIS-4.3.1',
    vendor: 'fortigate',
    code: '4.3.1',
    title: 'Botnet C&C Domain Blocking DNS Filter',
    section: 'Security Profiles > DNS Filter',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'dnsfilter profile block-botnet',
    expected_value: 'enable',
    audit_hint: 'config dnsfilter profile -> edit <profile> -> set block-botnet enable',
    remediation: 'Enable botnet C&C domain redirection/blocking in all DNS filter profiles.',
    default_value: 'disable',
    cis_controls: ['v8 13.5', 'v7 12.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable botnet command-and-control domain blocking in DNS filtering profiles to disrupt malware resolution.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const openDns = config.security_profiles?.dnsfilter?.filter(d => !d.redirect_botnet) || [];
      if (openDns.length > 0 || !config.security_profiles?.dnsfilter || config.security_profiles.dnsfilter.length === 0) {
        return {
          title: 'Botnet C&C Domain Blocking DNS Filter',
          description: 'DNS filter profile(s) do not block or redirect known botnet C&C domain queries.',
          category: 'Security Profiles',
          severity: 'High',
          recommendation: 'Enable botnet command-and-control domain blocking in DNS filtering profiles to disrupt malware resolution.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: openDns.length > 0 ? openDns.map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No DNS Filter profiles with block-botnet enabled',
          system_check: 'auto',
          cis_code: '4.3.1',
          cis_level: 'L1',
          cis_section: 'Security Profiles > DNS Filter',
          config_key: 'dnsfilter profile block-botnet',
          expected_value: 'enable',
          audit_hint: 'config dnsfilter profile -> edit <profile> -> set block-botnet enable',
          remediation: 'Enable botnet C&C domain redirection/blocking in all DNS filter profiles.',
          default_value: 'disable',
          cis_controls: ['v8 13.5', 'v7 12.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.3.2',
    vendor: 'fortigate',
    code: '4.3.2',
    title: 'DNS Filter logs all queries & responses',
    section: 'Security Profiles > DNS Filter',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'dnsfilter profile log-all-domain',
    expected_value: 'enable',
    audit_hint: 'config dnsfilter profile -> edit <profile> -> set log-all-domain enable',
    remediation: 'Enable log-all-domain in DNS filter profiles to log all DNS queries and resolution results.',
    default_value: 'disable',
    cis_controls: ['v8 8.2', 'v7 6.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable comprehensive logging of all DNS queries and responses in DNS filtering profiles for threat hunting.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const unloggedDns = config.security_profiles?.dnsfilter?.filter(d => !d.log_all_domain) || [];
      if (unloggedDns.length > 0) {
        return {
          title: 'DNS Filter logs all queries & responses',
          description: 'DNS filter profile(s) do not have log-all-domain enabled. Unblocked DNS traffic will not be recorded for forensic investigation.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Enable comprehensive logging of all DNS queries and responses in DNS filtering profiles for threat hunting.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: unloggedDns.length > 0 ? unloggedDns.map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No DNS Filter profiles with log-all-domain enabled',
          system_check: 'auto',
          cis_code: '4.3.2',
          cis_level: 'L1',
          cis_section: 'Security Profiles > DNS Filter',
          config_key: 'dnsfilter profile log-all-domain',
          expected_value: 'enable',
          audit_hint: 'config dnsfilter profile -> edit <profile> -> set log-all-domain enable',
          remediation: 'Enable log-all-domain in DNS filter profiles to log all DNS queries and resolution results.',
          default_value: 'disable',
          cis_controls: ['v8 8.2', 'v7 6.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.3.3',
    vendor: 'fortigate',
    code: '4.3.3',
    title: 'Apply DNS Filter to Policies',
    section: 'Security Profiles > DNS Filter',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'firewall policy dnsfilter-profile',
    expected_value: 'All outbound internet policies have dnsfilter-profile',
    audit_hint: 'config firewall policy -> check set dnsfilter-profile on outbound rules',
    remediation: 'Attach DNS filter profiles to all firewall allow rules permitting outbound DNS or internet access.',
    default_value: 'none assigned',
    cis_controls: ['v8 13.5', 'v7 12.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Attach DNS filtering profiles to all outbound internet policies to intercept malicious domain lookups at the perimeter.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const noDns = config.firewall_rules.filter(r => r.enabled && r.action === 'accept' && r.service && r.service.some(s => ['DNS', 'ALL', 'DNS-UDP', 'DNS-TCP'].includes(s.toUpperCase())) && (!r.profiles || (!r.profiles.some(p => p.includes('dns')) && !r.dnsfilter_profile)));
      if (noDns.length > 0) {
        return {
          title: 'Apply DNS Filter to Policies',
          description: `Found ${noDns.length} allow policy(ies) (${noDns.map(r => `ID ${r.id}: "${r.name}"`).join(', ')}) permitting DNS traffic without a DNS filtering profile attached.`,
          category: 'Security Profiles',
          severity: 'High',
          recommendation: 'Attach DNS filtering profiles to all outbound internet policies to intercept malicious domain lookups at the perimeter.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: noDns.map(r => r.raw_snippet || '# Configuration missing').join('\n'),
          system_check: 'auto',
          cis_code: '4.3.3',
          cis_level: 'L1',
          cis_section: 'Security Profiles > DNS Filter',
          config_key: 'firewall policy dnsfilter-profile',
          expected_value: 'All outbound internet policies have dnsfilter-profile',
          audit_hint: 'config firewall policy -> check set dnsfilter-profile on outbound rules',
          remediation: 'Attach DNS filter profiles to all firewall allow rules permitting outbound DNS or internet access.',
          default_value: 'none assigned',
          cis_controls: ['v8 13.5', 'v7 12.4']
        };
      }
      return null;
    }
  },

  // --- Section 4.4: Web Filtering ---
  {
    id: 'CIS-4.4.1',
    vendor: 'fortigate',
    code: '4.4.1',
    title: 'Create a Web Filtering Profile',
    section: 'Security Profiles > Web Filtering',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'webfilter profile',
    expected_value: 'Active web filter profile blocking known security risk categories (malware, phishing)',
    audit_hint: 'config webfilter profile -> show',
    remediation: 'Configure web filtering profiles to block known security risk categories (malware, phishing, spam URLs).',
    default_value: 'unconfigured',
    cis_controls: ['v8 9.2', 'v7 8.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure and apply Web Filtering profiles to block access to malicious, phishing, and command-and-control websites.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const wf = config.security_profiles?.webfilter || [];
      if (wf.length === 0 || wf.every(w => !w.blocks_malicious)) {
        return {
          title: 'Create a Web Filtering Profile',
          description: 'No active web filtering profile found blocking security risk categories.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Configure and apply Web Filtering profiles to block access to malicious, phishing, and command-and-control websites.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config webfilter profile'),
          system_check: 'auto',
          cis_code: '4.4.1',
          cis_level: 'L1',
          cis_section: 'Security Profiles > Web Filtering',
          config_key: 'webfilter profile',
          expected_value: 'Active web filter profile blocking known security risk categories (malware, phishing)',
          audit_hint: 'config webfilter profile -> show',
          remediation: 'Configure web filtering profiles to block known security risk categories (malware, phishing, spam URLs).',
          default_value: 'unconfigured',
          cis_controls: ['v8 9.2', 'v7 8.1']
        };
      }
      return null;
    }
  },

  // --- Section 4.5: Application Control ---
  {
    id: 'CIS-4.5.1',
    vendor: 'fortigate',
    code: '4.5.1',
    title: 'Block high risk categories',
    section: 'Security Profiles > Application Control',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'application list category block',
    expected_value: 'Block on proxy, P2P, botnet, high-risk remote access',
    audit_hint: 'config application list -> edit <list> -> check block on high risk categories',
    remediation: 'Configure application control profiles to block high-risk categories (P2P, proxy/anonymizers, botnet).',
    default_value: 'monitor / allow',
    cis_controls: ['v8 2.5', 'v7 2.6'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure Application Control profiles to actively block high-risk application categories (P2P, anonymizers, botnets).',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const openApp = config.security_profiles?.app?.filter(a => !a.block_high_risk) || [];
      if (openApp.length > 0 || !config.security_profiles?.app || config.security_profiles.app.length === 0) {
        return {
          title: 'Block high risk categories',
          description: 'Application control profile(s) do not block high-risk application categories such as P2P networks and proxy/anonymizers.',
          category: 'Security Profiles',
          severity: 'High',
          recommendation: 'Configure Application Control profiles to actively block high-risk application categories (P2P, anonymizers, botnets).',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: openApp.length > 0 ? openApp.map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Application Control profiles blocking high risk apps',
          system_check: 'auto',
          cis_code: '4.5.1',
          cis_level: 'L1',
          cis_section: 'Security Profiles > Application Control',
          config_key: 'application list category block',
          expected_value: 'Block on proxy, P2P, botnet, high-risk remote access',
          audit_hint: 'config application list -> edit <list> -> check block on high risk categories',
          remediation: 'Configure application control profiles to block high-risk categories (P2P, proxy/anonymizers, botnet).',
          default_value: 'monitor / allow',
          cis_controls: ['v8 2.5', 'v7 2.6']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.5.2',
    vendor: 'fortigate',
    code: '4.5.2',
    title: 'Block apps on non-default ports',
    section: 'Security Profiles > Application Control',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'application list enforce-default-app-port',
    expected_value: 'enable',
    audit_hint: 'config application list -> edit <list> -> set enforce-default-app-port enable',
    remediation: 'Enable enforce-default-app-port in application control profiles to prevent protocol port evasion.',
    default_value: 'disable',
    cis_controls: ['v8 12.2', 'v7 14.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable default application port enforcement in Application Control profiles to prevent protocol port evasion.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const openPort = config.security_profiles?.app?.filter(a => !a.enforce_default_app_port) || [];
      if (openPort.length > 0) {
        return {
          title: 'Block apps on non-default ports',
          description: 'enforce-default-app-port is disabled on application profile(s). Applications running on non-standard ports (e.g. SSH over port 80) will not be restricted.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Enable default application port enforcement in Application Control profiles to prevent protocol port evasion.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: openPort.length > 0 ? openPort.map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Application Control profiles enforcing default port',
          system_check: 'auto',
          cis_code: '4.5.2',
          cis_level: 'L1',
          cis_section: 'Security Profiles > Application Control',
          config_key: 'application list enforce-default-app-port',
          expected_value: 'enable',
          audit_hint: 'config application list -> edit <list> -> set enforce-default-app-port enable',
          remediation: 'Enable enforce-default-app-port in application control profiles to prevent protocol port evasion.',
          default_value: 'disable',
          cis_controls: ['v8 12.2', 'v7 14.1']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.5.3',
    vendor: 'fortigate',
    code: '4.5.3',
    title: 'All App Control traffic logged',
    section: 'Security Profiles > Application Control',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'application list log',
    expected_value: 'enable (log all app control events)',
    audit_hint: 'config application list -> edit <list> -> set log enable',
    remediation: 'Enable logging for all allowed and blocked application traffic in application control lists.',
    default_value: 'disable',
    cis_controls: ['v8 8.2', 'v7 6.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable logging for all application traffic in Application Control profiles to maintain complete application visibility.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const unloggedApp = config.security_profiles?.app?.filter(a => !a.log_all) || [];
      if (unloggedApp.length > 0) {
        return {
          title: 'All App Control traffic logged',
          description: 'Application control profile(s) do not have comprehensive logging enabled.',
          category: 'Security Profiles',
          severity: 'Medium',
          recommendation: 'Enable logging for all application traffic in Application Control profiles to maintain complete application visibility.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: unloggedApp.length > 0 ? unloggedApp.map(p => p.raw_snippet || '# Configuration missing').join('\n') : '# No Application Control profiles with logging enabled',
          system_check: 'auto',
          cis_code: '4.5.3',
          cis_level: 'L1',
          cis_section: 'Security Profiles > Application Control',
          config_key: 'application list log',
          expected_value: 'enable (log all app control events)',
          audit_hint: 'config application list -> edit <list> -> set log enable',
          remediation: 'Enable logging for all allowed and blocked application traffic in application control lists.',
          default_value: 'disable',
          cis_controls: ['v8 8.2', 'v7 6.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-4.5.4',
    vendor: 'fortigate',
    code: '4.5.4',
    title: 'Apply App Control to Policies',
    section: 'Security Profiles > Application Control',
    category: 'Security Profiles',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'firewall policy application-list',
    expected_value: 'All outbound internet policies have application-list',
    audit_hint: 'config firewall policy -> check set application-list on outbound rules',
    remediation: 'Attach application control profiles to all firewall allow policies permitting user or internet traffic.',
    default_value: 'none assigned',
    cis_controls: ['v8 2.5', 'v7 2.6'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Apply Application Control profiles to all user outbound firewall allow policies to restrict unauthorized software usage.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const noApp = config.firewall_rules.filter(r => r.enabled && r.action === 'accept' && r.service && r.service.some(s => ['HTTP', 'HTTPS', 'ALL', 'TCP', 'UDP'].includes(s.toUpperCase())) && (!r.profiles || (!r.profiles.some(p => p.includes('app')) && !r.app_profile)));
      if (noApp.length > 0) {
        return {
          title: 'Apply App Control to Policies',
          description: `Found ${noApp.length} allow policy(ies) (${noApp.map(r => `ID ${r.id}: "${r.name}"`).join(', ')}) permitting internet/user traffic without an Application Control profile attached.`,
          category: 'Security Profiles',
          severity: 'High',
          recommendation: 'Apply Application Control profiles to all user outbound firewall allow policies to restrict unauthorized software usage.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: noApp.map(r => r.raw_snippet || '# Configuration missing').join('\n'),
          system_check: 'auto',
          cis_code: '4.5.4',
          cis_level: 'L1',
          cis_section: 'Security Profiles > Application Control',
          config_key: 'firewall policy application-list',
          expected_value: 'All outbound internet policies have application-list',
          audit_hint: 'config firewall policy -> check set application-list on outbound rules',
          remediation: 'Attach application control profiles to all firewall allow policies permitting user or internet traffic.',
          default_value: 'none assigned',
          cis_controls: ['v8 2.5', 'v7 2.6']
        };
      }
      return null;
    }
  },

  // --- Section 5: Security Fabric ---
  {
    id: 'CIS-5.1.1',
    vendor: 'fortigate',
    code: '5.1.1',
    title: 'Enable Compromised Host Quarantine',
    section: 'Security Fabric',
    category: 'Security Fabric',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'system automation-stitch (quarantine)',
    expected_value: 'Security Fabric automation stitch for host quarantine is configured',
    audit_hint: 'config system automation-stitch -> check action quarantine',
    remediation: 'Create a Security Fabric automation stitch configured to quarantine compromised endpoints upon IoC detection.',
    default_value: 'disabled / unconfigured',
    cis_controls: ['v8 13.10', 'v7 12.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure automated quarantine response stitches in Security Fabric to immediately isolate infected network hosts.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.security_fabric?.quarantine_stitch_enabled) {
        return {
          title: 'Enable Compromised Host Quarantine',
          description: 'No automated quarantine stitch found in Security Fabric settings. Automated containment of compromised hosts reduces dwell time.',
          category: 'Security Fabric',
          severity: 'Medium',
          recommendation: 'Configure automated quarantine response stitches in Security Fabric to immediately isolate infected network hosts.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system automation-stitch'),
          system_check: 'auto',
          cis_code: '5.1.1',
          cis_level: 'L2',
          cis_section: 'Security Fabric',
          config_key: 'system automation-stitch (quarantine)',
          expected_value: 'Security Fabric automation stitch for host quarantine is configured',
          audit_hint: 'config system automation-stitch -> check action quarantine',
          remediation: 'Create a Security Fabric automation stitch configured to quarantine compromised endpoints upon IoC detection.',
          default_value: 'disabled / unconfigured',
          cis_controls: ['v8 13.10', 'v7 12.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-5.2.1.1',
    vendor: 'fortigate',
    code: '5.2.1.1',
    title: 'Ensure Security Fabric is Configured',
    section: 'Security Fabric',
    category: 'Security Fabric',
    cis_level: 'L2',
    cis_status: 'Manual',
    system_check: 'semi',
    severity: 'Low',
    config_key: 'system csf status',
    expected_value: 'status enable on root or downstream fabric',
    audit_hint: 'config system csf -> set status enable',
    remediation: 'Enable Security Fabric (csf) to integrate FortiGate with downstream switches, APs, and FortiAnalyzer.',
    default_value: 'disable',
    cis_controls: ['v8 1.1', 'v7 1.1'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable and configure Fortinet Security Fabric to share threat intelligence across integrated security architecture.',
    compliance_tags: ['CIS FortiGate'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.security_fabric?.root_fabric_enabled) {
        return {
          title: 'Ensure Security Fabric is Configured',
          description: 'Security Fabric is disabled. Requires auditor verification of enterprise telemetry sharing requirements.',
          category: 'Security Fabric',
          severity: 'Low',
          recommendation: 'Enable and configure Fortinet Security Fabric to share threat intelligence across integrated security architecture.',
          compliance_tags: ['CIS FortiGate'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config system csf'),
          system_check: 'semi',
          cis_code: '5.2.1.1',
          cis_level: 'L2',
          cis_section: 'Security Fabric',
          config_key: 'system csf status',
          expected_value: 'status enable on root or downstream fabric',
          audit_hint: 'config system csf -> set status enable',
          remediation: 'Enable Security Fabric (csf) to integrate FortiGate with downstream switches, APs, and FortiAnalyzer.',
          default_value: 'disable',
          cis_controls: ['v8 1.1', 'v7 1.1']
        };
      }
      return null;
    }
  },

  // --- Section 6: VPN ---
  {
    id: 'CIS-6.1.1',
    vendor: 'fortigate',
    code: '6.1.1',
    title: 'Trusted Signed Cert for VPN Portal',
    section: 'VPN',
    category: 'VPN Security',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'vpn ssl settings servercert',
    expected_value: 'CA-signed certificate (not Fortinet_Factory)',
    audit_hint: 'config vpn ssl settings -> check set servercert',
    remediation: 'Install and select a valid CA-signed server certificate for SSL VPN portals.',
    default_value: 'Fortinet_Factory',
    cis_controls: ['v8 3.10', 'v7 14.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Install a trusted CA-signed SSL certificate for SSL VPN portals to prevent man-in-the-middle interception.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const cert = config.vpn.ssl_server_certificate;
      if (cert === 'Fortinet_Factory' || !cert) {
        return {
          title: 'Trusted Signed Cert for VPN Portal',
          description: `SSL VPN portal uses factory self-signed certificate ("${cert || 'Fortinet_Factory'}"). Clients cannot verify portal authenticity, enabling MITM attacks.`,
          category: 'VPN Security',
          severity: 'High',
          recommendation: 'Install a trusted CA-signed SSL certificate for SSL VPN portals to prevent man-in-the-middle interception.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config vpn ssl settings'),
          system_check: 'auto',
          cis_code: '6.1.1',
          cis_level: 'L1',
          cis_section: 'VPN',
          config_key: 'vpn ssl settings servercert',
          expected_value: 'CA-signed certificate (not Fortinet_Factory)',
          audit_hint: 'config vpn ssl settings -> check set servercert',
          remediation: 'Install and select a valid CA-signed server certificate for SSL VPN portals.',
          default_value: 'Fortinet_Factory',
          cis_controls: ['v8 3.10', 'v7 14.4']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-6.1.2',
    vendor: 'fortigate',
    code: '6.1.2',
    title: 'Limited TLS Versions for SSL VPN',
    section: 'VPN',
    category: 'VPN Security',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'vpn ssl settings ssl-max/min-proto-ver',
    expected_value: 'min-proto-ver tls1-2, max-proto-ver tls1-3',
    audit_hint: 'config vpn ssl settings -> set ssl-min-proto-ver tls1-2, set ssl-max-proto-ver tls1-3',
    remediation: 'Configure SSL VPN to allow only TLS 1.2 and TLS 1.3 protocol versions.',
    default_value: 'tls1-1 / tls1-2',
    cis_controls: ['v8 3.10', 'v7 14.4'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Restrict SSL VPN negotiation to TLS 1.2 and TLS 1.3 exclusively to prevent cryptographic downgrade attacks.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      const minV = config.vpn.ssl_min_tls_version || 'tls1-1';
      if (minV.toLowerCase() === 'tls1-0' || minV.toLowerCase() === 'tls1-1' || minV.toLowerCase() === 'ssl3') {
        return {
          title: 'Limited TLS Versions for SSL VPN',
          description: `SSL VPN minimum TLS version permitted is "${minV}". Deprecated TLS protocols are vulnerable to known decryption exploits.`,
          category: 'VPN Security',
          severity: 'High',
          recommendation: 'Restrict SSL VPN negotiation to TLS 1.2 and TLS 1.3 exclusively to prevent cryptographic downgrade attacks.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config vpn ssl settings'),
          system_check: 'auto',
          cis_code: '6.1.2',
          cis_level: 'L1',
          cis_section: 'VPN',
          config_key: 'vpn ssl settings ssl-max/min-proto-ver',
          expected_value: 'min-proto-ver tls1-2, max-proto-ver tls1-3',
          audit_hint: 'config vpn ssl settings -> set ssl-min-proto-ver tls1-2, set ssl-max-proto-ver tls1-3',
          remediation: 'Configure SSL VPN to allow only TLS 1.2 and TLS 1.3 protocol versions.',
          default_value: 'tls1-1 / tls1-2',
          cis_controls: ['v8 3.10', 'v7 14.4']
        };
      }
      return null;
    }
  },

  // --- Section 7: Logs and Reports ---
  {
    id: 'CIS-7.1.1',
    vendor: 'fortigate',
    code: '7.1.1',
    title: 'Enable Event Logging',
    section: 'Logs & Reports',
    category: 'Logging & Monitoring',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'log eventfilter event',
    expected_value: 'event enable (system, vpn, user, router, ha)',
    audit_hint: 'config log eventfilter -> set event enable',
    remediation: 'Enable event logging across all categories (system, vpn, user, router, ha) in eventfilter settings.',
    default_value: 'enable (varies)',
    cis_controls: ['v8 8.2', 'v7 6.2'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable comprehensive event logging (system, vpn, user authentication, HA) to maintain situational awareness and accountability.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (config.logging.event_logging_enabled === false || (!config.logging.traffic_log && !config.logging.security_log)) {
        return {
          title: 'Enable Event Logging',
          description: 'Event logging is disabled or incomplete. Without event logs, authentication failures and system configuration changes are not recorded.',
          category: 'Logging & Monitoring',
          severity: 'High',
          recommendation: 'Enable comprehensive event logging (system, vpn, user authentication, HA) to maintain situational awareness and accountability.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config log eventfilter'),
          system_check: 'auto',
          cis_code: '7.1.1',
          cis_level: 'L1',
          cis_section: 'Logs & Reports',
          config_key: 'log eventfilter event',
          expected_value: 'event enable (system, vpn, user, router, ha)',
          audit_hint: 'config log eventfilter -> set event enable',
          remediation: 'Enable event logging across all categories (system, vpn, user, router, ha) in eventfilter settings.',
          default_value: 'enable (varies)',
          cis_controls: ['v8 8.2', 'v7 6.2']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-7.2.1',
    vendor: 'fortigate',
    code: '7.2.1',
    title: 'Centralized Logging & Reporting',
    section: 'Logs & Reports',
    category: 'Logging & Monitoring',
    cis_level: 'L1',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'High',
    config_key: 'log syslogd/fortianalyzer setting status',
    expected_value: 'status enable (at least 1 active remote log destination)',
    audit_hint: 'config log syslogd setting -> set status enable, set server <ip>',
    remediation: 'Configure at least one centralized remote logging target (Syslog server or FortiAnalyzer).',
    default_value: 'disable',
    cis_controls: ['v8 8.10', 'v7 6.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Configure centralized remote logging (Syslog or FortiAnalyzer) to ensure log immutability and off-device retention.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
    active: true,
    check: (config: NormalizedConfig) => {
      if (!config.logging.remote_log_enabled || !config.logging.remote_targets || config.logging.remote_targets.length === 0) {
        return {
          title: 'Centralized Logging & Reporting',
          description: 'No centralized remote logging server is configured. Local device logs can be lost during hardware failure or deleted by attackers.',
          category: 'Logging & Monitoring',
          severity: 'High',
          recommendation: 'Configure centralized remote logging (Syslog or FortiAnalyzer) to ensure log immutability and off-device retention.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF', 'ISO 27001'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config log syslogd setting'),
          system_check: 'auto',
          cis_code: '7.2.1',
          cis_level: 'L1',
          cis_section: 'Logs & Reports',
          config_key: 'log syslogd/fortianalyzer setting status',
          expected_value: 'status enable (at least 1 active remote log destination)',
          audit_hint: 'config log syslogd setting -> set status enable, set server <ip>',
          remediation: 'Configure at least one centralized remote logging target (Syslog server or FortiAnalyzer).',
          default_value: 'disable',
          cis_controls: ['v8 8.10', 'v7 6.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-7.3.1',
    vendor: 'fortigate',
    code: '7.3.1',
    title: 'Encrypt logs to FortiAnalyzer/FortiManager',
    section: 'Logs & Reports',
    category: 'Logging & Monitoring',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'log fortianalyzer setting enc-algorithm',
    expected_value: 'reliable enable, enc-algorithm high',
    audit_hint: 'config log fortianalyzer setting -> set reliable enable, set enc-algorithm high',
    remediation: 'Set reliable transmission and high encryption algorithm on FortiAnalyzer log settings.',
    default_value: 'reliable disable, enc-algorithm high/low',
    cis_controls: ['v8 8.10', 'v7 6.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enable reliable transport and high encryption for log transmission to FortiAnalyzer to prevent log eavesdropping or tampering.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const faz = config.logging.fortianalyzer;
      if (faz?.enabled && (!faz.reliable || faz.enc_algorithm !== 'high')) {
        return {
          title: 'Encrypt logs to FortiAnalyzer/FortiManager',
          description: 'FortiAnalyzer logging is active without reliable transport or high encryption algorithm enabled.',
          category: 'Logging & Monitoring',
          severity: 'Medium',
          recommendation: 'Enable reliable transport and high encryption for log transmission to FortiAnalyzer to prevent log eavesdropping or tampering.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config log fortianalyzer setting'),
          system_check: 'auto',
          cis_code: '7.3.1',
          cis_level: 'L2',
          cis_section: 'Logs & Reports',
          config_key: 'log fortianalyzer setting enc-algorithm',
          expected_value: 'reliable enable, enc-algorithm high',
          audit_hint: 'config log fortianalyzer setting -> set reliable enable, set enc-algorithm high',
          remediation: 'Set reliable transmission and high encryption algorithm on FortiAnalyzer log settings.',
          default_value: 'reliable disable, enc-algorithm high/low',
          cis_controls: ['v8 8.10', 'v7 6.5']
        };
      }
      return null;
    }
  },
  {
    id: 'CIS-7.3.2',
    vendor: 'fortigate',
    code: '7.3.2',
    title: 'Encrypt logs to Syslog (includes 7.3.3)',
    section: 'Logs & Reports',
    category: 'Logging & Monitoring',
    cis_level: 'L2',
    cis_status: 'Automated',
    system_check: 'auto',
    severity: 'Medium',
    config_key: 'log syslogd setting reliable / enc-algorithm',
    expected_value: 'reliable enable, enc-algorithm high/default (TLS)',
    audit_hint: 'config log syslogd setting -> set reliable enable, set enc-algorithm high',
    remediation: 'Configure Syslog transmission over reliable TCP/TLS with encryption enabled (combines CIS 7.3.2 and 7.3.3).',
    default_value: 'reliable disable (UDP)',
    cis_controls: ['v8 8.10', 'v7 6.5'],
    benchmark_ref: 'CIS FortiGate 7.4.x v1.0.1',
    applies_to: ['fortigate', 'common'],
    recommendation: 'Enforce reliable encrypted transport (TCP/TLS) for remote Syslog transmission to ensure log confidentiality and delivery.',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    active: true,
    check: (config: NormalizedConfig) => {
      const sys = config.logging.syslog;
      if (config.logging.remote_log_enabled && (!sys?.reliable || sys?.enc_algorithm === 'disable')) {
        return {
          title: 'Encrypt logs to Syslog (includes 7.3.3)',
          description: 'Syslog transmission is not configured with reliable encrypted transport. Cleartext UDP syslog can be spoofed or intercepted.',
          category: 'Logging & Monitoring',
          severity: 'Medium',
          recommendation: 'Enforce reliable encrypted transport (TCP/TLS) for remote Syslog transmission to ensure log confidentiality and delivery.',
          compliance_tags: ['CIS FortiGate', 'NIST CSF'],
          is_manual: false,
          evidence_snippet: extractSnippet(config, 'config log syslogd setting'),
          system_check: 'auto',
          cis_code: '7.3.2',
          cis_level: 'L2',
          cis_section: 'Logs & Reports',
          config_key: 'log syslogd setting reliable / enc-algorithm',
          expected_value: 'reliable enable, enc-algorithm high/default (TLS)',
          audit_hint: 'config log syslogd setting -> set reliable enable, set enc-algorithm high',
          remediation: 'Configure Syslog transmission over reliable TCP/TLS with encryption enabled (combines CIS 7.3.2 and 7.3.3).',
          default_value: 'reliable disable (UDP)',
          cis_controls: ['v8 8.10', 'v7 6.5']
        };
      }
      return null;
    }
  }
];
