import { NextResponse } from 'next/server';
import { auditBackgroundRunner } from '@/lib/engine/audit-background-runner';
import prisma from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const active = auditBackgroundRunner.getActiveScans();
    const completed = auditBackgroundRunner.getCompletedScans();

    // If active scans in memory are empty, double check SQLite for any stranded 'in_progress' audits
    if (active.length === 0) {
      const stranded = await prisma.audit.findMany({
        where: { status: 'in_progress' },
        take: 5,
        orderBy: { created_at: 'desc' },
      });

      // If any stranded audit is older than 20 minutes, mark it failed
      const now = Date.now();
      for (const item of stranded) {
        const itemAgeMs = now - new Date(item.created_at).getTime();
        if (itemAgeMs > 20 * 60 * 1000) {
          await prisma.audit.update({
            where: { id: item.id },
            data: { status: 'failed' },
          }).catch(() => {});
        }
      }
    }

    const unreadCompletedCount = completed.filter(c => !c.read).length;

    return NextResponse.json({
      active,
      completed,
      hasActive: active.length > 0,
      unreadCompletedCount,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
