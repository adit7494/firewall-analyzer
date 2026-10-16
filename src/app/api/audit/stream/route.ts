import { NextRequest } from 'next/server';
import { auditBackgroundRunner } from '@/lib/engine/audit-background-runner';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auditId = req.nextUrl.searchParams.get('auditId');

  if (!auditId) {
    return new Response('Missing auditId parameter', { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          isClosed = true;
        }
      }

      // Check current in-memory scan
      let scan = auditBackgroundRunner.getScan(auditId);

      // If not in memory, check SQLite (it might already be completed)
      if (!scan) {
        const dbAudit = await prisma.audit.findUnique({ where: { id: auditId } });
        if (dbAudit) {
          try {
            const auditData = JSON.parse(dbAudit.data);
            send({
              type: 'init',
              scan: {
                auditId: dbAudit.id,
                hostname: auditData.config_file_name || 'Appliance',
                fileName: auditData.config_file_name,
                vendor: auditData.vendor,
                status: dbAudit.status,
                progress: dbAudit.status === 'done' ? 100 : 0,
                score: dbAudit.score,
                grade: dbAudit.grade,
              },
              logs: [
                {
                  type: 'system',
                  message: `Audit record loaded from database. Status: ${dbAudit.status}`,
                  timestamp: new Date(dbAudit.created_at).toLocaleTimeString(),
                },
              ],
            });

            if (dbAudit.status === 'done') {
              send({
                type: 'done',
                auditId: dbAudit.id,
                score: dbAudit.score,
                grade: dbAudit.grade,
                findingsTotal: auditData.findings?.length || 0,
              });
              try { controller.close(); } catch {}
              isClosed = true;
              return;
            }
          } catch {
            // Parsing error
          }
        }
      }

      if (scan) {
        // Send initial state & replay logs so frontend has complete history
        send({
          type: 'init',
          scan: {
            auditId: scan.auditId,
            hostname: scan.hostname,
            fileName: scan.fileName,
            vendor: scan.vendor,
            status: scan.status,
            progress: scan.progress,
            totalBlocks: scan.totalBlocks,
            completedBlocks: scan.completedBlocks,
            currentBlock: scan.currentBlock,
            score: scan.score,
            grade: scan.grade,
          },
          logs: scan.logs,
        });

        if (scan.status === 'done') {
          send({
            type: 'done',
            auditId: scan.auditId,
            score: scan.score,
            grade: scan.grade,
            findingsTotal: scan.findingsCount,
          });
          try { controller.close(); } catch {}
          isClosed = true;
          return;
        }

        if (scan.status === 'failed') {
          send({
            type: 'error',
            auditId: scan.auditId,
            message: scan.error || 'Audit failed',
          });
          try { controller.close(); } catch {}
          isClosed = true;
          return;
        }
      }

      // Subscribe to live events from background runner
      unsubscribe = auditBackgroundRunner.subscribe(auditId, (event) => {
        send(event);
        if (event.type === 'done' || event.type === 'error') {
          try { controller.close(); } catch {}
          isClosed = true;
        }
      });
    },
    cancel() {
      isClosed = true;
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
