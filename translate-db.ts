import prisma from './src/lib/db/prisma';
import { AuditResult } from './src/lib/types/audit';
import { RULES_CATALOG } from './src/lib/engine/rules-catalog';
import { ScoringEngine } from './src/lib/engine/scoring-engine';

async function main() {
  const audits = await prisma.audit.findMany();
  const reports = await prisma.report.findMany();
  let updatedAudits = 0;
  let updatedReports = 0;

  for (const audit of audits) {
    try {
      const data = JSON.parse(audit.data as string) as AuditResult;
      let modified = false;

      for (const finding of data.findings) {
        // Look up the English rule from the catalog
        const ruleDetails = RULES_CATALOG.find(r => r.id === finding.cis_code || r.id === finding.rule_id || r.code === finding.cis_code);
        
        if (ruleDetails) {
          // Force English text overwrite
          if (ruleDetails.rationale && finding.rationale !== ruleDetails.rationale) {
            finding.rationale = ruleDetails.rationale;
            modified = true;
          }
          if (ruleDetails.audit_procedure && finding.audit_procedure !== ruleDetails.audit_procedure) {
            finding.audit_procedure = ruleDetails.audit_procedure;
            modified = true;
          }
          if (ruleDetails.remediation_procedure && finding.remediation_procedure !== ruleDetails.remediation_procedure) {
            finding.remediation_procedure = ruleDetails.remediation_procedure;
            modified = true;
          }
          if (ruleDetails.expected_value && finding.expected_value !== ruleDetails.expected_value) {
            finding.expected_value = ruleDetails.expected_value;
            modified = true;
          }
          if (ruleDetails.default_value && finding.default_value !== ruleDetails.default_value) {
            finding.default_value = ruleDetails.default_value;
            modified = true;
          }
          if (ruleDetails.recommendation && finding.recommendation !== ruleDetails.recommendation) {
            finding.recommendation = ruleDetails.recommendation;
            modified = true;
          }
        }
      }

      if (modified) {
        // Recalculate score and grade with English findings
        const scoring = ScoringEngine.calculateScore(data.findings, data.vendor);
        data.score = scoring.score;
        data.grade = scoring.grade;
        data.score_breakdown = scoring.score_breakdown;
        data.breakdown = scoring.breakdown;

        await prisma.audit.update({
          where: { id: audit.id },
          data: { 
            data: JSON.stringify(data),
            score: scoring.score,
            grade: scoring.grade
          }
        });
        updatedAudits++;
        console.log(`Updated audit ${audit.id} (Score: ${scoring.score}, Grade: ${scoring.grade})`);
      }
    } catch (e) {
      console.error(`Failed to parse/update audit ${audit.id}:`, e);
    }
  }

  // Now sync Reports
  for (const report of reports) {
    try {
      const parentAudit = await prisma.audit.findUnique({ where: { id: report.audit_id } });
      if (parentAudit) {
        const auditData = JSON.parse(parentAudit.data as string) as AuditResult;
        
        await prisma.report.update({
          where: { id: report.id },
          data: {
            score: parentAudit.score,
            grade: parentAudit.grade,
            snapshot: JSON.stringify(auditData) // Sync latest english snapshot
          }
        });
        updatedReports++;
        console.log(`Updated report ${report.id} to match audit ${parentAudit.id}`);
      }
    } catch (e) {
      console.error(`Failed to sync report ${report.id}:`, e);
    }
  }

  console.log(`Finished migrating database. Translated ${updatedAudits} audits and synced ${updatedReports} reports.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
