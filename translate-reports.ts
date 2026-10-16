import prisma from "./src/lib/db/prisma";
import { RULES_CATALOG } from "./src/lib/engine/rules-catalog";

async function main() {
  const reports = await prisma.report.findMany();
  for (const report of reports) {
    if (report.snapshot) {
      const data = JSON.parse(report.snapshot);
      let modified = false;
      for (const finding of data.findings) {
        const ruleDetails = RULES_CATALOG.find(r => r.id === finding.cis_code || r.id === finding.rule_id || r.code === finding.cis_code);
        if (ruleDetails) {
          if (ruleDetails.rationale && finding.rationale !== ruleDetails.rationale) { finding.rationale = ruleDetails.rationale; modified = true; }
          if (ruleDetails.audit_procedure && finding.audit_procedure !== ruleDetails.audit_procedure) { finding.audit_procedure = ruleDetails.audit_procedure; modified = true; }
          if (ruleDetails.remediation_procedure && finding.remediation_procedure !== ruleDetails.remediation_procedure) { finding.remediation_procedure = ruleDetails.remediation_procedure; modified = true; }
          if (ruleDetails.expected_value && finding.expected_value !== ruleDetails.expected_value) { finding.expected_value = ruleDetails.expected_value; modified = true; }
          if (ruleDetails.default_value && finding.default_value !== ruleDetails.default_value) { finding.default_value = ruleDetails.default_value; modified = true; }
          if (ruleDetails.recommendation && finding.recommendation !== ruleDetails.recommendation) { finding.recommendation = ruleDetails.recommendation; modified = true; }
        }
      }
      if (modified) {
        await prisma.report.update({
          where: { id: report.id },
          data: { snapshot: JSON.stringify(data) }
        });
        console.log(`Updated snapshot for report: ${report.id}`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
