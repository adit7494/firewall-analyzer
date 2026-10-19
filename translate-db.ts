import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { AuditResult } from './src/lib/types/audit';
import { RULES_CATALOG } from './src/lib/engine/rules-catalog';
import { ScoringEngine } from './src/lib/engine/scoring-engine';
import { normalizeRuleId } from './src/lib/engine/rule-utils';
import * as fs from 'fs';

async function migrateDatabase(dbUrl: string, dbName: string) {
  console.log(`\n========================================`);
  console.log(`Migrating database: ${dbName} (${dbUrl})`);
  console.log(`========================================`);

  const adapter = new PrismaLibSql({
    url: dbUrl.startsWith('file:') ? dbUrl : `file:${dbUrl}`
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const audits = await prisma.audit.findMany();
    const reports = await prisma.report.findMany();
    let updatedAudits = 0;
    let updatedReports = 0;

    for (const audit of audits) {
      try {
        const data = JSON.parse(audit.data as string) as AuditResult;
        let modified = false;

        for (const finding of data.findings) {
          // Fix SNMP CIS-3.4 mismatch to CIS-2.3.4
          if ((finding.rule_id === 'CIS-3.4' || finding.cis_code === '3.4') && 
              (finding.title.toLowerCase().includes('snmp') || finding.category === 'SNMP')) {
            finding.rule_id = 'CIS-2.3.4';
            finding.cis_code = '2.3.4';
            modified = true;
          }

          // Look up English rule from catalog
          const normId = normalizeRuleId(finding.cis_code || finding.rule_id || '');
          const ruleDetails = RULES_CATALOG.find(r => 
            normalizeRuleId(r.id) === normId || 
            normalizeRuleId(r.code) === normId ||
            r.id === finding.rule_id
          );

          if (ruleDetails) {
            if (ruleDetails.rationale && finding.rationale !== ruleDetails.rationale) {
              finding.rationale = ruleDetails.rationale;
              modified = true;
            }
            if (ruleDetails.impact && finding.impact !== ruleDetails.impact) {
              finding.impact = ruleDetails.impact;
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
          console.log(`[${dbName}] Updated audit ${audit.id} (Score: ${scoring.score}, Grade: ${scoring.grade})`);
        }
      } catch (e) {
        console.error(`[${dbName}] Failed to parse/update audit ${audit.id}:`, e);
      }
    }

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
              snapshot: JSON.stringify(auditData)
            }
          });
          updatedReports++;
          console.log(`[${dbName}] Updated report ${report.id} to match audit ${parentAudit.id}`);
        }
      } catch (e) {
        console.error(`[${dbName}] Failed to sync report ${report.id}:`, e);
      }
    }

    console.log(`[${dbName}] Migration completed: ${updatedAudits} audits updated, ${updatedReports} reports synced.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  // 1. Migrate dev.db
  await migrateDatabase(process.env.DATABASE_URL || 'file:./dev.db', 'dev.db');

  // 2. Migrate data/prod.db if present
  if (fs.existsSync('data/prod.db')) {
    await migrateDatabase('file:./data/prod.db', 'prod.db');
  }

  console.log('\nAll databases successfully migrated to English standard.');
}

main().catch(console.error);
