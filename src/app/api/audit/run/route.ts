/**
 * API Route: POST /api/audit/run
 *
 * Executes a firewall audit using the background audit engine and streams real-time progress
 * back to the client using Server-Sent Events (SSE).
 *
 * It is integrated with auditBackgroundRunner so the scan is also visible across the entire
 * application (Topbar, Sidebar, Dashboard, Audit Results).
 */

import { NextRequest } from 'next/server';
import { ParserRegistry } from '@/lib/parsers/parser-registry';
import prisma from '@/lib/db/prisma';
import { auditBackgroundRunner } from '@/lib/engine/audit-background-runner';
import { AuditResult } from '@/lib/types/audit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | undefined;
  let isClosed = false;

  const stream = new ReadableStream({
    start(c) { controller = c; },
    cancel() { isClosed = true; }
  });

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });

  function emit(data: object) {
    if (isClosed) return;
    try {
      controller?.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      isClosed = true;
    }
  }

  (async () => {
    try {
      const body = await req.json() as {
        fileContent: string;
        fileName: string;
        companyId: string;
        deviceId: string;
        vendor: string;
      };

      const { fileContent, fileName, companyId, deviceId, vendor } = body;

      if (!fileContent || !companyId || !deviceId) {
        emit({ type: 'error', message: 'Missing required fields: fileContent, companyId, deviceId.' });
        try { controller?.close(); } catch {}
        return;
      }

      const { config, vendorUsed } = ParserRegistry.parseConfig(fileContent, vendor || 'auto', fileName || 'backup.conf');
      const auditId = `audit-${Date.now().toString().slice(-8)}`;

      const company = await prisma.company.findUnique({ where: { id: companyId } });
      const device = await prisma.device.findUnique({ where: { id: deviceId } });

      const targetHostname = config.device?.hostname || device?.hostname || (fileName || 'backup.conf').split('.')[0];
      const companyName = company?.name || 'Client Company';
      const deviceName = device?.hostname || targetHostname;

      // 1. Save initial audit record into SQLite
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

      // 2. Update device metadata immediately
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

      // 3. Subscribe to background runner events
      const unsubscribe = auditBackgroundRunner.subscribe(auditId, (event) => {
        emit(event);
        if (event.type === 'done' || event.type === 'error') {
          try { controller?.close(); } catch {}
          isClosed = true;
          unsubscribe();
        }
      });

      // 4. Start scan in background
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

    } catch (err) {
      const message = (err as Error).message ?? 'An unexpected error occurred during the audit.';
      emit({ type: 'error', message });
      try { controller?.close(); } catch {}
    }
  })();

  return response;
}
