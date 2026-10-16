import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as fs from 'fs';
import * as path from 'path';

const adapter = new PrismaLibSql({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting multi-framework data seed...');

  // 1. Seed Frameworks and Controls
  const frameworksPath = path.join(process.cwd(), 'supabase/seed/frameworks.json');
  if (fs.existsSync(frameworksPath)) {
    const rawData = JSON.parse(fs.readFileSync(frameworksPath, 'utf-8'));
    const frameworksData = rawData.frameworks || [];
    
    for (const fw of frameworksData) {
      if (fw._comment) continue;
      
      console.log(`Upserting framework: ${fw.code}`);
      const framework = await prisma.framework.upsert({
        where: { code: fw.code },
        update: {
          name: fw.name,
          version: fw.version,
          description: fw.description,
          is_technical: fw.is_technical,
        },
        create: {
          code: fw.code,
          name: fw.name,
          version: fw.version,
          description: fw.description,
          is_technical: fw.is_technical,
        }
      });

      if (fw.controls && Array.isArray(fw.controls)) {
        console.log(`  Seeding ${fw.controls.length} controls for ${fw.code}`);
        for (const ctrl of fw.controls) {
          if (ctrl._comment) continue;
          
          const existingCtrl = await prisma.frameworkControl.findUnique({
            where: {
              framework_id_control_code: {
                framework_id: framework.id,
                control_code: ctrl.control_code
              }
            }
          });

          if (!existingCtrl) {
            await prisma.frameworkControl.create({
              data: {
                framework_id: framework.id,
                control_code: ctrl.control_code,
                title: ctrl.title,
                category: ctrl.category,
                description: ctrl.description,
                coverage_type: ctrl.coverage_type || 'manual',
                guidance: ctrl.guidance
              }
            });
          } else {
            await prisma.frameworkControl.update({
              where: { id: existingCtrl.id },
              data: {
                title: ctrl.title,
                category: ctrl.category,
                description: ctrl.description,
                coverage_type: ctrl.coverage_type || 'manual',
                guidance: ctrl.guidance
              }
            });
          }
        }
      }
    }
  } else {
    console.warn(`Warning: Could not find ${frameworksPath}`);
  }

  // 2. Seed Mappings
  const mappingsPath = path.join(process.cwd(), 'supabase/seed/mappings_cis_fortigate.json');
  if (fs.existsSync(mappingsPath)) {
    const rawData = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));
    const mappingsData = rawData.mappings || [];
    console.log(`Seeding mappings from mappings_cis_fortigate.json...`);
    
    for (const mapping of mappingsData) {
      if (mapping._comment) continue;
      
      const fw = await prisma.framework.findUnique({ where: { code: mapping.framework } });
      if (!fw) continue;

      const fwCtrl = await prisma.frameworkControl.findUnique({
        where: {
          framework_id_control_code: {
            framework_id: fw.id,
            control_code: mapping.control_code
          }
        }
      });

      if (!fwCtrl) continue;

      if (mapping.rules && Array.isArray(mapping.rules)) {
        for (const rule of mapping.rules) {
          const existingMap = await prisma.controlRuleMapping.findUnique({
            where: {
              framework_control_id_rule_code_rule_vendor: {
                framework_control_id: fwCtrl.id,
                rule_code: rule,
                rule_vendor: mapping.vendor || 'fortigate'
              }
            }
          });

          if (!existingMap) {
            await prisma.controlRuleMapping.create({
              data: {
                framework_control_id: fwCtrl.id,
                rule_code: rule,
                rule_vendor: mapping.vendor || 'fortigate',
                mapping_strength: mapping.strength || 'full',
                note: mapping.note
              }
            });
          }
        }
      }
    }
  } else {
    console.warn(`Warning: Could not find ${mappingsPath}`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
