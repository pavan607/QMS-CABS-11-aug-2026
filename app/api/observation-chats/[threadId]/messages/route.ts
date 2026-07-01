import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createNotification } from '@/lib/notifications';
import {
  getObservationThreadById,
  sendObservationMessage,
  fetchInspectionForChatAccess,
  canAccessObservationChat,
} from '@/lib/observation-chats';
import { collectInspectorIds } from '@/lib/inspection-access';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as { id?: string }).id || '0', 10);
    const userRole = (session.user as { role?: string }).role || 'initiator';
    const senderName = (session.user as { name?: string }).name || 'User';
    const { threadId: threadIdParam } = await params;
    const threadId = parseInt(threadIdParam, 10);
    const body = await request.json();
    const message = String(body.message || '');

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

    const newMessage = await sendObservationMessage(threadId, userId, message);

    const preview = (thread.observation_preview || 'Observation').slice(0, 80);
    const notifyTitle = `Observation chat — ${ir.request_number || 'IR'}`;
    const notifyBody = `${senderName}: ${message.trim().slice(0, 120)}`;

    const recipientIds = new Set<number>();
    if (ir.initiator_id) recipientIds.add(Number(ir.initiator_id));
    for (const id of collectInspectorIds(ir)) recipientIds.add(id);
    if (ir.ordaqa_inspector_id) recipientIds.add(Number(ir.ordaqa_inspector_id));
    recipientIds.delete(userId);

    await Promise.all(
      [...recipientIds].map((recipientId) =>
        createNotification({
          userId: recipientId,
          title: notifyTitle,
          message: `${preview} — ${notifyBody}`,
          type: 'info',
          entityType: 'observation_thread',
          entityId: threadId,
        }).catch(() => {})
      )
    );

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send message';
    console.error('Error sending observation message:', error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
