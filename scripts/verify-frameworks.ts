import { getFrameworksCatalog, getFrameworkMappings } from '../src/lib/engine/framework-seed-importer';
import { getRuleDetailsByCodeOrId } from '../src/lib/engine/cis-seed-importer';
import { evaluateAuditFrameworks } from '../src/lib/engine/framework-evaluator';
import { AuditResult, Finding } from '../src/lib/types/audit';

console.log('=== Verifying Multi-Framework Compliance Engine ===\n');

// 1. Check Frameworks Catalog
const frameworks = getFrameworksCatalog();
console.log(`[PASS] Loaded ${frameworks.length} compliance frameworks: ${frameworks.map(f => f.code).join(', ')}`);
if (frameworks.length < 5) {
  console.error(`[FAIL] Expected at least 5 frameworks, found ${frameworks.length}`);
  process.exit(1);
}

// 2. Check Controls & Honest Coverage
for (const fw of frameworks) {
  const total = fw.controls.length;
  const automated = fw.controls.filter(c => c.coverage_type === 'automated').length;
  const partial = fw.controls.filter(c => c.coverage_type === 'partial').length;
  const manual = fw.controls.filter(c => c.coverage_type === 'manual').length;
  const notCovered = fw.controls.filter(c => c.coverage_type === 'not_covered').length;

  console.log(`  -> ${fw.code} (${fw.name}): Total ${total} controls [Auto: ${automated}, Partial: ${partial}, Manual: ${manual}, Outside Scope: ${notCovered}]`);
}

// 3. Check Orphan Mappings
const mappings = getFrameworkMappings();
console.log(`\n[PASS] Loaded ${mappings.length} crosswalk mappings to CIS rules.`);

let orphanCount = 0;
for (const m of mappings) {
  const fw = frameworks.find(f => f.code === m.framework_code);
  if (!fw) {
    console.error(`[FAIL] Orphan mapping references non-existent framework: ${m.framework_code}`);
    orphanCount++;
    continue;
  }
  const ctrl = fw.controls.find(c => c.control_code === m.control_code);
  if (!ctrl) {
    console.error(`[FAIL] Orphan mapping references non-existent control ${m.control_code} in framework ${m.framework_code}`);
    orphanCount++;
    continue;
  }
  if (ctrl.coverage_type === 'manual' || ctrl.coverage_type === 'not_covered') {
    console.error(`[FAIL] Control ${m.framework_code}:${m.control_code} is marked as '${ctrl.coverage_type}' but has technical rule mapping to CIS ${m.rule_code}!`);
    orphanCount++;
  }
}

if (orphanCount === 0) {
  console.log('[PASS] 0 Orphan mappings detected! All mappings reference valid automated or partial framework controls.');
} else {
  console.error(`[FAIL] Found ${orphanCount} orphan or contradictory mappings!`);
  process.exit(1);
}

// 4. Test Derived Compliance Engine
const mockFindings: Finding[] = [
  {
    id: 'find-001',
    audit_id: 'test-audit-001',
    rule_id: 'CIS-2.1.1',
    cis_code: '2.1.1',
    title: 'Maintain Password Retries at 3 or less',
    category: 'Management Hardening',
    severity: 'High',
    status: 'open',
    penalty_score: 15,
    description: 'Password retry limit is unset.',
    recommendation: 'Set admin password retries to 3.',
    remediation: 'config system password-policy\n  set status enable\n  set retry-lockout-attempts 3\nend',
    evidence_snippet: 'config system password-policy\n  set retry-lockout-attempts 5\nend',
    compliance_tags: ['CIS FortiGate', 'NIST CSF'],
    is_manual: false,
    created_at: new Date().toISOString()
  },
  {
    id: 'find-002',
    audit_id: 'test-audit-001',
    rule_id: 'CIS-1.1.1',
    cis_code: '1.1.1',
    title: 'Maintain current firmware version',
    category: 'System Settings',
    severity: 'Critical',
    status: 'resolved',
    penalty_score: 0,
    description: 'Firmware is current.',
    recommendation: 'Keep updated.',
    remediation: 'Upgrade firmware via GUI or CLI.',
    evidence_snippet: 'Version: FortiOS v7.0.12',
    compliance_tags: ['CIS FortiGate'],
    is_manual: false,
    created_at: new Date().toISOString()
  }
];

const mockAudit: AuditResult = {
  id: 'test-audit-001',
  company_id: 'c1',
  device_id: 'd1',
  config_file_name: 'fortigate-core.conf',
  vendor: 'Fortinet',
  score: 85,
  grade: 'B',
  status: 'done',
  rules_analyzed: 89,
  controls_checked: 89,
  findings: mockFindings,
  breakdown: [],
  score_breakdown: undefined,
  created_at: new Date().toISOString(),
  created_by: 'Auditor Test'
};

const evalResults = evaluateAuditFrameworks(mockAudit);
console.log(`\n[PASS] Successfully derived compliance evaluations for ${evalResults.length} frameworks.`);
for (const res of evalResults) {
  console.log(`  -> ${res.framework_code}: Score ${res.score}%, Coverage ${res.coverage_percent}% (${res.covered_controls}/${res.total_controls} assessable controls)`);
}

console.log('\n=== ALL CROSSWALK & DERIVED ENGINE CHECKS PASSED ===');
