import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getObservationThreadById,
  acknowledgeObservationThread,
  fetchInspectionForChatAccess,
  canAccessObservationChat,
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

    const ir = await fetchInspectionForChatAccess(thread.inspection_request_id);
    if (!ir) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const allowed = await canAccessObservationChat(userId, userRole, ir);
    if (!allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await acknowledgeObservationThread(threadId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking observation thread read:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
