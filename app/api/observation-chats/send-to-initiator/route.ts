import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createNotification } from '@/lib/notifications';
import {
  fetchInspectionForChatAccess,
  canCloseObservationChat,
  sendObservationToInitiator,
  type ObservationPart,
} from '@/lib/observation-chats';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as { id?: string }).id || '0', 10);
    const userRole = (session.user as { role?: string }).role || 'initiator';
    const senderName = (session.user as { name?: string }).name || 'Inspector';
    const body = await request.json();

    const inspectionRequestId = parseInt(String(body.inspection_request_id || ''), 10);
    const part = String(body.part || '') as ObservationPart;
    const observationKey = String(body.observation_key || '').trim();
    const observation = String(body.observation || '').trim();
    const actionRequired = String(body.action_required || '').trim();

    if (!inspectionRequestId || !observationKey || !observation || !actionRequired) {
      return NextResponse.json(
        { error: 'Observation and action required must both be filled before sending' },
        { status: 400 }
      );
    }
    if (part !== 'part4' && part !== 'part5') {
      return NextResponse.json({ error: 'part must be part4 or part5' }, { status: 400 });
    }

    const ir = await fetchInspectionForChatAccess(inspectionRequestId);
    if (!ir) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const canSend = await canCloseObservationChat(userId, userRole, part, ir);
    if (!canSend) {
      return NextResponse.json(
        { error: 'Only the assigned inspector can send observations to the initiator' },
        { status: 403 }
      );
    }

    const initiatorId = ir.initiator_id != null ? Number(ir.initiator_id) : 0;
    if (!initiatorId) {
      return NextResponse.json({ error: 'Initiator not found for this inspection request' }, { status: 400 });
    }

    const { thread, message } = await sendObservationToInitiator({
      inspectionRequestId,
      part,
      observationKey,
      observation,
      actionRequired,
      senderId: userId,
    });

    const partLabel = part === 'part4' ? 'Part IV — R&QA' : 'Part V — DGAQA';
    const notifyTitle = `Observation sent — ${ir.request_number || 'IR'}`;
    const notifyParts = [
      `${senderName} sent an observation (${partLabel}).`,
      `Observation: ${observation.slice(0, 120)}${observation.length > 120 ? '…' : ''}`,
    ];
    if (actionRequired) {
      notifyParts.push(
        `Action Required: ${actionRequired.slice(0, 120)}${actionRequired.length > 120 ? '…' : ''}`
      );
    }

    await createNotification({
      userId: initiatorId,
      title: notifyTitle,
      message: notifyParts.join(' '),
      type: 'info',
      entityType: 'observation_thread',
      entityId: thread.id,
    });

    return NextResponse.json({
      thread,
      message,
      success: true,
      initiator_name: ir.initiator_name || 'Initiator',
      notification: `Observation sent to ${ir.initiator_name || 'initiator'}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send observation';
    console.error('Error sending observation to initiator:', error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
