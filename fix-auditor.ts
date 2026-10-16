import prisma from './src/lib/db/prisma';
import { AuditResult } from './src/lib/types/audit';
import { ScoringEngine } from './src/lib/engine/scoring-engine';

async function main() {
  const audits = await prisma.audit.findMany();
  let updatedCount = 0;

  for (const audit of audits) {
    try {
      const data = JSON.parse(audit.data as string) as AuditResult;
      let modified = false;

      // Fix " (Lead Auditor)" in created_by
      if (data.created_by && data.created_by.includes(' (Lead Auditor)')) {
        data.created_by = data.created_by.replace(' (Lead Auditor)', '');
        modified = true;
      }

      // Recalculate score and grade because of scoring engine change
      const newScoring = ScoringEngine.calculateScore(data.findings);
      
      if (data.score !== newScoring.score || data.grade !== newScoring.grade || audit.score !== newScoring.score) {
        data.score = newScoring.score;
        data.grade = newScoring.grade;
        data.breakdown = newScoring.breakdown;
        data.score_breakdown = newScoring.score_breakdown;
        modified = true;
      }

      if (modified) {
        await prisma.audit.update({
          where: { id: audit.id },
          data: { 
            data: JSON.stringify(data),
            score: newScoring.score,
            grade: newScoring.grade
          }
        });
        
        // Also update company latest score and device latest score if this is the most recent audit
        await prisma.company.update({
          where: { id: audit.company_id },
          data: {
            latest_score: newScoring.score,
            latest_grade: newScoring.grade
          }
        });

        await prisma.device.update({
          where: { id: audit.device_id },
          data: {
            latest_score: newScoring.score,
            latest_grade: newScoring.grade
          }
        });

        updatedCount++;
        console.log(`Updated audit ${audit.id} (New Score: ${newScoring.score}, Grade: ${newScoring.grade})`);
      }
    } catch (e) {
      console.error(`Failed to update audit ${audit.id}:`, e);
    }
  }

  console.log(`Finished migrating database. Fixed ${updatedCount} audits.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
