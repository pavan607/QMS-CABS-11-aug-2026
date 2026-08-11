import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getObservationThreadById,
  getObservationMessages,
  fetchInspectionForChatAccess,
  canAccessObservationChat,
  canReplyObservationChat,
  canCloseObservationChat,
  canEditObservationChat,
  updateObservationSheetText,
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
    const designation = (session.user as { designation?: string }).designation;
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

    const allowed = await canAccessObservationChat(userId, userRole, ir, employeeId, designation);
    if (!allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const messages = await getObservationMessages(threadId);
    const canReply = await canReplyObservationChat(userId, userRole, thread.part, ir);
    const canClose = await canCloseObservationChat(userId, userRole, thread.part, ir);
    const canEdit = canEditObservationChat(userId, userRole, thread.part, ir, !!thread.is_closed);

    let actionRequired = '';
    if (thread.part === 'part4' && ir.part4_data) {
      let part4: Record<string, unknown> = {};
      const raw = ir.part4_data;
      if (typeof raw === 'string') {
        try {
          part4 = JSON.parse(raw) || {};
        } catch {
          part4 = {};
        }
      } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        part4 = raw as Record<string, unknown>;
      }
      const remarks = Array.isArray(part4.part4_remarks) ? part4.part4_remarks : [];
      for (const r of remarks) {
        if (!r || typeof r !== 'object') continue;
        const row = r as Record<string, unknown>;
        if (String(row.chat_id ?? '').trim() === thread.observation_key) {
          actionRequired = String(row.action_required ?? '');
          break;
        }
      }
    }

    return NextResponse.json({
      thread,
      messages,
      can_reply: canReply,
      can_close: canClose,
      can_edit: canEdit,
      action_required: actionRequired,
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

export async function PATCH(
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
    const employeeId = (session.user as { employee_id?: string }).employee_id;
    const designation = (session.user as { designation?: string }).designation;
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

    const allowed = await canAccessObservationChat(userId, userRole, ir, employeeId, designation);
    if (!allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!canEditObservationChat(userId, userRole, thread.part, ir, !!thread.is_closed)) {
      return NextResponse.json(
        {
          error:
            'Only Team Head – QA can edit Part IV observations after the R&QA Inspector has submitted Part IV',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const observation = typeof body.observation === 'string' ? body.observation : '';
    const actionRequired =
      typeof body.action_required === 'string' ? body.action_required : undefined;

    const updated = await updateObservationSheetText({
      threadId,
      observation,
      actionRequired,
    });
    const messages = await getObservationMessages(threadId);

    return NextResponse.json({
      thread: updated,
      messages,
      action_required:
        typeof actionRequired === 'string' ? actionRequired.trim() : undefined,
      message: 'Observation updated',
    });
  } catch (error) {
    console.error('Error updating observation:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update observation';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
