import { FindingStatus, Severity } from './audit';

export type FrameworkCode = 'CIS' | 'NIST_CSF' | 'NIST_800_41' | 'ISO_27001' | 'PCI_DSS' | 'CTM';

export type ControlCoverageType = 'automated' | 'partial' | 'manual' | 'not_covered';

export type ControlStatus = 'Compliant' | 'Non-Compliant' | 'Needs Review' | 'Not Applicable' | 'Not Covered';

export interface FrameworkControl {
  id?: string;
  framework_code: FrameworkCode;
  control_code: string;
  title: string;
  category: string;
  description?: string;
  coverage_type: ControlCoverageType;
  guidance?: string;
}

export interface Framework {
  id?: string;
  code: FrameworkCode;
  name: string;
  version: string;
  description?: string;
  is_technical: boolean;
  active: boolean;
  controls: FrameworkControl[];
}

export interface ControlRuleMapping {
  id?: string;
  framework_code: FrameworkCode;
  control_code: string;
  rule_code: string;
  rule_vendor: string;
  mapping_strength: 'full' | 'partial';
  note?: string;
}

export interface MappedRuleEvidence {
  rule_id: string;
  rule_code: string;
  title: string;
  severity: Severity;
  status: FindingStatus;
  penalty_score: number;
  description?: string;
  remediation?: string;
  evidence_snippet?: string;
  audit_procedure?: string;
  remediation_procedure?: string;
}

export interface EvaluatedFrameworkControl extends FrameworkControl {
  status: ControlStatus;
  mapped_rules: MappedRuleEvidence[];
  failed_count: number;
  passed_count: number;
}

export interface AuditFrameworkResult {
  id?: string;
  audit_id: string;
  framework_code: FrameworkCode;
  framework_name: string;
  score: number;
  covered_controls: number;
  total_controls: number;
  coverage_percent: number;
  controls: EvaluatedFrameworkControl[];
  category_breakdown: {
    category: string;
    total: number;
    passed: number;
    failed: number;
    needs_review: number;
    score: number;
  }[];
}
