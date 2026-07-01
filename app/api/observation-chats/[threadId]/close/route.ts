import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getObservationThreadById,
  closeObservationThread,
  fetchInspectionForChatAccess,
  canCloseObservationChat,
} from '@/lib/observation-chats';

export async function POST(
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
    const { threadId: threadIdParam } = await params;
    const threadId = parseInt(threadIdParam, 10);

    const thread = await getObservationThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    if (thread.is_closed) {
      return NextResponse.json({ thread, message: 'Observation already closed' });
    }

    const ir = await fetchInspectionForChatAccess(thread.inspection_request_id);
    if (!ir) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const canClose = await canCloseObservationChat(userId, userRole, thread.part, ir);
    if (!canClose) {
      return NextResponse.json({ error: 'Only the assigned inspector can close this observation' }, { status: 403 });
    }

    const updated = await closeObservationThread(threadId, userId);
    return NextResponse.json({ thread: updated, message: 'Observation closed' });
  } catch (error) {
    console.error('Error closing observation thread:', error);
    return NextResponse.json({ error: 'Failed to close observation' }, { status: 500 });
  }
}
