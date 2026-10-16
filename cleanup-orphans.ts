import prisma from './src/lib/db/prisma';

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true } });
  const companyIds = companies.map(c => c.id);

  // Find orphaned devices
  const orphanedDevices = await prisma.device.findMany({
    where: {
      company_id: { notIn: companyIds }
    }
  });

  if (orphanedDevices.length > 0) {
    console.log(`Found ${orphanedDevices.length} orphaned devices. Deleting...`);
    await prisma.device.deleteMany({
      where: { company_id: { notIn: companyIds } }
    });
  }

  // Find orphaned audits
  const orphanedAudits = await prisma.audit.findMany({
    where: {
      company_id: { notIn: companyIds }
    }
  });

  if (orphanedAudits.length > 0) {
    console.log(`Found ${orphanedAudits.length} orphaned audits. Deleting...`);
    // Delete framework results for orphaned audits first
    const orphanedAuditIds = orphanedAudits.map(a => a.id);
    await prisma.auditFrameworkResult.deleteMany({
      where: { audit_id: { in: orphanedAuditIds } }
    });
    
    await prisma.audit.deleteMany({
      where: { company_id: { notIn: companyIds } }
    });
  }

  // Find orphaned reports
  const orphanedReports = await prisma.report.findMany({
    where: {
      company_id: { notIn: companyIds }
    }
  });

  if (orphanedReports.length > 0) {
    console.log(`Found ${orphanedReports.length} orphaned reports. Deleting...`);
    await prisma.report.deleteMany({
      where: { company_id: { notIn: companyIds } }
    });
  }

  console.log("Cleanup complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
