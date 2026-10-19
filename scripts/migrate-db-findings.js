const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const fs = require('fs');

const seed = JSON.parse(fs.readFileSync('cis_fortigate_7.4.x_seed.json', 'utf8'));
const seedMap = new Map();
for (const r of seed.rules) {
  seedMap.set(r.code, r);
  seedMap.set(`CIS-${r.code}`, r);
}

function normalizeId(id) {
  if (!id) return '';
  return id.replace(/^CIS-/i, '').trim();
}

async function migrateDb(dbUrl, dbName) {
  console.log(`\nStarting migration for ${dbName}...`);
  const adapter = new PrismaLibSql({
    url: dbUrl.startsWith('file:') ? dbUrl : `file:${dbUrl}`
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const audits = await prisma.audit.findMany();
    console.log(`[${dbName}] Found ${audits.length} audits`);
    let updatedAudits = 0;

    for (const audit of audits) {
      try {
        const data = JSON.parse(audit.data);
        let modified = false;

        for (const finding of (data.findings || [])) {
          // Fix SNMP mismatch CIS-3.4 -> CIS-2.3.4
          if ((finding.rule_id === 'CIS-3.4' || finding.cis_code === '3.4') && 
              (finding.title?.toLowerCase().includes('snmp') || finding.category === 'SNMP')) {
            finding.rule_id = 'CIS-2.3.4';
            finding.cis_code = '2.3.4';
            modified = true;
          }

          const norm = normalizeId(finding.cis_code || finding.rule_id);
          const r = seedMap.get(norm) || seedMap.get(finding.rule_id) || seedMap.get(finding.cis_code);

          if (r) {
            if (r.rationale && finding.rationale !== r.rationale) {
              finding.rationale = r.rationale;
              modified = true;
            }
            if (r.impact && finding.impact !== r.impact) {
              finding.impact = r.impact;
              modified = true;
            }
            if (r.audit_procedure && finding.audit_procedure !== r.audit_procedure) {
              finding.audit_procedure = r.audit_procedure;
              modified = true;
            }
            if (r.remediation_procedure && finding.remediation_procedure !== r.remediation_procedure) {
              finding.remediation_procedure = r.remediation_procedure;
              modified = true;
            }
            if (r.expected_value && finding.expected_value !== r.expected_value) {
              finding.expected_value = r.expected_value;
              modified = true;
            }
            if (r.default_value && finding.default_value !== r.default_value) {
              finding.default_value = r.default_value;
              modified = true;
            }
          }
        }

        if (modified) {
          await prisma.audit.update({
            where: { id: audit.id },
            data: { data: JSON.stringify(data) }
          });
          updatedAudits++;
          console.log(`[${dbName}] Updated audit ${audit.id} (${data.config_file_name})`);
        }
      } catch (err) {
        console.error(`[${dbName}] Error processing audit ${audit.id}:`, err);
      }
    }

    const reports = await prisma.report.findMany();
    let updatedReports = 0;
    for (const report of reports) {
      try {
        const parentAudit = await prisma.audit.findUnique({ where: { id: report.audit_id } });
        if (parentAudit) {
          await prisma.report.update({
            where: { id: report.id },
            data: { snapshot: parentAudit.data }
          });
          updatedReports++;
          console.log(`[${dbName}] Synced report ${report.id} to parent audit ${parentAudit.id}`);
        }
      } catch (err) {
        console.error(`[${dbName}] Error syncing report ${report.id}:`, err);
      }
    }

    console.log(`[${dbName}] Finished: ${updatedAudits} audits updated, ${updatedReports} reports synced.`);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  await migrateDb('file:./dev.db', 'dev.db');
  if (fs.existsSync('data/prod.db')) {
    await migrateDb('file:./data/prod.db', 'prod.db');
  }
  console.log('\nAll databases migrated successfully!');
}

run().catch(console.error);
