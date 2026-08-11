import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  ensureObservationThread,
  fetchInspectionForChatAccess,
  canAccessObservationChat,
  canReplyObservationChat,
  canCloseObservationChat,
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
    const employeeId = (session.user as { employee_id?: string }).employee_id;
    const designation = (session.user as { designation?: string }).designation;
    const body = await request.json();

    const inspectionRequestId = parseInt(String(body.inspection_request_id || ''), 10);
    const part = String(body.part || '') as ObservationPart;
    const observationKey = String(body.observation_key || '').trim();
    const observationPreview = String(body.observation_preview || '').trim();

    if (!inspectionRequestId || !observationKey) {
      return NextResponse.json({ error: 'inspection_request_id and observation_key are required' }, { status: 400 });
    }
    if (part !== 'part4' && part !== 'part5') {
      return NextResponse.json({ error: 'part must be part4 or part5' }, { status: 400 });
    }
    if (!observationPreview) {
      return NextResponse.json({ error: 'An observation description is required before starting a chat' }, { status: 400 });
    }

    const ir = await fetchInspectionForChatAccess(inspectionRequestId);
    if (!ir) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const allowed = await canAccessObservationChat(userId, userRole, ir, employeeId, designation);
    if (!allowed) {
      return NextResponse.json({ error: 'You do not have access to this observation chat' }, { status: 403 });
    }

    const thread = await ensureObservationThread({
      inspectionRequestId,
      part,
      observationKey,
      observationPreview,
    });

    const canReply = await canReplyObservationChat(userId, userRole, part, ir);
    const canClose = await canCloseObservationChat(userId, userRole, part, ir);

    return NextResponse.json({ thread, can_reply: canReply, can_close: canClose });
  } catch (error) {
    console.error('Error ensuring observation thread:', error);
    return NextResponse.json({ error: 'Failed to open observation chat' }, { status: 500 });
  }
}
