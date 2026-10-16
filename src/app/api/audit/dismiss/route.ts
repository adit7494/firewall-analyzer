import { NextRequest, NextResponse } from 'next/server';
import { auditBackgroundRunner } from '@/lib/engine/audit-background-runner';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { auditId, action } = await req.json();

    if (action === 'mark_read' && auditId) {
      auditBackgroundRunner.markAsRead(auditId);
    } else if (action === 'dismiss' && auditId) {
      auditBackgroundRunner.dismiss(auditId);
    } else if (action === 'mark_all_read') {
      auditBackgroundRunner.markAllAsRead();
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
