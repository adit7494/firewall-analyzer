import { AuditResult, Finding, FindingStatus } from '../types/audit';
import { 
  Framework, 
  FrameworkCode, 
  AuditFrameworkResult, 
  EvaluatedFrameworkControl, 
  MappedRuleEvidence,
  ControlStatus
} from '../types/framework';
import { getFrameworksCatalog, getMappingsForControl } from './framework-seed-importer';
import { getRuleDetailsByCodeOrId } from './cis-seed-importer';
import { normalizeRuleId } from './rule-utils';

/**
 * Derives compliance results for all supported frameworks (NIST CSF, NIST 800-41, ISO 27001, PCI DSS, CTM)
 * directly from an existing CIS audit result without re-running configuration parsers or checkers.
 */
export function evaluateAuditFrameworks(audit: AuditResult): AuditFrameworkResult[] {
  const frameworks = getFrameworksCatalog();
  const results: AuditFrameworkResult[] = [];

  for (const fw of frameworks) {
    const evaluatedControls: EvaluatedFrameworkControl[] = [];
    let assessableCount = 0;
    let passedAssessable = 0;

    const catMap = new Map<string, { total: number; passed: number; failed: number; needs_review: number }>();

    for (const ctrl of fw.controls) {
      if (!catMap.has(ctrl.category)) {
        catMap.set(ctrl.category, { total: 0, passed: 0, failed: 0, needs_review: 0 });
      }
      const catStats = catMap.get(ctrl.category)!;
      catStats.total++;

      if (ctrl.coverage_type === 'manual') {
        evaluatedControls.push({
          ...ctrl,
          status: 'Needs Review',
          mapped_rules: [],
          failed_count: 0,
          passed_count: 0
        });
        catStats.needs_review++;
        continue;
      }

      if (ctrl.coverage_type === 'not_covered') {
        evaluatedControls.push({
          ...ctrl,
          status: 'Not Covered',
          mapped_rules: [],
          failed_count: 0,
          passed_count: 0
        });
        continue;
      }

      // Automated or Partial coverage -> collect mapped CIS rules from findings
      assessableCount++;
      const mappings = getMappingsForControl(fw.code, ctrl.control_code);
      const mappedEvidence: MappedRuleEvidence[] = [];
      let failedCount = 0;
      let passedCount = 0;
      let hasPending = false;
      let allNA = true;

      for (const map of mappings) {
        // Find matching finding in audit
        const normMap = normalizeRuleId(map.rule_code);
        const matchingFindings = audit.findings.filter(f => {
          const normF = normalizeRuleId(f.rule_id);
          const normFCis = normalizeRuleId(f.cis_code);
          return normF === normMap || normFCis === normMap || normF.endsWith(`-${normMap}`);
        });

        for (const f of matchingFindings) {
          if (f.status !== 'not_applicable') allNA = false;

          const details = getRuleDetailsByCodeOrId(f.cis_code || f.rule_id);
          const evidence: MappedRuleEvidence = {
            rule_id: f.rule_id,
            rule_code: f.cis_code || f.rule_id,
            title: f.title,
            severity: f.severity,
            status: f.status,
            penalty_score: f.penalty_score,
            description: f.description,
            remediation: f.remediation || f.recommendation,
            evidence_snippet: f.evidence_snippet,
            audit_procedure: (details?.audit_procedure as string) || (f as unknown as Record<string, string>).audit_procedure || f.audit_hint || `Review configuration for rule ${f.rule_id}`,
            remediation_procedure: (details?.remediation_procedure as string) || (f as unknown as Record<string, string>).remediation_procedure || f.remediation || f.recommendation || `Configure compliant settings for ${f.rule_id}`
          };

          mappedEvidence.push(evidence);

          if (f.status === 'pending_confirmation') {
            hasPending = true;
          } else if (f.status === 'open' && f.penalty_score > 0) {
            failedCount++;
          } else if (f.status === 'resolved' || f.status === 'accepted_risk' || f.status === 'false_positive' || (f.status === 'open' && f.penalty_score === 0)) {
            passedCount++;
          }
        }
      }

      let status: ControlStatus = 'Compliant';
      if (mappings.length === 0) {
        status = 'Not Applicable';
        assessableCount--;
      } else if (allNA && mappedEvidence.length > 0) {
        status = 'Not Applicable';
        assessableCount--;
      } else if (hasPending) {
        status = 'Needs Review';
        catStats.needs_review++;
      } else if (failedCount > 0) {
        status = 'Non-Compliant';
        catStats.failed++;
      } else {
        status = 'Compliant';
        passedAssessable++;
        catStats.passed++;
      }

      evaluatedControls.push({
        ...ctrl,
        status,
        mapped_rules: mappedEvidence,
        failed_count: failedCount,
        passed_count: passedCount
      });
    }

    const totalControls = fw.controls.length;
    const coveragePercent = Math.round((assessableCount / (totalControls || 1)) * 100);
    const score = assessableCount > 0 ? Math.round((passedAssessable / assessableCount) * 100) : 100;

    const categoryBreakdown = Array.from(catMap.entries()).map(([cat, stats]) => {
      const assessableCat = stats.passed + stats.failed;
      const catScore = assessableCat > 0 ? Math.round((stats.passed / assessableCat) * 100) : 100;
      return {
        category: cat,
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        needs_review: stats.needs_review,
        score: catScore
      };
    });

    results.push({
      audit_id: audit.id,
      framework_code: fw.code,
      framework_name: fw.name,
      score,
      covered_controls: assessableCount,
      total_controls: totalControls,
      coverage_percent: coveragePercent,
      controls: evaluatedControls,
      category_breakdown: categoryBreakdown
    });
  }

  return results;
}

/**
 * Helper to get a specific framework evaluation from a calculated result list.
 */
export function getFrameworkResultByCode(results: AuditFrameworkResult[], code: FrameworkCode): AuditFrameworkResult | undefined {
  return results.find(r => r.framework_code === code);
}
