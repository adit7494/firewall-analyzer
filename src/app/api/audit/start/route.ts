import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { ParserRegistry } from '@/lib/parsers/parser-registry';
import { auditBackgroundRunner } from '@/lib/engine/audit-background-runner';
import { AuditResult } from '@/lib/types/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContent, fileName, companyId, deviceId, vendor } = body;

    if (!fileContent || !companyId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required fields: fileContent, companyId, deviceId.' },
        { status: 400 }
      );
    }

    // 1. Immediately parse basic metadata (takes ~5-10ms)
    const { config, vendorUsed } = ParserRegistry.parseConfig(fileContent, vendor || 'auto', fileName || 'backup.conf');
    const auditId = `audit-${Date.now().toString().slice(-8)}`;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    const device = await prisma.device.findUnique({ where: { id: deviceId } });

    const targetHostname = config.device?.hostname || device?.hostname || (fileName || 'backup.conf').split('.')[0];
    const companyName = company?.name || 'Client Company';
    const deviceName = device?.hostname || targetHostname;

    // 2. Immediately save audit record into SQLite with status 'in_progress'
    const initialAudit: AuditResult = {
      id: auditId,
      company_id: companyId,
      device_id: deviceId,
      vendor: vendorUsed,
      config_file_name: fileName || 'backup.conf',
      status: 'in_progress',
      score: 0,
      grade: 'N/A',
      created_by: 'System',
      created_at: new Date().toISOString(),
      findings: [],
      breakdown: [],
      rules_analyzed: 0,
      controls_checked: 0,
    };

    await prisma.audit.create({
      data: {
        id: auditId,
        company_id: companyId,
        device_id: deviceId,
        status: 'in_progress',
        score: 0,
        grade: 'N/A',
        data: JSON.stringify(initialAudit),
      },
    });

    // 3. Immediately update device metadata (hostname, model, os version, backup date)
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        hostname: config.device?.hostname || device?.hostname || undefined,
        model: config.device?.model || device?.model || undefined,
        os_version: config.device?.os_version || device?.os_version || undefined,
        serial: config.device?.serial || device?.serial || undefined,
        last_backup_date: new Date().toISOString().split('T')[0],
      },
    });

    // 4. Start the background scan runner (asynchronous, non-blocking!)
    auditBackgroundRunner.startScan({
      auditId,
      fileContent,
      fileName: fileName || 'backup.conf',
      companyId,
      companyName,
      deviceId,
      deviceName,
      vendor: vendorUsed,
    });

    // 5. Instantly respond to client
    return NextResponse.json({
      success: true,
      auditId,
      status: 'in_progress',
      hostname: targetHostname,
      companyName,
      vendor: vendorUsed,
      message: 'Configuration backup safely stored in database. AI audit is running in the background.',
    });
  } catch (err) {
    console.error('Error starting audit:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
