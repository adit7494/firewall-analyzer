import { NormalizedConfig } from './normalized-config';

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';

export type FindingStatus = 'open' | 'accepted_risk' | 'false_positive' | 'resolved' | 'not_applicable' | 'pending_confirmation';

export type RuleCategory = 
  | 'Access Control' 
  | 'Management Hardening' 
  | 'Logging & Monitoring' 
  | 'Firewall Rulebase' 
  | 'VPN Security' 
  | 'Network Segmentation'
  | 'Network Settings'
  | 'System Settings'
  | 'Password Policy'
  | 'SNMP'
  | 'Administrators'
  | 'High Availability'
  | 'Policy & Objects'
  | 'Security Profiles'
  | 'Security Fabric'
  | 'VPN'
  | 'Logs & Reports';

export type ComplianceStandard = 
  | 'CIS FortiGate' 
  | 'NIST CSF' 
  | 'NIST SP 800-41' 
  | 'ISO 27001' 
  | 'Cyber Trust Mark';

export interface AuditRule {
  id: string;
  title: string;
  applies_to: string[]; // ['common'] or ['fortigate'], ['sonicwall']
  category: RuleCategory;
  severity: Severity;
  check: (config: NormalizedConfig) => Omit<Finding, 'id' | 'audit_id' | 'rule_id' | 'status' | 'created_at' | 'penalty_score'> | null;
  recommendation: string;
  compliance_tags: ComplianceStandard[];
  // CIS attributes for multi-vendor rule set
  vendor?: string;
  code?: string;
  section?: string;
  cis_level?: 'L1' | 'L2';
  cis_status?: 'Automated' | 'Manual';
  system_check?: 'auto' | 'semi' | 'manual';
  config_key?: string;
  expected_value?: string;
  audit_hint?: string;
  remediation?: string;
  default_value?: string;
  cis_controls?: string[];
  benchmark_ref?: string;
  active?: boolean;
  rationale?: string;
  impact?: string;
  audit_procedure?: string;
  remediation_procedure?: string;
  references?: string[];
  references_json?: string[];
}

export interface Finding {
  id: string;
  audit_id: string;
  rule_id: string;
  title: string;
  description: string;
  category: RuleCategory;
  severity: Severity;
  evidence_snippet?: string;
  recommendation: string;
  compliance_tags: ComplianceStandard[];
  status: FindingStatus;
  auditor_note?: string;
  is_manual: boolean;
  created_at: string;
  penalty_score: number;
  // CIS attributes
  system_check?: 'auto' | 'semi' | 'manual';
  cis_code?: string;
  cis_level?: 'L1' | 'L2';
  cis_section?: string;
  config_key?: string;
  expected_value?: string;
  audit_hint?: string;
  remediation?: string;
  default_value?: string;
  cis_controls?: string[];
  rationale?: string;
  impact?: string;
  audit_procedure?: string;
  remediation_procedure?: string;
  references?: string[];
  references_json?: string[];
  // AI evaluation fields
  ai_evaluated?: boolean;   // true when this finding was produced by the AI engine
  ai_reason?: string;       // natural-language explanation returned by the AI
}

export interface CategoryScore {
  category: RuleCategory;
  score: number;
  max_score: number;
}

export type AuditGrade = 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';

export interface AuditResult {
  id: string;
  company_id: string;
  device_id: string;
  vendor: string;
  config_file_name: string;
  status: 'queued' | 'parsing' | 'in_progress' | 'done' | 'failed';
  score: number;
  grade: AuditGrade;
  created_by: string;
  created_at: string;
  findings: Finding[];
  breakdown: CategoryScore[];
  rules_analyzed: number;
  controls_checked: number;
  // CIS attributes
  profile_level?: 'L1' | 'L1_L2';
  score_breakdown?: Record<string, { score: number; total: number; passed: number; failed: number }>;
}

export interface Device {
  id: string;
  company_id: string;
  vendor: string;
  model: string;
  os_version: string;
  hostname: string;
  serial: string;
  ha_status: string;
  location: string;
  last_backup_date: string;
  last_audit_date?: string;
  latest_score?: number;
  latest_grade?: AuditGrade;
}

export interface Company {
  id: string;
  name: string;
  contact_person: string;
  contact_email: string;
  industry: string;
  notes: string;
  created_at: string;
  devices_count: number;
  latest_score: number;
  latest_grade: AuditGrade;
  open_findings_count: number;
  avatar_initials: string;
}

export interface Report {
  id: string;
  audit_id: string;
  company_id: string;
  company_name: string;
  device_name: string;
  type: 'Technical' | 'Executive' | 'Monthly';
  score: number;
  grade: AuditGrade;
  created_at: string;
  finalized: boolean;
  snapshot?: AuditResult;
}
