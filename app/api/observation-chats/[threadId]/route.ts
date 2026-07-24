import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getObservationThreadById,
  getObservationMessages,
  fetchInspectionForChatAccess,
  canAccessObservationChat,
  canReplyObservationChat,
  canCloseObservationChat,
} from '@/lib/observation-chats';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as { id?: string }).id || '0', 10);
    const userRole = (session.user as { role?: string }).role || 'initiator';
    const employeeId = (session.user as { employee_id?: string }).employee_id;
    const { threadId: threadIdParam } = await params;
    const threadId = parseInt(threadIdParam, 10);

    const thread = await getObservationThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const ir = await fetchInspectionForChatAccess(thread.inspection_request_id);
    if (!ir) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const allowed = await canAccessObservationChat(userId, userRole, ir, employeeId);
    if (!allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const messages = await getObservationMessages(threadId);
    const canReply = await canReplyObservationChat(userId, userRole, thread.part, ir);
    const canClose = await canCloseObservationChat(userId, userRole, thread.part, ir);

    return NextResponse.json({
      thread,
      messages,
      can_reply: canReply,
      can_close: canClose,
      inspection: {
        id: ir.id,
        request_number: ir.request_number,
        title: ir.title,
      },
    });
  } catch (error) {
    console.error('Error fetching observation thread:', error);
    return NextResponse.json({ error: 'Failed to fetch observation chat' }, { status: 500 });
  }
}
