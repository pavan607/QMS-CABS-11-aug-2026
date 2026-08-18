import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
  createNotification,
  notifyReturnedToDesignerByQaHead,
  notifyQaHeadsResubmittedAfterReturn,
  notifyQaApproverSendBack,
  notifyRequestApproversPendingForward,
  notifyPart1ApproverAfterRequestApproverForward,
  notifyQaHeadsAfterRequestApproverForward,
  notifyNominatedTeamHeadQaPart2,
  notifyOrdaqaHeadsForwardedToOrdaqa,
  notifyQaHeadsMemoReturnedFromOrdaqa,
  notifyInspectorsAssignedPart2,
  notifyInspectorsReassignedPart2,
  notifyStakeholdersInspectorOutstationRejected,
  notifyStakeholdersInspectorOutstationSendBack,
  notifyPart2InspectorsPart3Completed,
  notifyStakeholdersOrdaqaDelegatedToRqa,
  notifyStakeholdersPart4Saved,
  notifyTeamHeadPart4PendingApproval,
  notifyInspectorsPart4Rejected,
  notifyInspectorsPart4Approved,
  notifyOrdaqaAssigneePart4ForwardedForPart5,
  notifyOrdaqaHeadsPart5PendingApproval,
  notifyOrdaqaAssigneePart5SentBack,
  notifyOrdaqaAssigneePart5Approved,
  notifyInitiatorIrMilestone,
  notifyIrStakeholders,
  notifyInspectionRejected,
  notifyInspectionCompleted,
  notifyInspectionClosed,
  createBulkNotifications,
} from '@/lib/notifications';
import {
  autoSendObservationsFromRemarks,
  collectObservationStakeholderIds,
  fetchInspectionForChatAccess,
  normalizeRemarkWithChatId,
} from '@/lib/observation-chats';
import {
  canUserApproveOrdqaPart5,
  canUserOrdqaHeadPart5SendBack,
  canUserApprovePart4,
  canUserRejectPart4,
  canUserCompleteInspection,
  canUserStartInspection,
  inspectionReadyToStart,
  inspectionReadyForFinalTeamHeadApproval,
  inspectionRequiresOrdqaPart5,
  canUserUpdatePart4,
  canUserTeamHeadEditPart4,
  inspectionReportsReadyForTeamHead,
  inspectionSkipsPart2Part3,
  inspectionSkipsRqaPart2AndPart4,
  dgaqaInvolvedInPart1,
  inspectionUsesLegacyOpenRqaPart4,
  isForwardedToOrdqa,
  ordqaPart5Approved,
  ordqaPart5Completed,
  ordqaPart5Submitted,
  part3Section23EditableStatus,
  part2OutstationDetailsIncomplete,
  part2OutstationDetailsSubmitted,
  canUserInspectorOutstationRejectOrSendBack,
  part2OutstationEditLockedByPart3,
  inspectionPart4Saved,
  part4ApprovedByTeamHead,
  part4BlockedByPart3,
  part4PendingTeamHeadApproval,
  getPart4TeamHeadApprovalStatusRaw,
  validatePart1DocumentDetailsForward,
} from '@/lib/inspection-display';
import {
  userCanAccessInspectionRequest,
  collectInspectorIds,
  parseInspectorIds,
} from '@/lib/inspection-access';
import { employeeIsPart1Approver, PART1_APPROVER_EMPLOYEE_ID } from '@/lib/part1-approver';
import { canActAsNominatedRequestCertifier } from '@/lib/request-certifier';
import { isEligibleRqaTeamHead } from '@/lib/rqa-users';

async function notifyInitiatorRequestApproverSendBack(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  comment: string,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const preview =
    comment.length > 200 ? `${comment.slice(0, 197)}…` : comment;
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Request sent back for corrections',
      message: `Inspection request ${requestNumber} was sent back by Request Approver. ${preview}`,
      type: 'returned_to_designer',
    },
    { excludeUserId, extraUserIds: [initiatorId, ...extraUserIds] }
  );
}

/** User ids on the IR row before a send-back/reject clears assignees. */
function snapshotIrStakeholderIds(ir: {
  initiator_id?: number | null;
  request_approver_id?: number | null;
  nominated_request_approver_id?: number | null;
  nominated_team_head_id?: number | null;
  qa_approver_id?: number | null;
  part1_approved_by?: number | null;
  inspector_id?: number | null;
  inspector_ids?: unknown;
  ordaqa_inspector_id?: number | null;
  ordaqa_approver_id?: number | null;
  final_qa_approver_id?: number | null;
  approver_id?: number | null;
  part2_data?: unknown;
  part3_completed_by?: number | null;
  part4_completed_by?: number | null;
}): number[] {
  const ids = new Set<number>();
  const add = (v: unknown) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  };
  add(ir.initiator_id);
  add(ir.request_approver_id);
  add(ir.nominated_request_approver_id);
  add(ir.nominated_team_head_id);
  add(ir.qa_approver_id);
  add(ir.part1_approved_by);
  add(ir.inspector_id);
  add(ir.ordaqa_inspector_id);
  add(ir.ordaqa_approver_id);
  add(ir.final_qa_approver_id);
  add(ir.approver_id);
  add(ir.part3_completed_by);
  add(ir.part4_completed_by);
  for (const id of collectInspectorIds(ir)) add(id);
  const p2 = parsePart2Data(ir.part2_data);
  add(p2.inspector_send_back_by);
  add(p2.inspector_rejected_by);
  for (const id of parseInspectorIds(p2.previous_inspector_ids)) add(id);
  if (Array.isArray(p2.return_history)) {
    for (const entry of p2.return_history) {
      if (entry && typeof entry === 'object') {
        add((entry as Record<string, unknown>).by_user_id);
      }
    }
  }
  return Array.from(ids);
}

function parsePart3Data(ir: { part3_data?: unknown }): Record<string, unknown> {
  const raw = ir.part3_data;
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** JSONB / client may store boolean loosely — avoid blocking forward. */
function isSection23MarkedComplete(p: Record<string, unknown>): boolean {
  const v = p.section23_complete;
  return v === true || v === 'true' || v === 1 || v === '1';
}

function hasReceivedDateTime(p: Record<string, unknown>): boolean {
  return String(p.received_date_time ?? '').trim() !== '';
}

function toPositiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function sameUserId(a: unknown, b: number): boolean {
  return toPositiveInt(a) === b;
}

function parsePart2Data(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

function hasInspectorsAssigned(ir: { inspector_id?: number | null; inspector_ids?: unknown }): boolean {
  return collectInspectorIds(ir).length > 0;
}

function hasPart4Saved(ir: { part4_data?: unknown }): boolean {
  const p = ir.part4_data;
  if (p == null) return false;
  if (typeof p === 'string') return p.trim() !== '' && p !== '{}';
  if (typeof p === 'object') return Object.keys(p as object).length > 0;
  return false;
}

function parsePart4Data(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isNominatedTeamHeadActor(ir: { nominated_team_head_id?: unknown }, actorUserId: number): boolean {
  if (ir.nominated_team_head_id == null) return false;
  return Number(ir.nominated_team_head_id) === actorUserId;
}

/** Part I approval (after RA forward) is restricted to employee 1021 or admin. */
function assertPart1ApproverActingOnIr(
  userRole: string,
  employeeId?: string | null
): NextResponse | undefined {
  if (userRole === 'administrator') return undefined;
  if (employeeIsPart1Approver(employeeId)) return undefined;
  return NextResponse.json(
    {
      error: `Only employee ${PART1_APPROVER_EMPLOYEE_ID} (Part I approver) can act on this IR`,
    },
    { status: 403 }
  );
}

/** Request Approver (or nominated DH + Initiator/Designer) forward/send-back/reject on the first queue. */
function assertRequestApproverActingOnIr(
  ir: { nominated_request_approver_id?: unknown },
  userId: number,
  userRole: string,
  designation?: string | null
): NextResponse | undefined {
  if (canActAsNominatedRequestCertifier(userId, userRole, designation, ir)) {
    return undefined;
  }
  const nominated =
    ir.nominated_request_approver_id != null ? Number(ir.nominated_request_approver_id) : null;
  if (nominated != null && Number.isFinite(nominated) && nominated > 0 && nominated !== userId) {
    return NextResponse.json(
      { error: 'Only the nominated Request Approver (field 21) can perform this action' },
      { status: 403 }
    );
  }
  return NextResponse.json(
    {
      error:
        'Only the nominated Request Approver, or Initiator/Designer with designation DH selected on field 21, can perform this action',
    },
    { status: 403 }
  );
}

async function logActivity(irId: string, type: string, description: string, userId: number) {
  await query(
    `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id) VALUES ($1, $2, $3, $4)`,
    [irId, type, description, userId]
  );
}

/** Migration 015 — older deployments may not have run migrations; safe to repeat. */
async function ensureRequestApproverSendBackColumn(): Promise<void> {
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS request_approver_send_back_comment TEXT`
  );
}

/** Request Approver forward comment for QA Head (migration 020). */
async function ensureRequestApproverForwardCommentColumn(): Promise<void> {
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS request_approver_forward_comment TEXT`
  );
}

async function ensurePart1ApprovedByColumn(): Promise<void> {
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS part1_approved_by INTEGER`
  );
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS part1_approved_at TIMESTAMPTZ`
  );
}

/** Migration 016 — Team Head – QA send back */
async function ensureQaApproverSendBackColumns(): Promise<void> {
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS qa_approver_send_back_comment TEXT`
  );
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS qa_approver_send_back_to VARCHAR(32)`
  );
}

/** ORDAQA assignee send back (migration 019). */
async function ensureOrdaqaInspectorSendBackColumns(): Promise<void> {
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS ordaqa_inspector_send_back_comment TEXT`
  );
  await query(
    `ALTER TABLE inspection_requests ADD COLUMN IF NOT EXISTS ordaqa_inspector_send_back_to VARCHAR(32)`
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt((session.user as any).id);
    const userRole = (session.user as any).role;
    const employeeId = (session.user as any).employee_id as string | undefined;
    const designation = (session.user as any).designation as string | undefined;
    const body = await request.json();
    const { action } = body;

    const existing = await query('SELECT * FROM inspection_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const ir = existing.rows[0];

    const assignedToActor =
      collectInspectorIds(ir).includes(userId) ||
      (ir.inspector_id != null && Number(ir.inspector_id) === userId) ||
      (ir.ordaqa_inspector_id != null && Number(ir.ordaqa_inspector_id) === userId) ||
      (ir.nominated_team_head_id != null && Number(ir.nominated_team_head_id) === userId) ||
      (ir.qa_approver_id != null && Number(ir.qa_approver_id) === userId);
    const canAccess =
      assignedToActor ||
      (await userCanAccessInspectionRequest(userRole, userId, ir, employeeId, designation));
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    switch (action) {
      case 'submit_for_approval': {
        if (ir.initiator_id !== userId && userRole !== 'administrator') {
          return NextResponse.json(
            { error: 'Only the user who created Part I (or an administrator) can submit for approval' },
            { status: 403 }
          );
        }
        if (ir.status !== 'pending' && ir.status !== 'draft' && ir.status !== 'returned_to_designer') {
          return NextResponse.json({ error: 'IR must be in draft/pending or returned to designer' }, { status: 400 });
        }
        const wasReturned = ir.status === 'returned_to_designer';
        const p2Before = parsePart2Data(ir.part2_data);
        await ensureRequestApproverSendBackColumn();
        await ensureRequestApproverForwardCommentColumn();
        await ensureQaApproverSendBackColumns();
        await ensureOrdaqaInspectorSendBackColumns();
        await query(
          `UPDATE inspection_requests
           SET status = 'pending_request_approval',
               request_approver_send_back_comment = NULL,
               request_approver_forward_comment = NULL,
               qa_approver_send_back_comment = NULL,
               qa_approver_send_back_to = NULL,
               ordaqa_inspector_send_back_comment = NULL,
               ordaqa_inspector_send_back_to = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [id]
        );
        await logActivity(id, 'submitted', 'IR submitted for Request Approver forward', userId);
        await notifyRequestApproversPendingForward(
          parseInt(id, 10),
          ir.request_number,
          ir.initiator_id,
          ir.nominated_request_approver_id != null ? Number(ir.nominated_request_approver_id) : null
        );
        try {
          await notifyInitiatorIrMilestone(ir.initiator_id, parseInt(id, 10), String(ir.request_number), {
            title: 'Submitted for Request Approver forward',
            message: `Your inspection request ${ir.request_number} was submitted and is awaiting Request Approver forward.`,
            type: 'request_submitted',
          });
        } catch (e) {
          console.error('Initiator submit-for-approval notification:', e);
        }
        if (wasReturned && p2Before.qa_pipeline_touched === true) {
          await notifyQaHeadsResubmittedAfterReturn(parseInt(id, 10), ir.request_number);
        }
        return NextResponse.json({ message: 'Submitted for Request Approver approval' });
      }

      case 'request_approve': {
        {
          const deny = assertRequestApproverActingOnIr(ir, userId, userRole, designation);
          if (deny) return deny;
        }
        if (ir.status !== 'pending_request_approval' && ir.status !== 'pending') {
          return NextResponse.json({ error: 'IR is not pending Request Approver forward' }, { status: 400 });
        }
        {
          let docs = ir.document_details;
          if (typeof docs === 'string') {
            try {
              docs = JSON.parse(docs);
            } catch {
              docs = null;
            }
          }
          const documentDetailsError = validatePart1DocumentDetailsForward(docs);
          if (documentDetailsError) {
            return NextResponse.json({ error: documentDetailsError }, { status: 400 });
          }
        }
        const { comments } = body as { comments?: string };
        const trimmedForwardComment = typeof comments === 'string' ? comments.trim() : '';
        await ensureRequestApproverForwardCommentColumn();
        await query(
          `UPDATE inspection_requests 
           SET status = 'pending_part1_approval', 
               request_approver_id = $2, 
               request_approval_date = NOW(),
               request_approver_forward_comment = $3,
               updated_at = NOW() 
           WHERE id = $1`,
          [id, userId, trimmedForwardComment || null]
        );
        await logActivity(
          id,
          'request_forwarded',
          trimmedForwardComment
            ? `Request forwarded by Request Approver for Part I approval: ${trimmedForwardComment}`
            : 'Request forwarded by Request Approver for Part I approval',
          userId
        );
        try {
          const forwardedByName =
            (session.user as { name?: string })?.name?.trim() || 'Request Approver';
          await notifyPart1ApproverAfterRequestApproverForward(
            parseInt(id, 10),
            ir.request_number,
            forwardedByName,
            ir.initiator_id,
            trimmedForwardComment
          );
        } catch (e) {
          console.error('Part I approver forward notification:', e);
        }
        return NextResponse.json({ message: 'Request forwarded for Part I approval' });
      }

      case 'part1_approve': {
        {
          const deny = assertPart1ApproverActingOnIr(userRole, employeeId);
          if (deny) return deny;
        }
        if (ir.status !== 'pending_part1_approval') {
          return NextResponse.json(
            { error: 'IR must be pending Part I approval (after Request Approver forward)' },
            { status: 400 }
          );
        }
        {
          let docs = ir.document_details;
          if (typeof docs === 'string') {
            try {
              docs = JSON.parse(docs);
            } catch {
              docs = null;
            }
          }
          const documentDetailsError = validatePart1DocumentDetailsForward(docs);
          if (documentDetailsError) {
            return NextResponse.json({ error: documentDetailsError }, { status: 400 });
          }
        }
        const { comments } = body as { comments?: string };
        const trimmedPart1Comment = typeof comments === 'string' ? comments.trim() : '';
        await ensureRequestApproverForwardCommentColumn();
        await ensurePart1ApprovedByColumn();
        const priorComment =
          typeof ir.request_approver_forward_comment === 'string'
            ? ir.request_approver_forward_comment.trim()
            : '';
        const combinedComment = [priorComment, trimmedPart1Comment ? `Part I: ${trimmedPart1Comment}` : '']
          .filter(Boolean)
          .join('\n') || null;
        await query(
          `UPDATE inspection_requests
           SET status = 'request_approved',
               request_approver_forward_comment = COALESCE($2, request_approver_forward_comment),
               part1_approved_by = $3,
               part1_approved_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [id, combinedComment, userId]
        );
        // DGAQA-only (no R&QA): skip Part II — auto-forward to ORDAQA for Part III
        const dgaqaOnly =
          dgaqaInvolvedInPart1(ir) && inspectionSkipsRqaPart2AndPart4(ir);
        if (dgaqaOnly) {
          await query(
            `UPDATE inspection_requests
             SET forwarded_to_ordaqa = TRUE, updated_at = NOW()
             WHERE id = $1`,
            [id]
          );
        }
        await logActivity(
          id,
          'part1_approved',
          trimmedPart1Comment
            ? `Part I approved by employee ${PART1_APPROVER_EMPLOYEE_ID}: ${trimmedPart1Comment}`
            : `Part I approved by employee ${PART1_APPROVER_EMPLOYEE_ID}`,
          userId
        );
        try {
          const approvedByName =
            (session.user as { name?: string })?.name?.trim() || `Employee ${PART1_APPROVER_EMPLOYEE_ID}`;
          if (dgaqaOnly) {
            await notifyOrdaqaHeadsForwardedToOrdaqa(
              parseInt(id, 10),
              ir.request_number,
              ir.initiator_id
            );
          } else if (!inspectionSkipsRqaPart2AndPart4(ir)) {
            await notifyQaHeadsAfterRequestApproverForward(
              parseInt(id, 10),
              ir.request_number,
              approvedByName,
              ir.initiator_id,
              trimmedPart1Comment || priorComment || null
            );
          } else {
            await notifyIrStakeholders(
              parseInt(id, 10),
              {
                title: 'Part I approved',
                message: `Inspection request ${ir.request_number} was approved by ${approvedByName}.`,
                type: 'request_approved',
              },
              { extraUserIds: snapshotIrStakeholderIds(ir) }
            );
          }
        } catch (e) {
          console.error('QA Head / ORDAQA Part I approval notification:', e);
        }
        return NextResponse.json({
          message: dgaqaOnly
            ? 'Part I approved; forwarded to ORDAQA (R&QA Part II/IV not required)'
            : 'Part I approved; forwarded to QA Head',
        });
      }

      case 'request_reject': {
        const isRaQueue = ir.status === 'pending_request_approval' || ir.status === 'pending';
        const isPart1Queue = ir.status === 'pending_part1_approval';
        if (!isRaQueue && !isPart1Queue) {
          return NextResponse.json({ error: 'IR is not pending approval' }, { status: 400 });
        }
        if (isRaQueue) {
          const deny = assertRequestApproverActingOnIr(ir, userId, userRole, designation);
          if (deny) return deny;
        } else {
          const deny = assertPart1ApproverActingOnIr(userRole, employeeId);
          if (deny) return deny;
        }
        const { reason } = body;
        const rejectLabel = isPart1Queue ? 'Forward Request' : 'Part I Approver';
        await query(
          `UPDATE inspection_requests 
           SET status = 'rejected', 
               rejection_reason = $2,
               updated_at = NOW() 
           WHERE id = $1`,
          [id, reason || `Rejected by ${rejectLabel}`]
        );
        await logActivity(id, 'rejected', `Request rejected: ${reason || 'No reason provided'}`, userId);
        try {
          await notifyInspectionRejected(
            parseInt(id, 10),
            String(ir.request_number),
            ir.initiator_id,
            undefined,
            reason || `Rejected by ${rejectLabel}`,
            userId,
            snapshotIrStakeholderIds(ir)
          );
        } catch (e) {
          console.error('Initiator request-reject notification:', e);
        }
        return NextResponse.json({ message: 'Request rejected' });
      }

      case 'request_send_back': {
        // Part I Approver (1021) cannot send back — only Request Approver on their queue.
        const isRaQueue = ir.status === 'pending_request_approval' || ir.status === 'pending';
        if (!isRaQueue) {
          return NextResponse.json(
            { error: 'Send back is not available on the Forward Request queue' },
            { status: 403 }
          );
        }
        const deny = assertRequestApproverActingOnIr(ir, userId, userRole, designation);
        if (deny) return deny;
        const { comments } = body as { comments?: string };
        const trimmed = typeof comments === 'string' ? comments.trim() : '';
        if (!trimmed) {
          return NextResponse.json({ error: 'Comment is required to send back' }, { status: 400 });
        }
        await ensureRequestApproverSendBackColumn();
        await ensurePart1ApprovedByColumn();
        await query(
          `UPDATE inspection_requests
           SET status = 'returned_to_designer',
               request_approver_send_back_comment = $2,
               part1_approved_by = NULL,
               part1_approved_at = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [id, trimmed]
        );
        await logActivity(
          id,
          'request_send_back',
          `Request Approver sent back for Part I: ${trimmed.slice(0, 200)}${trimmed.length > 200 ? '…' : ''}`,
          userId
        );
        await notifyInitiatorRequestApproverSendBack(
          parseInt(id, 10),
          ir.request_number,
          ir.initiator_id,
          trimmed,
          userId,
          snapshotIrStakeholderIds(ir)
        );
        return NextResponse.json({ message: 'Request sent back to initiator for corrections' });
      }

      case 'save_part2_step1': {
        if (userRole !== 'qa_head' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only QA Head can complete Part II Step 1' }, { status: 403 });
        }
        if (inspectionSkipsRqaPart2AndPart4(ir)) {
          return NextResponse.json(
            { error: 'Part II is not used when Part I R&QA involvement is No' },
            { status: 400 }
          );
        }
        const memoAwaitingQaHead = (() => {
          if (isForwardedToOrdqa(ir)) return false;
          const p3 = parsePart3Data(ir);
          return String(p3.memo_returned ?? '').trim().toLowerCase() === 'yes';
        })();
        if (userRole === 'qa_head' && hasInspectorsAssigned(ir) && !memoAwaitingQaHead) {
          return NextResponse.json(
            {
              error:
                'Part II cannot be edited by QA Head after Inspector(s) have been assigned by Team Head – QA',
            },
            { status: 400 }
          );
        }
        const part2EditableStatuses = ['request_approved', 'assigned', 'in_progress'];
        if (!part2EditableStatuses.includes(ir.status)) {
          return NextResponse.json(
            {
              error:
                'Part II can only be edited while the IR is forwarded, assigned, or in progress (before inspection completion).',
            },
            { status: 400 }
          );
        }
        const isPart2Update = !!ir.nominated_team_head_id;
        if (!isPart2Update && ir.status !== 'request_approved') {
          return NextResponse.json(
            { error: 'Initial Part II Step 1 is only available after Request Approver has forwarded the IR.' },
            { status: 400 }
          );
        }
        const { nominated_team_head_id: bodyNominatedId, forward_to_ordaqa: fwdOrdaqaRaw, part2_notes: p2notes, part2_data: p2data } = body;
        // QA Head may forward to ORDAQA even when Part I DGAQA involvement is No
        const fwdOrdaqa = !!fwdOrdaqaRaw;
        const incomingP2Early =
          p2data && typeof p2data === 'object' ? (p2data as Record<string, unknown>) : parsePart2Data(p2data);
        const wantsReturnEarly = incomingP2Early.return_to_designer === 'yes';

        if (!bodyNominatedId && !wantsReturnEarly) {
          return NextResponse.json({ error: 'Team Head - QA must be selected' }, { status: 400 });
        }

        const inspectorsLocked = hasInspectorsAssigned(ir) && !memoAwaitingQaHead;
        if (
          bodyNominatedId &&
          inspectorsLocked &&
          Number(bodyNominatedId) !== Number(ir.nominated_team_head_id)
        ) {
          return NextResponse.json(
            {
              error:
                'Inspectors are already assigned. Change nominated Team Head only after unassigning inspectors, or keep the current Team Head.',
            },
            { status: 400 }
          );
        }

        const effectiveNominatedId = wantsReturnEarly
          ? bodyNominatedId
            ? Number(bodyNominatedId)
            : 0
          : inspectorsLocked
            ? Number(ir.nominated_team_head_id)
            : Number(bodyNominatedId);

        if (
          !wantsReturnEarly &&
          effectiveNominatedId > 0 &&
          !(await isEligibleRqaTeamHead(effectiveNominatedId))
        ) {
          return NextResponse.json(
            {
              error:
                'Team Head - QA must be an active Team Head (TH) in the R&QA department',
            },
            { status: 400 }
          );
        }

        const incomingP2 = incomingP2Early;
        const wantsReturn = wantsReturnEarly;

        if (memoAwaitingQaHead && !wantsReturn && !fwdOrdaqa) {
          return NextResponse.json(
            {
              error:
                'ORDAQA returned the memo — turn on Forward to ORDAQA and resubmit Part II so ORDAQA can complete Section 23 again',
            },
            { status: 400 }
          );
        }

        if (wantsReturn) {
          const canReturnAfterMemo =
            memoAwaitingQaHead &&
            ['request_approved', 'assigned', 'in_progress'].includes(String(ir.status || ''));
          if (ir.status !== 'request_approved' && !canReturnAfterMemo) {
            return NextResponse.json(
              {
                error:
                  'Return to designer is only available while the IR is in Forwarded status (before inspection has started), or after ORDAQA memo return.',
              },
              { status: 400 }
            );
          }
          const comments = String(p2notes || incomingP2.head_rqa_comments || '').trim();
          if (!comments) {
            return NextResponse.json(
              { error: 'Head R&QA comments are required when returning the IR to the designer' },
              { status: 400 }
            );
          }
          const existingP2 = parsePart2Data(ir.part2_data);
          const prevHistory = Array.isArray(existingP2.return_history)
            ? (existingP2.return_history as unknown[])
            : [];
          const mergedP2 = {
            ...existingP2,
            ...incomingP2,
            head_rqa_comments: comments,
            return_to_designer: 'yes',
            qa_pipeline_touched: true,
            return_history: [
              ...prevHistory,
              {
                at: new Date().toISOString(),
                by_user_id: userId,
                comments,
                return_to_designer: 'yes',
                nominated_team_head_id: effectiveNominatedId > 0 ? effectiveNominatedId : null,
              },
            ],
          };
          const actorName = (session.user as { name?: string })?.name || 'QA Head';
          const returnStakeholders = snapshotIrStakeholderIds(ir);
          await query(
            `UPDATE inspection_requests
             SET status = 'returned_to_designer',
                 qa_approver_id = $2,
                 nominated_team_head_id = NULL,
                 inspector_id = NULL,
                 inspector_ids = '[]',
                 forwarded_to_ordaqa = false,
                 part2_notes = $3,
                 part2_data = $4,
                 part2_date = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [id, userId, comments, JSON.stringify(mergedP2)]
          );
          await logActivity(
            id,
            'returned_to_designer',
            'Part II — IR returned to designer/initiator (Section 22)',
            userId
          );
          const reqApprId = ir.request_approver_id != null ? Number(ir.request_approver_id) : null;
          await notifyReturnedToDesignerByQaHead(
            parseInt(id, 10),
            ir.request_number,
            ir.initiator_id,
            reqApprId,
            effectiveNominatedId > 0 ? effectiveNominatedId : null,
            comments,
            actorName,
            userId,
            returnStakeholders
          );
          return NextResponse.json({
            message: 'IR returned to designer. Initiator may edit Part I and resubmit to Request Approver.',
          });
        }

        const existingP2 = parsePart2Data(ir.part2_data);
        const mergedP2 = { ...existingP2, ...incomingP2 };
        const p2Json = JSON.stringify(mergedP2);

        const prevNominatedId =
          ir.nominated_team_head_id != null ? Number(ir.nominated_team_head_id) : null;

        let teamHeadName = String(mergedP2.nominated_team_head || '').trim();
        if (!teamHeadName && effectiveNominatedId > 0) {
          const thRes = await query(
            `SELECT name FROM users WHERE id = $1`,
            [effectiveNominatedId]
          );
          teamHeadName = String(thRes.rows[0]?.name || '').trim();
        }
        if (!teamHeadName) teamHeadName = 'Team Head - QA';

        await query(
          `UPDATE inspection_requests
           SET qa_approver_id = $2, nominated_team_head_id = $3,
               forwarded_to_ordaqa = $4, part2_notes = $5, part2_data = $6,
               part2_date = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [id, userId, effectiveNominatedId, !!fwdOrdaqa, p2notes || null, p2Json]
        );
        await logActivity(
          id,
          isPart2Update ? 'part2_step1_updated' : 'part2_step1',
          isPart2Update
            ? 'Part II Step 1 updated by QA Head'
            : 'Part II Step 1 completed by QA Head — Team Head nominated',
          userId
        );
        if (
          effectiveNominatedId > 0 &&
          effectiveNominatedId !== prevNominatedId
        ) {
          try {
            const nominatorName =
              (session.user as { name?: string })?.name?.trim() || 'QA Head';
            await notifyNominatedTeamHeadQaPart2(
              parseInt(id, 10),
              String(ir.request_number),
              effectiveNominatedId,
              nominatorName,
              ir.initiator_id
            );
          } catch (e) {
            console.error('Nominated Team Head QA notification:', e);
          }
        }
        const newlyForwardedToOrdaqa = !!fwdOrdaqa && !ir.forwarded_to_ordaqa;
        if (newlyForwardedToOrdaqa) {
          const existingP3 = parsePart3Data(ir);
          if (String(existingP3.memo_returned ?? '').toLowerCase() === 'yes') {
            // Clear Section 23 and mark as re-forwarded so ORDAQA Head sees a distinct Action Required
            const resetP3: Record<string, unknown> = { ...existingP3 };
            delete resetP3.section23_complete;
            delete resetP3.delegation_type;
            delete resetP3.assigned_delegated_to;
            delete resetP3.received_date_time;
            delete resetP3.ordaqa_comments;
            delete resetP3.oic_ordaqa_name;
            resetP3.memo_returned = 'no';
            resetP3.reforwarded_after_memo = true;
            resetP3.reforwarded_at = new Date().toISOString();
            resetP3.reforwarded_by_user_id = userId;
            resetP3.reforwarded_by_role = 'qa_head';
            await query(
              `UPDATE inspection_requests
               SET part3_data = $2, ordaqa_inspector_id = NULL, part3_completed_by = NULL, part3_date = NULL, updated_at = NOW()
               WHERE id = $1`,
              [id, JSON.stringify(resetP3)]
            );
            await logActivity(
              id,
              'part2_reforwarded_to_ordaqa',
              'Part II re-forwarded to ORDAQA by QA Head after memo return',
              userId
            );
          }
          try {
            await notifyOrdaqaHeadsForwardedToOrdaqa(
              parseInt(id, 10),
              String(ir.request_number),
              ir.initiator_id
            );
          } catch (e) {
            console.error('ORDAQA Head forward notification:', e);
          }
        }
        return NextResponse.json({
          message:
            newlyForwardedToOrdaqa && memoAwaitingQaHead
              ? 'Part II resubmitted — forwarded to ORDAQA again for Section 23'
              : isPart2Update
                ? `Part II updated — forwarded to ${teamHeadName}`
                : `Inspection request forwarded to ${teamHeadName}`,
          nominated_team_head_name: teamHeadName,
          forwarded_to_team_head: true,
          forwarded_to_ordaqa: !!fwdOrdaqa,
        });
      }

      case 'assign_inspector': {
        if (inspectionSkipsRqaPart2AndPart4(ir)) {
          return NextResponse.json(
            { error: 'Part II is not used when Part I R&QA involvement is No' },
            { status: 400 }
          );
        }
        const isNominatedTeamHead = isNominatedTeamHeadActor(ir, userId);
        if (!isNominatedTeamHead && userRole !== 'qa_head' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only the nominated Team Head - QA can assign inspectors' }, { status: 403 });
        }
        if (!ir.nominated_team_head_id) {
          return NextResponse.json({ error: 'QA Head must complete Part II Step 1 first' }, { status: 400 });
        }
        const alreadyAssigned = hasInspectorsAssigned(ir);
        const previousInspectorIds = collectInspectorIds(ir);
        const allowedStatuses = alreadyAssigned
          ? ['assigned', 'in_progress']
          : ['request_approved'];
        if (!allowedStatuses.includes(ir.status)) {
          return NextResponse.json(
            {
              error: alreadyAssigned
                ? 'Inspector assignment can only be updated while status is Assigned or In Progress'
                : 'IR must be approved by Request Approver first',
            },
            { status: 400 }
          );
        }
        if (alreadyAssigned && part2OutstationDetailsSubmitted(ir)) {
          return NextResponse.json(
            {
              error: 'Inspector assignment cannot be changed after Outstation details are submitted',
            },
            { status: 400 }
          );
        }
        const { inspector_ids: inspIds, inspector_id: singleInspId } = body;
        const rawList = inspIds || (singleInspId ? [singleInspId] : []);
        const inspectorIds = [
          ...new Set(
            rawList
              .map((x: unknown) => parseInt(String(x), 10))
              .filter((n: number) => Number.isFinite(n) && n > 0)
          ),
        ];
        if (!inspectorIds.length) {
          return NextResponse.json({ error: 'At least one Inspector must be selected' }, { status: 400 });
        }

        const validateTeamHeadPart2 = (incoming: Record<string, unknown> | null): string | null => {
          if (!incoming) {
            return 'Part II details are required';
          }
          // Outstation Email Sent / Name & Sign / Date & Time are filled later by R&QA Inspector
          return null;
        };

        const incomingP2ForValidate =
          body.part2_data && typeof body.part2_data === 'object'
            ? (body.part2_data as Record<string, unknown>)
            : null;
        const teamHeadPart2Err = validateTeamHeadPart2(incomingP2ForValidate);
        if (teamHeadPart2Err) {
          return NextResponse.json({ error: teamHeadPart2Err }, { status: 400 });
        }

        if (alreadyAssigned) {
          const incomingP2 =
            body.part2_data && typeof body.part2_data === 'object'
              ? (body.part2_data as Record<string, unknown>)
              : null;
          if (incomingP2) {
            const existingP2 = parsePart2Data(ir.part2_data);
            const outstationInspection = !!incomingP2.outstation_inspection;
            const mergedP2 = {
              ...existingP2,
              third_party_agency: String(incomingP2.third_party_agency || ''),
              outstation_inspection: outstationInspection,
              // Keep inspector-filled email fields when outstation stays on; clear when off
              email_sent: outstationInspection ? (existingP2.email_sent ?? null) : null,
              email_sent_by: outstationInspection ? (existingP2.email_sent_by ?? null) : null,
              email_sent_date: outstationInspection ? (existingP2.email_sent_date ?? null) : null,
              team_head_comments: String(incomingP2.team_head_comments || '').trim(),
            };
            await query(
              `UPDATE inspection_requests
               SET inspector_id = $2, inspector_ids = $3,
                   part2_data = $4,
                   updated_at = NOW()
               WHERE id = $1`,
              [id, inspectorIds[0], JSON.stringify(inspectorIds), JSON.stringify(mergedP2)]
            );
          } else {
            await query(
              `UPDATE inspection_requests
               SET inspector_id = $2, inspector_ids = $3,
                   updated_at = NOW()
               WHERE id = $1`,
              [id, inspectorIds[0], JSON.stringify(inspectorIds)]
            );
          }
          await logActivity(
            id,
            'assigned',
            `Inspector assignment updated by Team Head (${inspectorIds.length} inspector(s))`,
            userId
          );
        } else {
          const incomingP2 =
            body.part2_data && typeof body.part2_data === 'object'
              ? (body.part2_data as Record<string, unknown>)
              : null;
          const existingP2 = parsePart2Data(ir.part2_data);
          let mergedP2 = existingP2;
          if (incomingP2) {
            const outstationInspection = !!incomingP2.outstation_inspection;
            mergedP2 = {
              ...existingP2,
              third_party_agency: String(incomingP2.third_party_agency || ''),
              outstation_inspection: outstationInspection,
              // Email fields are filled later by assigned R&QA Inspector
              email_sent: outstationInspection ? (existingP2.email_sent ?? null) : null,
              email_sent_by: outstationInspection ? (existingP2.email_sent_by ?? null) : null,
              email_sent_date: outstationInspection ? (existingP2.email_sent_date ?? null) : null,
              team_head_comments: String(incomingP2.team_head_comments || '').trim(),
            };
          }
          await query(
            `UPDATE inspection_requests
             SET status = 'assigned', inspector_id = $2, inspector_ids = $3,
                 part2_data = $4,
                 updated_at = NOW()
             WHERE id = $1`,
            [id, inspectorIds[0], JSON.stringify(inspectorIds), JSON.stringify(mergedP2)]
          );
          await logActivity(
            id,
            'assigned',
            `${inspectorIds.length} inspector(s) assigned by Team Head — Part II completed`,
            userId
          );
        }
        try {
          const teamHeadName =
            (session.user as { name?: string })?.name?.trim() || 'Team Head – QA';
          const outstationOn = Boolean(
            incomingP2ForValidate?.outstation_inspection ??
              parsePart2Data(ir.part2_data).outstation_inspection
          );
          if (alreadyAssigned) {
            await notifyInspectorsReassignedPart2(
              parseInt(id, 10),
              String(ir.request_number),
              previousInspectorIds,
              inspectorIds,
              ir.initiator_id,
              teamHeadName,
              outstationOn
            );
          } else {
            await notifyInspectorsAssignedPart2(
              parseInt(id, 10),
              String(ir.request_number),
              inspectorIds,
              ir.initiator_id,
              teamHeadName,
              outstationOn
            );
          }
        } catch (e) {
          console.error('Part II inspector assignment notifications:', e);
        }
        return NextResponse.json({
          message: alreadyAssigned
            ? 'Inspector assignment updated'
            : 'Inspector(s) assigned (Part II completed)',
        });
      }

      case 'save_part2_inspector_details': {
        if (inspectionSkipsRqaPart2AndPart4(ir)) {
          return NextResponse.json(
            { error: 'Part II is not used when Part I R&QA involvement is No' },
            { status: 400 }
          );
        }
        if (userRole !== 'inspector' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only assigned inspector can update these Part II details' }, { status: 403 });
        }
        if (!['assigned', 'in_progress'].includes(ir.status)) {
          return NextResponse.json({ error: 'Inspector Part II details can only be updated after assignment' }, { status: 400 });
        }
        if (part2OutstationEditLockedByPart3(ir)) {
          return NextResponse.json(
            {
              error:
                'Outstation details cannot be edited after ORDAQA Head has submitted Part III (Section 23)',
            },
            { status: 400 }
          );
        }
        if (userRole === 'inspector') {
          const ids = parseInspectorIds(ir.inspector_ids);
          const isAssigned = ids.length > 0 ? ids.includes(userId) : ir.inspector_id === userId;
          if (!isAssigned) {
            return NextResponse.json({ error: 'Only an assigned inspector can update these fields' }, { status: 403 });
          }
        }

        const incomingP2 =
          body.part2_data && typeof body.part2_data === 'object'
            ? (body.part2_data as Record<string, unknown>)
            : parsePart2Data(body.part2_data);
        const existingP2 = parsePart2Data(ir.part2_data);
        if (!existingP2.outstation_inspection) {
          return NextResponse.json(
            { error: 'Outstation Inspection is not enabled by Team Head – QA' },
            { status: 400 }
          );
        }
        const emailSent = String(incomingP2.email_sent || '').trim().toLowerCase();
        if (emailSent !== 'yes' && emailSent !== 'no') {
          return NextResponse.json(
            { error: 'Outstation Inspection: Email Sent is required (Yes or No)' },
            { status: 400 }
          );
        }
        if (!String(incomingP2.email_sent_by || '').trim()) {
          return NextResponse.json(
            { error: 'Outstation Inspection: Name & Sign is required' },
            { status: 400 }
          );
        }
        if (!String(incomingP2.email_sent_date || '').trim()) {
          return NextResponse.json(
            { error: 'Outstation Inspection: Date & Time is required' },
            { status: 400 }
          );
        }
        const mergedP2 = {
          ...existingP2,
          outstation_inspection: true,
          email_sent: emailSent,
          email_sent_by: String(incomingP2.email_sent_by || '').trim(),
          email_sent_date: String(incomingP2.email_sent_date || '').trim(),
        };

        await query(
          `UPDATE inspection_requests
           SET part2_data = $2,
               part2_date = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [id, JSON.stringify(mergedP2)]
        );
        await logActivity(
          id,
          'part2_inspector_details_updated',
          'Part II outstation email details updated by assigned R&QA inspector',
          userId
        );
        return NextResponse.json({ message: 'Outstation details saved' });
      }

      case 'inspector_reject_ir': {
        if (!canUserInspectorOutstationRejectOrSendBack(ir, userId, userRole)) {
          return NextResponse.json(
            {
              error:
                'Only an assigned R&QA inspector can reject before Part IV is submitted for Team Head approval',
            },
            { status: 403 }
          );
        }
        const rejectComment =
          typeof (body as { comments?: string; reason?: string }).comments === 'string'
            ? (body as { comments?: string }).comments!.trim()
            : typeof (body as { reason?: string }).reason === 'string'
              ? (body as { reason?: string }).reason!.trim()
              : '';
        if (!rejectComment) {
          return NextResponse.json({ error: 'Comment is required to reject' }, { status: 400 });
        }

        const existingP2RejectInsp = parsePart2Data(ir.part2_data);
        const prevRejectHist = Array.isArray(existingP2RejectInsp.return_history)
          ? (existingP2RejectInsp.return_history as unknown[])
          : [];
        const mergedP2RejectInsp = {
          ...existingP2RejectInsp,
          inspector_reject_comment: rejectComment,
          inspector_rejected_at: new Date().toISOString(),
          inspector_rejected_by: userId,
          return_history: [
            ...prevRejectHist,
            {
              at: new Date().toISOString(),
              by_user_id: userId,
              role: 'inspector_reject_ir',
              comments: rejectComment,
              prior_status: ir.status,
            },
          ],
        };

        await query(
          `UPDATE inspection_requests
           SET status = 'rejected',
               rejection_reason = $2,
               part2_data = $3,
               updated_at = NOW()
           WHERE id = $1`,
          [id, rejectComment, JSON.stringify(mergedP2RejectInsp)]
        );
        await logActivity(
          id,
          'rejected',
          `IR rejected by R&QA Inspector: ${rejectComment.slice(0, 200)}${rejectComment.length > 200 ? '…' : ''}`,
          userId
        );

        const inspectorActorName =
          (session.user as { name?: string })?.name?.trim() || 'R&QA Inspector';
        try {
          await notifyStakeholdersInspectorOutstationRejected(
            parseInt(id, 10),
            String(ir.request_number),
            inspectorActorName,
            rejectComment,
            userId,
            snapshotIrStakeholderIds(ir)
          );
        } catch (e) {
          console.error('Inspector reject notifications:', e);
        }
        return NextResponse.json({ message: 'Inspection request rejected' });
      }

      case 'inspector_send_back_to_team_head': {
        if (!canUserInspectorOutstationRejectOrSendBack(ir, userId, userRole)) {
          return NextResponse.json(
            {
              error:
                'Only an assigned R&QA inspector can send back before Part IV is submitted for Team Head approval',
            },
            { status: 403 }
          );
        }
        if (!ir.nominated_team_head_id) {
          return NextResponse.json(
            { error: 'No Team Head – QA is nominated on this IR' },
            { status: 400 }
          );
        }
        const sendBackComment =
          typeof (body as { comments?: string }).comments === 'string'
            ? (body as { comments?: string }).comments!.trim()
            : '';
        if (!sendBackComment) {
          return NextResponse.json({ error: 'Comment is required to send back' }, { status: 400 });
        }

        const existingP2SendBack = parsePart2Data(ir.part2_data);
        const prevSendHist = Array.isArray(existingP2SendBack.return_history)
          ? (existingP2SendBack.return_history as unknown[])
          : [];
        const previousInspectorIds = [
          ...new Set([
            ...parseInspectorIds(existingP2SendBack.previous_inspector_ids),
            ...collectInspectorIds(ir),
          ]),
        ];
        const mergedP2SendBack = {
          ...existingP2SendBack,
          inspector_send_back_comment: sendBackComment,
          inspector_send_back_at: new Date().toISOString(),
          inspector_send_back_by: userId,
          previous_inspector_ids: previousInspectorIds,
          // Clear Outstation fill fields so Team Head / next assignee starts clean
          email_sent: null,
          email_sent_by: null,
          email_sent_date: null,
          return_history: [
            ...prevSendHist,
            {
              at: new Date().toISOString(),
              by_user_id: userId,
              role: 'inspector_send_back_to_team_head',
              comments: sendBackComment,
              prior_status: ir.status,
            },
          ],
        };

        const sendBackActorName =
          (session.user as { name?: string })?.name?.trim() || 'R&QA Inspector';
        const sendBackStakeholders = snapshotIrStakeholderIds(ir);
        await query(
          `UPDATE inspection_requests
           SET status = 'request_approved',
               inspector_id = NULL,
               inspector_ids = '[]',
               part2_data = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [id, JSON.stringify(mergedP2SendBack)]
        );
        await logActivity(
          id,
          'inspector_send_back_to_team_head',
          `R&QA Inspector sent back to Team Head – QA: ${sendBackComment.slice(0, 200)}${sendBackComment.length > 200 ? '…' : ''}`,
          userId
        );

        try {
          await notifyStakeholdersInspectorOutstationSendBack(
            parseInt(id, 10),
            String(ir.request_number),
            sendBackActorName,
            sendBackComment,
            userId,
            sendBackStakeholders
          );
        } catch (e) {
          console.error('Inspector send-back notifications:', e);
        }
        return NextResponse.json({
          message: 'Sent back to Team Head – QA. They can review your comment and re-assign inspector(s).',
        });
      }

      case 'save_part3_section23': {
        if (inspectionSkipsPart2Part3(ir) && !isForwardedToOrdqa(ir)) {
          return NextResponse.json(
            { error: 'Part III is not used until QA Head forwards to ORDAQA' },
            { status: 400 }
          );
        }
        if (userRole !== 'ordaqa_head' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only ORDAQA Head can complete Section 23' }, { status: 403 });
        }
        if (!ir.forwarded_to_ordaqa) {
          return NextResponse.json({ error: 'IR is not forwarded to ORDAQA' }, { status: 400 });
        }
        if (part2OutstationDetailsIncomplete(ir)) {
          return NextResponse.json(
            {
              error:
                'Complete Part II Outstation details (Email Sent, Name & Sign, Date & Time) before Part III Section 23',
            },
            { status: 400 }
          );
        }
        if (inspectionPart4Saved(ir)) {
          return NextResponse.json(
            {
              error:
                'Part III Section 23 cannot be edited after Part IV has been submitted by the R&QA Inspector',
            },
            { status: 400 }
          );
        }
        if (!part3Section23EditableStatus(ir.status)) {
          return NextResponse.json(
            { error: 'Section 23 can only be edited while the IR is forwarded, assigned, or in progress' },
            { status: 400 }
          );
        }
        if (ir.ordaqa_inspector_id) {
          return NextResponse.json(
            { error: 'Section 23 is locked after forwarding to the ORDAQA Inspector' },
            { status: 400 }
          );
        }
        const { part3_data: p23 } = body;
        if (!p23 || typeof p23 !== 'object' || Array.isArray(p23)) {
          return NextResponse.json({ error: 'part3_data is required' }, { status: 400 });
        }
        const existing = parsePart3Data(ir);
        const merged = {
          ...existing,
          ...(p23 as Record<string, unknown>),
          section23_complete: true,
        };
        if (!hasReceivedDateTime(merged)) {
          return NextResponse.json({ error: 'Received date and time is required' }, { status: 400 });
        }
        await query(
          `UPDATE inspection_requests SET part3_data = $2, updated_at = NOW() WHERE id = $1`,
          [id, JSON.stringify(merged)]
        );
        await logActivity(id, 'part3_section23', 'Part III — Section 23 saved by ORDAQA Head', userId);
        try {
          const ordaqaHeadName =
            (session.user as { name?: string })?.name?.trim() || 'ORDAQA Head';
          const section23WasComplete = isSection23MarkedComplete(existing);
          if (!section23WasComplete) {
            await notifyPart2InspectorsPart3Completed(
              parseInt(id, 10),
              String(ir.request_number),
              collectInspectorIds(ir),
              ordaqaHeadName,
              ir.initiator_id
            );
          } else {
            await notifyInitiatorIrMilestone(ir.initiator_id, parseInt(id, 10), String(ir.request_number), {
              title: 'ORDAQA Part III — Section 23 saved',
              message: `Your inspection request ${ir.request_number}: ORDAQA Head saved Section 23. The IR will proceed to ORDAQA assignment.`,
              type: 'forwarded_to_ordaqa',
            });
          }
        } catch (e) {
          console.error('Initiator Part III Section 23 notification:', e);
        }
        return NextResponse.json({
          message: 'Section 23 saved. Forward to assignee — Sections 24–25 are completed in Part V after Part IV.',
        });
      }

      case 'save_part3_assignment': {
        if (inspectionSkipsPart2Part3(ir) && !isForwardedToOrdqa(ir)) {
          return NextResponse.json(
            { error: 'Part III is not used until QA Head forwards to ORDAQA' },
            { status: 400 }
          );
        }
        if (userRole !== 'ordaqa_head' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only ORDAQA Head can forward Part III to the inspector' }, { status: 403 });
        }
        if (!ir.forwarded_to_ordaqa) {
          return NextResponse.json({ error: 'IR is not forwarded to ORDAQA' }, { status: 400 });
        }
        if (part2OutstationDetailsIncomplete(ir)) {
          return NextResponse.json(
            {
              error:
                'Complete Part II Outstation details (Email Sent, Name & Sign, Date & Time) before Part III Section 23',
            },
            { status: 400 }
          );
        }
        if (inspectionPart4Saved(ir)) {
          return NextResponse.json(
            {
              error:
                'Part III Section 23 cannot be edited after Part IV has been submitted by the R&QA Inspector',
            },
            { status: 400 }
          );
        }
        if (!part3Section23EditableStatus(ir.status)) {
          return NextResponse.json(
            { error: 'Section 23 assignment can only be completed while the IR is forwarded, assigned, or in progress' },
            { status: 400 }
          );
        }
        if (ordqaPart5Submitted(ir) || ordqaPart5Approved(ir)) {
          return NextResponse.json(
            {
              error:
                'Part III Section 23 cannot be edited after Part V is submitted or approved',
            },
            { status: 400 }
          );
        }
        const { part3_data: p3assign, ordaqa_inspector_id: oiId } = body;
        const existing = parsePart3Data(ir);
        const assignPatch =
          p3assign && typeof p3assign === 'object' && !Array.isArray(p3assign)
            ? (p3assign as Record<string, unknown>)
            : {};
        const memoReturnedYes = String(assignPatch.memo_returned ?? '').toLowerCase() === 'yes';
        if (!memoReturnedYes && !oiId) {
          return NextResponse.json({ error: 'Assignee must be selected' }, { status: 400 });
        }
        const patchHasSection23 =
          String(assignPatch.ordaqa_comments ?? '').trim().length > 0 ||
          String(assignPatch.oic_ordaqa_name ?? '').trim().length > 0;
        if (!isSection23MarkedComplete(existing) && !patchHasSection23) {
          return NextResponse.json(
            {
              error:
                'Section 23 must be completed first, or send ORDAQA comments / Oi/c in the same request.',
            },
            { status: 400 }
          );
        }

        if (memoReturnedYes) {
          const mergedMemo: Record<string, unknown> = {
            ...existing,
            ...assignPatch,
            section23_complete: true,
            memo_returned: 'yes',
          };
          delete mergedMemo.delegation_type;
          delete mergedMemo.assigned_delegated_to;
          delete mergedMemo.reforwarded_after_memo;
          delete mergedMemo.reforwarded_at;
          delete mergedMemo.reforwarded_by_user_id;
          delete mergedMemo.reforwarded_by_role;
          if (!hasReceivedDateTime(mergedMemo)) {
            return NextResponse.json({ error: 'Received date and time is required' }, { status: 400 });
          }
          await query(
            `UPDATE inspection_requests
             SET part3_data = $2,
                 ordaqa_inspector_id = NULL,
                 forwarded_to_ordaqa = FALSE,
                 part3_completed_by = $3,
                 part3_date = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [id, JSON.stringify(mergedMemo), userId]
          );
          await logActivity(
            id,
            'part3_memo_returned',
            'Part III — Memo returned to QA Head (Section 23)',
            userId
          );
          try {
            const ordaqaHeadName =
              (session.user as { name?: string })?.name?.trim() || 'ORDAQA Head';
            await notifyQaHeadsMemoReturnedFromOrdaqa(
              parseInt(id, 10),
              String(ir.request_number),
              ordaqaHeadName,
              ir.initiator_id,
              null,
              [
                ir.initiator_id,
                ir.request_approver_id,
                ir.nominated_request_approver_id,
                ir.nominated_team_head_id,
                ir.qa_approver_id,
                ir.part1_approved_by,
                ir.inspector_id,
                ...collectInspectorIds(ir),
                ir.ordaqa_inspector_id,
                ir.ordaqa_approver_id,
                ir.final_qa_approver_id,
                ir.approver_id,
              ]
            );
          } catch (e) {
            console.error('Memo-return stakeholder notification:', e);
          }
          return NextResponse.json({
            message: 'Section 23 saved — memo returned to QA Head. Assigned/Delegated is not required.',
          });
        }

        const oiIdResolved = toPositiveInt(oiId);
        if (oiIdResolved == null) {
          return NextResponse.json({ error: 'Invalid assignee selection' }, { status: 400 });
        }
        const assigneeCheck = await query(`SELECT role, status, name FROM users WHERE id = $1`, [oiIdResolved]);
        const assigneeRole = assigneeCheck.rows[0]?.role as string | undefined;
        const assigneeStatus = (assigneeCheck.rows[0]?.status as string | undefined)?.toLowerCase?.() ?? '';
        const assigneeName = (assigneeCheck.rows[0]?.name as string | undefined)?.trim() ?? '';
        if (!assigneeRole) {
          return NextResponse.json({ error: 'Selected user not found' }, { status: 400 });
        }
        if (assigneeStatus && assigneeStatus !== 'active') {
          return NextResponse.json({ error: 'Selected user account is not active' }, { status: 400 });
        }
        const delegationTypeRaw = assignPatch.delegation_type;
        const delegationType =
          delegationTypeRaw === 'delegated' || delegationTypeRaw === 'assigned' ? delegationTypeRaw : 'assigned';
        if (delegationType === 'assigned') {
          if (assigneeRole !== 'ordaqa_inspector') {
            return NextResponse.json(
              { error: 'Assigned path: choose a user with role ORDAQA Inspector (ORDAQA Rep)' },
              { status: 400 }
            );
          }
        } else {
          if (assigneeRole !== 'inspector' && assigneeRole !== 'qa_approver') {
            return NextResponse.json(
              {
                error:
                  'Delegated path: choose an R&QA Inspector / QA Rep assigned in Part II (inspector or qa_approver)',
              },
              { status: 400 }
            );
          }
          const part2InspectorIds = collectInspectorIds(ir);
          if (part2InspectorIds.length === 0) {
            return NextResponse.json(
              {
                error:
                  'Delegated path: Team Head – QA must assign R&QA inspector(s) in Part II before delegation',
              },
              { status: 400 }
            );
          }
          if (!part2InspectorIds.includes(oiIdResolved)) {
            return NextResponse.json(
              {
                error:
                  'Delegated path: choose only an R&QA inspector already assigned in Part II',
              },
              { status: 400 }
            );
          }
        }
        const displayName =
          typeof assignPatch.assigned_delegated_to === 'string' && assignPatch.assigned_delegated_to.trim()
            ? String(assignPatch.assigned_delegated_to).trim()
            : assigneeName;
        const merged: Record<string, unknown> = {
          ...existing,
          ...assignPatch,
          section23_complete: true,
          delegation_type: delegationType,
          assigned_delegated_to: displayName,
        };
        delete merged.reforwarded_after_memo;
        delete merged.reforwarded_at;
        delete merged.reforwarded_by_user_id;
        delete merged.reforwarded_by_role;
        if (!hasReceivedDateTime(merged)) {
          return NextResponse.json({ error: 'Received date and time is required' }, { status: 400 });
        }
        await query(
          `UPDATE inspection_requests
           SET part3_data = $2, ordaqa_inspector_id = $3, updated_at = NOW()
           WHERE id = $1`,
          [id, JSON.stringify(merged), oiIdResolved]
        );
        await logActivity(
          id,
          'part3_assigned',
          'Part III — Forwarded to assignee (Sections 24–25 in Part V after Part IV)',
          userId
        );
        try {
          const ordaqaHeadName =
            (session.user as { name?: string })?.name?.trim() || 'ORDAQA Head';
          const section23WasComplete = isSection23MarkedComplete(existing);
          if (delegationType === 'delegated') {
            await notifyStakeholdersOrdaqaDelegatedToRqa({
              requestId: parseInt(id, 10),
              requestNumber: String(ir.request_number),
              delegatedToUserId: oiIdResolved,
              delegatedToName: displayName || assigneeName,
              ordaqaHeadName,
              excludeUserId: userId,
              stakeholderIds: collectObservationStakeholderIds(
                { ...ir, ordaqa_inspector_id: oiIdResolved },
                userId
              ),
            });
          } else {
            if (!section23WasComplete) {
              await notifyPart2InspectorsPart3Completed(
                parseInt(id, 10),
                String(ir.request_number),
                collectInspectorIds(ir),
                ordaqaHeadName,
                ir.initiator_id
              );
            }
            await createNotification({
              userId: oiIdResolved,
              title: 'Part V — Sections 24–25 (after Part IV)',
              message: `IR ${ir.request_number || '#' + id}: ORDAQA Head forwarded Part III. After Part IV is saved, complete Sections 24–25 in Part V.`,
              type: 'request_assigned',
              entityType: 'inspection_request',
              entityId: parseInt(id, 10),
            });
            await notifyIrStakeholders(
              parseInt(id, 10),
              {
                title: 'ORDAQA assignee set',
                message: `Inspection request ${ir.request_number}: ORDAQA Head assigned ${assigneeName || 'ORDAQA assignee'} for Part III / Part V follow-up.`,
                type: 'request_assigned',
              },
              { excludeUserId: userId, extraUserIds: [oiIdResolved, ir.initiator_id] }
            );
          }
        } catch (e) {
          console.error('ORDAQA forward notification:', e);
        }
        return NextResponse.json({
          message:
            delegationType === 'delegated'
              ? 'Section 23 saved — delegated assignee set for Sections 24–25'
              : 'ORDAQA inspector assigned — Section 23 saved',
        });
      }

      case 'approve_part5': {
        if (!canUserApproveOrdqaPart5(ir, userRole)) {
          return NextResponse.json(
            { error: 'Only ORDAQA Head can approve Part V after it has been submitted' },
            { status: 403 }
          );
        }
        const rqaSkipped = inspectionSkipsRqaPart2AndPart4(ir);
        // Part IV is the inspection when R&QA involved; DGAQA-only closes on Part V approval
        if (rqaSkipped) {
          await query(
            `UPDATE inspection_requests
             SET ordaqa_approver_id = $2,
                 ordaqa_approval_date = NOW(),
                 status = 'completed',
                 completed_date = NOW(),
                 final_qa_approver_id = $2,
                 final_qa_approval_date = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [id, userId]
          );
        } else {
          await query(
            `UPDATE inspection_requests
             SET ordaqa_approver_id = $2,
                 ordaqa_approval_date = NOW(),
                 status = 'inspection_completed',
                 completed_date = NOW(),
                 updated_at = NOW()
             WHERE id = $1`,
            [id, userId]
          );
        }
        await logActivity(id, 'part5_ordaqa_approved', 'Part V approved by ORDAQA Head', userId);
        if (rqaSkipped) {
          await logActivity(
            id,
            'inspection_closed',
            'Inspection completed and closed after Part V approval (R&QA Part II/IV not required)',
            userId
          );
        } else {
          await logActivity(
            id,
            'inspection_completed',
            'Inspection completed after Part V approval — awaiting Team Head – QA final approval',
            userId
          );
        }
        const approverName = (session.user as { name?: string })?.name?.trim() || 'ORDAQA Head';
        try {
          const assigneeId =
            ir.ordaqa_inspector_id != null ? Number(ir.ordaqa_inspector_id) : null;
          await notifyOrdaqaAssigneePart5Approved(
            parseInt(id, 10),
            String(ir.request_number),
            assigneeId,
            approverName
          );
          if (rqaSkipped) {
            await notifyInspectionClosed(
              parseInt(id, 10),
              String(ir.request_number),
              ir.initiator_id,
              ir.ordaqa_inspector_id != null ? Number(ir.ordaqa_inspector_id) : undefined,
              userId
            );
          } else {
            await notifyInspectionCompleted(
              parseInt(id, 10),
              String(ir.request_number),
              ir.initiator_id,
              ir.approver_id != null ? Number(ir.approver_id) : undefined,
              ir.nominated_team_head_id != null ? Number(ir.nominated_team_head_id) : null,
              { skipPart2Part3: inspectionUsesLegacyOpenRqaPart4(ir) }
            );
          }
        } catch (e) {
          console.error('Part V approved notification:', e);
        }
        return NextResponse.json({
          message: rqaSkipped
            ? 'Part V approved — IR completed (R&QA Part II/IV not required)'
            : 'Part V approved — IR ready for Team Head – QA final Approve & Close',
        });
      }

      case 'ordaqa_head_part5_send_back': {
        if (!canUserOrdqaHeadPart5SendBack(ir, userRole)) {
          return NextResponse.json(
            { error: 'Only ORDAQA Head can send back Part V after it has been submitted' },
            { status: 403 }
          );
        }
        const { comments } = body as { comments?: string };
        const trimmedP5Sb = typeof comments === 'string' ? comments.trim() : '';
        if (!trimmedP5Sb) {
          return NextResponse.json({ error: 'Comment is required to send back Part V' }, { status: 400 });
        }
        const existingP3Sb = ir.part3_data
          ? typeof ir.part3_data === 'string'
            ? JSON.parse(ir.part3_data)
            : ir.part3_data
          : {};
        const baseP3Sb =
          existingP3Sb && typeof existingP3Sb === 'object' && !Array.isArray(existingP3Sb)
            ? { ...(existingP3Sb as Record<string, unknown>) }
            : {};
        const prevP5History = Array.isArray(baseP3Sb.part5_return_history)
          ? (baseP3Sb.part5_return_history as unknown[])
          : [];
        const mergedP3Sb: Record<string, unknown> = {
          ...baseP3Sb,
          clearance_status: null,
          ordaqa_sections_24_25_signature_path: null,
          part5_head_send_back_comment: trimmedP5Sb,
          part5_head_send_back_at: new Date().toISOString(),
          part5_head_send_back_by: userId,
          part5_return_history: [
            ...prevP5History,
            {
              at: new Date().toISOString(),
              by_user_id: userId,
              role: 'ordaqa_head_part5_send_back',
              comments: trimmedP5Sb,
            },
          ],
        };
        await query(
          `UPDATE inspection_requests SET part3_data = $2, updated_at = NOW() WHERE id = $1`,
          [id, JSON.stringify(mergedP3Sb)]
        );
        await logActivity(
          id,
          'ordaqa_head_part5_send_back',
          `ORDAQA Head sent Part V back to inspector: ${trimmedP5Sb.slice(0, 200)}${trimmedP5Sb.length > 200 ? '…' : ''}`,
          userId
        );
        const headName = (session.user as { name?: string })?.name?.trim() || 'ORDAQA Head';
        const assigneeIdSb =
          ir.ordaqa_inspector_id != null ? Number(ir.ordaqa_inspector_id) : null;
        try {
          await notifyOrdaqaAssigneePart5SentBack(
            parseInt(id, 10),
            String(ir.request_number),
            assigneeIdSb,
            headName,
            trimmedP5Sb
          );
        } catch (e) {
          console.error('Part V send back notification:', e);
        }
        return NextResponse.json({
          message:
            'Part V sent back to ORDAQA Inspector for revision. They can update Sections 24–25 and resubmit.',
        });
      }

      case 'save_part5': {
        if (!isForwardedToOrdqa(ir)) {
          return NextResponse.json({ error: 'Part V applies only when the IR is forwarded to ORDAQA' }, { status: 400 });
        }
        if (ordqaPart5Submitted(ir) && !ordqaPart5Approved(ir) && userRole !== 'administrator') {
          return NextResponse.json(
            { error: 'Part V is awaiting ORDAQA Head approval and cannot be edited' },
            { status: 400 }
          );
        }
        if (!hasPart4Saved(ir)) {
          return NextResponse.json(
            { error: 'Part IV must be saved before Part V (sections 24–25)' },
            { status: 400 }
          );
        }
        if (!part4ApprovedByTeamHead(ir)) {
          return NextResponse.json(
            {
              error: part4PendingTeamHeadApproval(ir)
                ? 'Part IV is awaiting Team Head – QA approval before Part V can be filled'
                : 'Part IV must be approved by Team Head – QA before Part V can be filled',
            },
            { status: 400 }
          );
        }
        if (userRole === 'administrator') {
          // admin can always fill
        } else if (sameUserId(ir.ordaqa_inspector_id, userId)) {
          // Assigned or delegated person (ordaqa_inspector_id) completes Sections 24–25
        } else {
          return NextResponse.json(
            { error: 'Only the assigned/delegated ORDAQA person can update Part V' },
            { status: 403 }
          );
        }
        const { part5_data: incomingRaw } = body;
        const existing = ir.part3_data
          ? typeof ir.part3_data === 'string'
            ? JSON.parse(ir.part3_data)
            : ir.part3_data
          : {};
        const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
        const incoming =
          incomingRaw && typeof incomingRaw === 'object' && !Array.isArray(incomingRaw)
            ? { ...(incomingRaw as Record<string, unknown>) }
            : {};
        delete incoming.ordaqa_sections_24_25_signature_path;
        const sigRow = await query('SELECT signature_path FROM users WHERE id = $1', [userId]);
        const boundSig = (sigRow.rows[0] as { signature_path: string | null } | undefined)?.signature_path ?? null;
        const merged: Record<string, unknown> = {
          ...(base as Record<string, unknown>),
          ...incoming,
          ordaqa_sections_24_25_signature_path: boundSig,
        };
        delete merged.part5_head_send_back_comment;
        delete merged.part5_head_send_back_at;
        delete merged.part5_head_send_back_by;
        if (Array.isArray(merged.inspection_remarks)) {
          merged.inspection_remarks = (merged.inspection_remarks as unknown[]).map((r) =>
            r && typeof r === 'object'
              ? normalizeRemarkWithChatId({ ...(r as Record<string, unknown>) })
              : r
          );
        }
        await query(
          `UPDATE inspection_requests 
           SET part3_data = $2, part3_completed_by = $3, part3_date = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [id, JSON.stringify(merged), userId]
        );
        await logActivity(id, 'part5_saved', 'Part V — ORDAQA Sections 24–25 saved (in part3_data)', userId);
        try {
          const { sent } = await autoSendObservationsFromRemarks({
            inspectionRequestId: parseInt(id, 10),
            part: 'part5',
            remarks: (merged.inspection_remarks as unknown) ?? [],
            senderId: userId,
          });
          if (sent.length > 0) {
            const irFresh = await fetchInspectionForChatAccess(parseInt(id, 10));
            const recipients = collectObservationStakeholderIds(irFresh || ir, userId);
            const senderName = (session.user as { name?: string })?.name?.trim() || 'DGAQA Inspector';
            await Promise.all(
              sent.flatMap(({ thread, observation }) =>
                recipients.map((recipientId) =>
                  createNotification({
                    userId: recipientId,
                    title: `Observation sent — ${ir.request_number || 'IR'}`,
                    message: `${senderName} submitted a Part V observation: ${observation.slice(0, 120)}${observation.length > 120 ? '…' : ''}`,
                    type: 'info',
                    entityType: 'observation_thread',
                    entityId: thread.id,
                  }).catch(() => {})
                )
              )
            );
          }
        } catch (e) {
          console.error('Observation auto-send (Part V):', e);
        }
        try {
          await notifyOrdaqaHeadsPart5PendingApproval(parseInt(id, 10), String(ir.request_number), userId);
        } catch (e) {
          console.error('ORDAQA Heads Part V pending notification:', e);
        }
        return NextResponse.json({
          message: 'Part V saved — awaiting ORDAQA Head approval',
        });
      }

      case 'save_part4': {
        if (inspectionSkipsRqaPart2AndPart4(ir)) {
          return NextResponse.json(
            { error: 'Part IV is not used when Part I R&QA involvement is No' },
            { status: 400 }
          );
        }
        if (ordqaPart5Completed(ir)) {
          return NextResponse.json(
            { error: 'Part IV cannot be edited after Part V (ORDAQA Sections 24–25) is completed' },
            { status: 400 }
          );
        }
        const thEditingPart4 = canUserTeamHeadEditPart4(ir, userId, userRole);
        const inspectorEditingPart4 = canUserUpdatePart4(ir, userId, userRole);
        if (!thEditingPart4 && !inspectorEditingPart4) {
          if (part4PendingTeamHeadApproval(ir)) {
            return NextResponse.json(
              { error: 'Part IV is awaiting Team Head – QA approval and cannot be edited by this role' },
              { status: 403 }
            );
          }
          if (getPart4TeamHeadApprovalStatusRaw(ir) === 'approved') {
            return NextResponse.json(
              { error: 'Part IV has been approved by Team Head – QA and cannot be edited' },
              { status: 400 }
            );
          }
          return NextResponse.json(
            {
              error: inspectionUsesLegacyOpenRqaPart4(ir)
                ? 'Only an R&QA Inspector can update Part IV when joint inspection was not requested in Part I'
                : 'Only an inspector assigned in Part II can update Part IV',
            },
            { status: 403 }
          );
        }
        if (!thEditingPart4) {
          if (part4PendingTeamHeadApproval(ir)) {
            return NextResponse.json(
              { error: 'Part IV is awaiting Team Head – QA approval and cannot be edited' },
              { status: 400 }
            );
          }
          if (getPart4TeamHeadApprovalStatusRaw(ir) === 'approved') {
            return NextResponse.json(
              { error: 'Part IV has been approved by Team Head – QA and cannot be edited' },
              { status: 400 }
            );
          }
        }
        const skipPart23 = inspectionUsesLegacyOpenRqaPart4(ir);
        if (!thEditingPart4) {
          const part4Statuses = skipPart23
            ? ['request_approved', 'assigned']
            : ['assigned'];
          if (!part4Statuses.includes(ir.status)) {
            return NextResponse.json(
              {
                error:
                  ir.status === 'in_progress'
                    ? 'Part IV cannot be edited after inspection has started'
                    : skipPart23
                      ? 'Part IV can be updated after Request Approver forward (Forwarded status) or after assignment, before Start Inspection'
                      : 'Part IV can only be updated after assignment and before Start Inspection',
              },
              { status: 400 }
            );
          }
          if (part4BlockedByPart3(ir)) {
            return NextResponse.json(
              {
                error:
                  'Complete Part III (Section 23 — ORDAQA assignee) before saving Part IV when the IR is forwarded to ORDAQA',
              },
              { status: 400 }
            );
          }
        }
        const { part4_data: p4dataRaw } = body;
        const p4Incoming =
          p4dataRaw && typeof p4dataRaw === 'object' && !Array.isArray(p4dataRaw)
            ? { ...(p4dataRaw as Record<string, unknown>) }
            : {};
        // Server owns approval metadata — strip any client-supplied approval fields.
        delete p4Incoming.team_head_approval_status;
        delete p4Incoming.part4_team_head_reject_comment;
        delete p4Incoming.part4_team_head_rejected_at;
        delete p4Incoming.part4_team_head_rejected_by;
        delete p4Incoming.part4_team_head_approver_id;
        delete p4Incoming.part4_team_head_approved_at;
        delete p4Incoming.part4_team_head_approver_name;
        delete p4Incoming.part4_team_head_approver_designation;
        delete p4Incoming.part4_team_head_approver_signature_path;
        delete p4Incoming.part4_return_history;

        const existingP4 = parsePart4Data(ir.part4_data);
        const prevHistory = Array.isArray(existingP4.part4_return_history)
          ? (existingP4.part4_return_history as unknown[])
          : [];
        const incomingRemarks = Array.isArray(p4Incoming.part4_remarks)
          ? (p4Incoming.part4_remarks as unknown[])
          : [];
        const normalizedRemarks = incomingRemarks.map((r) =>
          r && typeof r === 'object'
            ? normalizeRemarkWithChatId({ ...(r as Record<string, unknown>) })
            : r
        );

        if (thEditingPart4) {
          const p4data: Record<string, unknown> = {
            ...existingP4,
            ...p4Incoming,
            part4_remarks: normalizedRemarks,
            team_head_approval_status: 'pending',
            part4_return_history: prevHistory,
          };
          await query(
            `UPDATE inspection_requests
             SET part4_data = $2, updated_at = NOW()
             WHERE id = $1`,
            [id, JSON.stringify(p4data)]
          );
          await logActivity(
            id,
            'part4_edited_by_team_head',
            'Part IV updated by Team Head – QA (still pending approval)',
            userId
          );
          return NextResponse.json({ message: 'Part IV updated by Team Head – QA' });
        }

        const p4data: Record<string, unknown> = {
          ...p4Incoming,
          part4_remarks: normalizedRemarks,
          team_head_approval_status: 'pending',
          part4_return_history: prevHistory,
        };

        if (skipPart23 && ir.status === 'request_approved') {
          await query(
            `UPDATE inspection_requests
             SET part4_data = $2,
                 part4_completed_by = $3,
                 part4_date = NOW(),
                 inspector_id = $4,
                 inspector_ids = $5,
                 status = 'assigned',
                 updated_at = NOW()
             WHERE id = $1`,
            [id, JSON.stringify(p4data), userId, userId, JSON.stringify([userId])]
          );
        } else {
          await query(
            `UPDATE inspection_requests
             SET part4_data = $2, part4_completed_by = $3, part4_date = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [id, JSON.stringify(p4data), userId]
          );
        }
        await logActivity(
          id,
          'part4_saved',
          'Part IV — R&QA Inspection Report submitted for Team Head – QA approval',
          userId
        );
        try {
          const { sent } = await autoSendObservationsFromRemarks({
            inspectionRequestId: parseInt(id, 10),
            part: 'part4',
            remarks: (p4data as { part4_remarks?: unknown })?.part4_remarks ?? [],
            senderId: userId,
          });
          if (sent.length > 0) {
            const irFresh = await fetchInspectionForChatAccess(parseInt(id, 10));
            const recipients = collectObservationStakeholderIds(irFresh || ir, userId);
            const senderName = (session.user as { name?: string })?.name?.trim() || 'R&QA Inspector';
            await Promise.all(
              sent.flatMap(({ thread, observation }) =>
                recipients.map((recipientId) =>
                  createNotification({
                    userId: recipientId,
                    title: `Observation sent — ${ir.request_number || 'IR'}`,
                    message: `${senderName} submitted a Part IV observation: ${observation.slice(0, 120)}${observation.length > 120 ? '…' : ''}`,
                    type: 'info',
                    entityType: 'observation_thread',
                    entityId: thread.id,
                  }).catch(() => {})
                )
              )
            );
          }
        } catch (e) {
          console.error('Observation auto-send (Part IV):', e);
        }
        try {
          const part4Ctx = {
            initiator_id: ir.initiator_id != null ? Number(ir.initiator_id) : null,
            nominated_team_head_id:
              ir.nominated_team_head_id != null ? Number(ir.nominated_team_head_id) : null,
            inspector_id:
              skipPart23 && ir.status === 'request_approved'
                ? userId
                : ir.inspector_id != null
                  ? Number(ir.inspector_id)
                  : null,
            inspector_ids_raw: (() => {
              if (skipPart23 && ir.status === 'request_approved') {
                return JSON.stringify([userId]);
              }
              const v = ir.inspector_ids as unknown;
              if (v == null) return null;
              if (typeof v === 'string') return v;
              try {
                return JSON.stringify(v);
              } catch {
                return null;
              }
            })(),
            forwarded_to_ordaqa: !!ir.forwarded_to_ordaqa,
            ordaqa_inspector_id:
              ir.ordaqa_inspector_id != null ? Number(ir.ordaqa_inspector_id) : null,
          };
          await notifyStakeholdersPart4Saved(
            parseInt(id, 10),
            String(ir.request_number),
            userId,
            part4Ctx
          );
          await notifyTeamHeadPart4PendingApproval(
            parseInt(id, 10),
            String(ir.request_number),
            part4Ctx.nominated_team_head_id,
            inspectionUsesLegacyOpenRqaPart4(ir)
          );
          // ORDAQA Part V is notified only after Team Head approves Part IV (see approve_part4).
        } catch (e) {
          console.error('Part IV saved notifications:', e);
        }
        return NextResponse.json({
          message: 'Part IV submitted — awaiting Team Head – QA approval',
        });
      }

      case 'approve_part4': {
        if (!canUserApprovePart4(ir, userId, userRole)) {
          return NextResponse.json(
            { error: 'Only Team Head – QA can approve Part IV while it is pending approval' },
            { status: 403 }
          );
        }
        if (userRole === 'qa_approver') {
          if (inspectionUsesLegacyOpenRqaPart4(ir)) {
            if (!(await isEligibleRqaTeamHead(userId))) {
              return NextResponse.json(
                {
                  error:
                    'Only an active R&QA Team Head (qa_approver, TH designation) can approve Part IV when joint inspection was not requested',
                },
                { status: 403 }
              );
            }
          } else if (!isNominatedTeamHeadActor(ir, userId)) {
            return NextResponse.json(
              { error: 'Only the nominated Team Head – QA can approve Part IV' },
              { status: 403 }
            );
          }
        }
        const existingP4Approve = parsePart4Data(ir.part4_data);
        const thSessionName = (session.user as { name?: string })?.name?.trim() || 'Team Head – QA';
        const thUserRes = await query(
          `SELECT name, designation, signature_path FROM users WHERE id = $1`,
          [userId]
        );
        const thUser = thUserRes.rows[0] as
          | { name?: string; designation?: string; signature_path?: string | null }
          | undefined;
        const thDisplayName = String(thUser?.name || thSessionName).trim();
        const mergedP4Approve: Record<string, unknown> = {
          ...existingP4Approve,
          team_head_approval_status: 'approved',
          part4_team_head_approver_id: userId,
          part4_team_head_approved_at: new Date().toISOString(),
          part4_team_head_approver_name: thDisplayName,
          part4_team_head_approver_designation: String(thUser?.designation || '').trim(),
          part4_team_head_approver_signature_path: thUser?.signature_path
            ? String(thUser.signature_path)
            : null,
        };
        delete mergedP4Approve.part4_team_head_reject_comment;
        delete mergedP4Approve.part4_team_head_rejected_at;
        delete mergedP4Approve.part4_team_head_rejected_by;
        await query(
          `UPDATE inspection_requests SET part4_data = $2, updated_at = NOW() WHERE id = $1`,
          [id, JSON.stringify(mergedP4Approve)]
        );
        await logActivity(id, 'part4_team_head_approved', 'Part IV approved by Team Head – QA', userId);

        // No Part V (skip / non-ORDAQA): Part IV is the inspection — mark completed for final Approve & Close
        const needsPart5 = inspectionRequiresOrdqaPart5(ir);
        if (!needsPart5) {
          await query(
            `UPDATE inspection_requests
             SET status = 'inspection_completed', completed_date = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [id]
          );
          await logActivity(
            id,
            'inspection_completed',
            'Inspection completed after Part IV approval — awaiting Team Head – QA final approval',
            userId
          );
        }

        try {
          await notifyInspectorsPart4Approved(
            parseInt(id, 10),
            String(ir.request_number),
            collectInspectorIds(ir),
            thDisplayName
          );
          if (needsPart5 && isForwardedToOrdqa(ir) && ir.ordaqa_inspector_id) {
            await notifyOrdaqaAssigneePart4ForwardedForPart5(
              parseInt(id, 10),
              String(ir.request_number),
              Number(ir.ordaqa_inspector_id),
              thDisplayName
            );
          }
          if (!needsPart5) {
            await notifyInspectionCompleted(
              parseInt(id, 10),
              String(ir.request_number),
              ir.initiator_id,
              ir.approver_id != null ? Number(ir.approver_id) : undefined,
              ir.nominated_team_head_id != null ? Number(ir.nominated_team_head_id) : null,
              { skipPart2Part3: inspectionUsesLegacyOpenRqaPart4(ir) }
            );
          }
        } catch (e) {
          console.error('Part IV approved notifications:', e);
        }
        return NextResponse.json({
          message: needsPart5
            ? 'Part IV approved by Team Head – QA'
            : 'Part IV approved — IR ready for Team Head – QA final Approve & Close',
        });
      }

      case 'reject_part4': {
        if (!canUserRejectPart4(ir, userId, userRole)) {
          return NextResponse.json(
            { error: 'Only Team Head – QA can reject Part IV while it is pending approval' },
            { status: 403 }
          );
        }
        if (userRole === 'qa_approver') {
          if (inspectionUsesLegacyOpenRqaPart4(ir)) {
            if (!(await isEligibleRqaTeamHead(userId))) {
              return NextResponse.json(
                {
                  error:
                    'Only an active R&QA Team Head (qa_approver, TH designation) can reject Part IV when joint inspection was not requested',
                },
                { status: 403 }
              );
            }
          } else if (!isNominatedTeamHeadActor(ir, userId)) {
            return NextResponse.json(
              { error: 'Only the nominated Team Head – QA can reject Part IV' },
              { status: 403 }
            );
          }
        }
        const { comments } = body as { comments?: string };
        const trimmedP4Reject = typeof comments === 'string' ? comments.trim() : '';
        if (!trimmedP4Reject) {
          return NextResponse.json(
            { error: 'Comment is required to reject Part IV' },
            { status: 400 }
          );
        }
        const existingP4Reject = parsePart4Data(ir.part4_data);
        const prevP4History = Array.isArray(existingP4Reject.part4_return_history)
          ? (existingP4Reject.part4_return_history as unknown[])
          : [];
        const mergedP4Reject: Record<string, unknown> = {
          ...existingP4Reject,
          team_head_approval_status: 'rejected',
          part4_team_head_reject_comment: trimmedP4Reject,
          part4_team_head_rejected_at: new Date().toISOString(),
          part4_team_head_rejected_by: userId,
          part4_return_history: [
            ...prevP4History,
            {
              at: new Date().toISOString(),
              by_user_id: userId,
              role: 'reject_part4',
              comments: trimmedP4Reject,
            },
          ],
        };
        delete mergedP4Reject.part4_team_head_approver_id;
        delete mergedP4Reject.part4_team_head_approved_at;
        await query(
          `UPDATE inspection_requests SET part4_data = $2, updated_at = NOW() WHERE id = $1`,
          [id, JSON.stringify(mergedP4Reject)]
        );
        await logActivity(
          id,
          'part4_team_head_rejected',
          `Team Head – QA sent Part IV back: ${trimmedP4Reject.slice(0, 200)}${trimmedP4Reject.length > 200 ? '…' : ''}`,
          userId
        );
        const thRejectName = (session.user as { name?: string })?.name?.trim() || 'Team Head – QA';
        try {
          await notifyInspectorsPart4Rejected(
            parseInt(id, 10),
            String(ir.request_number),
            collectInspectorIds(ir),
            thRejectName,
            trimmedP4Reject,
            userId,
            snapshotIrStakeholderIds(ir)
          );
        } catch (e) {
          console.error('Part IV send-back notifications:', e);
        }
        return NextResponse.json({
          message:
            'Part IV sent back to R&QA Inspector. They can update Part IV and resubmit for approval.',
        });
      }

      case 'start_inspection': {
        if (!canUserStartInspection(ir, userId, userRole)) {
          return NextResponse.json(
            {
              error:
                'Only an administrator can start inspection',
            },
            { status: 403 }
          );
        }
        if (ir.status !== 'assigned') {
          return NextResponse.json({ error: 'IR must be assigned first' }, { status: 400 });
        }
        if (!inspectionReadyToStart(ir)) {
          return NextResponse.json(
            {
              error: inspectionRequiresOrdqaPart5(ir)
                ? 'Save Part IV, complete Part V, and obtain ORDAQA Head approval before starting inspection'
                : 'Save Part IV first before starting inspection',
            },
            { status: 400 }
          );
        }
        await query(
          `UPDATE inspection_requests SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        await logActivity(id, 'started', 'Inspection started by administrator', userId);
        try {
          await notifyInitiatorIrMilestone(ir.initiator_id, parseInt(id, 10), String(ir.request_number), {
            title: 'Inspection started',
            message: `Your inspection request ${ir.request_number} is now in progress.`,
            type: 'request_assigned',
          });
        } catch (e) {
          console.error('Initiator inspection-started notification:', e);
        }
        return NextResponse.json({ message: 'Inspection started' });
      }

      case 'complete_inspection': {
        if (!canUserCompleteInspection(ir, userId, userRole)) {
          return NextResponse.json(
            {
              error: 'Only an administrator can complete inspection',
            },
            { status: 403 }
          );
        }
        if (ir.status !== 'in_progress') {
          return NextResponse.json({ error: 'Inspection must be in progress first' }, { status: 400 });
        }
        if (!inspectionReportsReadyForTeamHead(ir)) {
          return NextResponse.json(
            {
              error: ir.forwarded_to_ordaqa
                ? 'Save Part IV and complete Part V (ORDAQA Sections 24–25) before completing inspection'
                : 'Part IV must be saved before completing inspection',
            },
            { status: 400 }
          );
        }
        await query(
          `UPDATE inspection_requests 
           SET status = 'inspection_completed', completed_date = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [id]
        );
        await logActivity(id, 'inspection_completed', 'Inspection completed', userId);
        try {
          await notifyInspectionCompleted(
            parseInt(id, 10),
            String(ir.request_number),
            ir.initiator_id,
            ir.approver_id != null ? Number(ir.approver_id) : undefined,
            ir.nominated_team_head_id != null ? Number(ir.nominated_team_head_id) : null,
            { skipPart2Part3: inspectionUsesLegacyOpenRqaPart4(ir) }
          );
        } catch (e) {
          console.error('Initiator inspection-completed notification:', e);
        }
        return NextResponse.json({ message: 'Inspection completed' });
      }

      case 'qa_approve': {
        if (userRole !== 'qa_approver' && userRole !== 'administrator') {
          return NextResponse.json(
            { error: 'Only Team Head - QA (qa_approver role) can approve and close' },
            { status: 403 }
          );
        }
        if (!inspectionReadyForFinalTeamHeadApproval(ir)) {
          return NextResponse.json(
            {
              error: inspectionRequiresOrdqaPart5(ir)
                ? 'Part V must be approved by ORDAQA Head before final Team Head – QA approval'
                : 'Part IV must be approved before final Team Head – QA approval',
            },
            { status: 400 }
          );
        }
        const skipPart23Approve = inspectionUsesLegacyOpenRqaPart4(ir);
        if (userRole === 'qa_approver') {
          if (skipPart23Approve) {
            if (!(await isEligibleRqaTeamHead(userId))) {
              return NextResponse.json(
                {
                  error:
                    'Only an active R&QA Team Head (qa_approver, TH designation) can approve when joint inspection was not requested',
                },
                { status: 403 }
              );
            }
          } else if (!isNominatedTeamHeadActor(ir, userId)) {
            return NextResponse.json(
              { error: 'Only the nominated Team Head - QA can approve and close this IR' },
              { status: 403 }
            );
          }
        }
        await query(
          `UPDATE inspection_requests 
           SET status = 'completed', 
               final_qa_approver_id = $2, 
               final_qa_approval_date = NOW(),
               completed_date = COALESCE(completed_date, NOW()),
               updated_at = NOW() 
           WHERE id = $1`,
          [id, userId]
        );
        await logActivity(id, 'qa_approved', 'IR approved and closed by Team Head - QA', userId);
        try {
          await notifyInspectionClosed(
            parseInt(id, 10),
            String(ir.request_number),
            ir.initiator_id,
            ir.inspector_id != null ? Number(ir.inspector_id) : undefined,
            userId
          );
        } catch (e) {
          console.error('Initiator IR-closed notification:', e);
        }
        return NextResponse.json({ message: 'IR approved and closed' });
      }

      case 'qa_reject': {
        if (userRole !== 'qa_approver' && userRole !== 'administrator') {
          return NextResponse.json(
            { error: 'Only Team Head - QA (qa_approver role) can reject at this stage' },
            { status: 403 }
          );
        }
        const skipPart23Reject = inspectionUsesLegacyOpenRqaPart4(ir);
        const readyForFinalReject = inspectionReadyForFinalTeamHeadApproval(ir);
        const inspectorsAssignedForReject = hasInspectorsAssigned(ir);
        const part2RejectWindow =
          ['request_approved', 'assigned', 'in_progress', 'inspection_completed'].includes(
            ir.status || ''
          ) &&
          (skipPart23Reject
            ? ir.status === 'inspection_completed' || !inspectorsAssignedForReject
            : !inspectorsAssignedForReject);

        if (!readyForFinalReject && !part2RejectWindow) {
          return NextResponse.json(
            {
              error: inspectionRequiresOrdqaPart5(ir)
                ? 'Reject is not available at this stage (Part V must be approved for final reject, or reject during Part II before inspector assignment)'
                : 'Reject is not available at this stage (Part IV must be approved for final reject, or reject during Part II before inspector assignment)',
            },
            { status: 400 }
          );
        }
        if (userRole === 'qa_approver') {
          if (skipPart23Reject) {
            if (!(await isEligibleRqaTeamHead(userId))) {
              return NextResponse.json(
                {
                  error:
                    'Only an active R&QA Team Head (qa_approver, TH designation) can reject when joint inspection was not requested',
                },
                { status: 403 }
              );
            }
          } else if (!isNominatedTeamHeadActor(ir, userId)) {
            return NextResponse.json(
              { error: 'Only the nominated Team Head - QA can reject this IR' },
              { status: 403 }
            );
          }
        }
        const { reason } = body as { reason?: string };
        const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
        if (!trimmedReason) {
          return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
        }

        const rejectStakeholders = snapshotIrStakeholderIds(ir);

        const existingP2Reject = parsePart2Data(ir.part2_data);
        const prevRejectHistory = Array.isArray(existingP2Reject.return_history)
          ? (existingP2Reject.return_history as unknown[])
          : [];
        const mergedP2Reject = {
          ...existingP2Reject,
          qa_pipeline_touched: true,
          team_head_reject_comment: trimmedReason,
          return_history: [
            ...prevRejectHistory,
            {
              at: new Date().toISOString(),
              by_user_id: userId,
              role: readyForFinalReject ? 'qa_reject_final' : 'qa_reject_part2',
              comments: trimmedReason,
              prior_status: ir.status,
            },
          ],
        };

        await query(
          `UPDATE inspection_requests
           SET status = 'rejected',
               rejection_reason = $2,
               part2_data = $3,
               updated_at = NOW()
           WHERE id = $1`,
          [id, trimmedReason, JSON.stringify(mergedP2Reject)]
        );
        await logActivity(
          id,
          'rejected',
          `IR rejected by Team Head – QA: ${trimmedReason.slice(0, 200)}${trimmedReason.length > 200 ? '…' : ''}`,
          userId
        );
        const inspectorUserIds: number[] = [];
        try {
          const raw = parseInspectorIds(ir.inspector_ids);
          if (Array.isArray(raw)) {
            for (const x of raw) {
              const n = typeof x === 'number' ? x : parseInt(String(x), 10);
              if (Number.isFinite(n) && n > 0) inspectorUserIds.push(n);
            }
          }
        } catch {
          /* ignore */
        }
        if (ir.inspector_id) {
          const n = Number(ir.inspector_id);
          if (Number.isFinite(n) && n > 0 && !inspectorUserIds.includes(n)) inspectorUserIds.push(n);
        }
        try {
          await notifyInspectionRejected(
            parseInt(id, 10),
            String(ir.request_number),
            ir.initiator_id,
            inspectorUserIds[0],
            trimmedReason,
            userId,
            [...rejectStakeholders, ...inspectorUserIds]
          );
        } catch (e) {
          console.error('QA reject notification:', e);
        }
        return NextResponse.json({ message: 'IR rejected' });
      }

      case 'qa_approver_send_back': {
        const skipPart23SendBack = inspectionUsesLegacyOpenRqaPart4(ir);
        const isNominatedTHSendBack = isNominatedTeamHeadActor(ir, userId);
        if (userRole !== 'administrator') {
          if (skipPart23SendBack) {
            if (userRole !== 'qa_approver' || !(await isEligibleRqaTeamHead(userId))) {
              return NextResponse.json(
                {
                  error:
                    'Only an active R&QA Team Head (qa_approver) can send back when joint inspection was not requested',
                },
                { status: 403 }
              );
            }
          } else if (!isNominatedTHSendBack) {
            return NextResponse.json(
              { error: 'Only the nominated Team Head - QA can send back' },
              { status: 403 }
            );
          }
        }
        const allowedStatuses = ['request_approved', 'assigned', 'in_progress', 'inspection_completed'];
        if (!allowedStatuses.includes(ir.status)) {
          return NextResponse.json(
            { error: 'Send back is not available at this workflow stage' },
            { status: 400 }
          );
        }
        const { comments, send_back_to } = body as {
          comments?: string;
          send_back_to?: string;
        };
        const trimmed = typeof comments === 'string' ? comments.trim() : '';
        if (!trimmed) {
          return NextResponse.json({ error: 'Comment is required to send back' }, { status: 400 });
        }
        const target: 'initiator' | 'designer' =
          send_back_to === 'designer' ? 'designer' : 'initiator';

        await ensureQaApproverSendBackColumns();

        const existingP2 = parsePart2Data(ir.part2_data);
        const prevHistory = Array.isArray(existingP2.return_history)
          ? (existingP2.return_history as unknown[])
          : [];
        const previousInspectorIds = [
          ...new Set([
            ...parseInspectorIds(existingP2.previous_inspector_ids),
            ...collectInspectorIds(ir),
          ]),
        ];
        const mergedP2 = {
          ...existingP2,
          qa_pipeline_touched: true,
          previous_inspector_ids: previousInspectorIds,
          return_history: [
            ...prevHistory,
            {
              at: new Date().toISOString(),
              by_user_id: userId,
              role: 'qa_approver_send_back',
              send_back_to: target,
              comments: trimmed,
              prior_status: ir.status,
            },
          ],
        };

        const inspectorUserIds: number[] = [];
        try {
          const raw = parseInspectorIds(ir.inspector_ids);
          if (Array.isArray(raw)) {
            for (const x of raw) {
              const n = typeof x === 'number' ? x : parseInt(String(x), 10);
              if (Number.isFinite(n) && n > 0) inspectorUserIds.push(n);
            }
          }
        } catch {
          /* ignore */
        }
        if (ir.inspector_id) {
          const n = Number(ir.inspector_id);
          if (Number.isFinite(n) && n > 0 && !inspectorUserIds.includes(n)) inspectorUserIds.push(n);
        }

        const actorName = (session.user as { name?: string })?.name || 'Team Head – QA';
        const reqApprId = ir.request_approver_id != null ? Number(ir.request_approver_id) : null;
        const sendBackStakeholders = snapshotIrStakeholderIds(ir);

        await query(
          `UPDATE inspection_requests
           SET status = 'returned_to_designer',
               qa_approver_id = $2,
               nominated_team_head_id = NULL,
               inspector_id = NULL,
               inspector_ids = '[]',
               forwarded_to_ordaqa = FALSE,
               ordaqa_inspector_id = NULL,
               completed_date = NULL,
               qa_approver_send_back_comment = $3,
               qa_approver_send_back_to = $4,
               part2_notes = $5,
               part2_data = $6,
               part2_date = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [id, userId, trimmed, target, trimmed, JSON.stringify(mergedP2)]
        );

        await logActivity(
          id,
          'qa_approver_send_back',
          `Team Head – QA sent back (${target === 'designer' ? 'designer' : 'initiator'}): ${trimmed.slice(0, 200)}${trimmed.length > 200 ? '…' : ''}`,
          userId
        );

        try {
          await notifyQaApproverSendBack(
            parseInt(id, 10),
            ir.request_number,
            ir.initiator_id,
            reqApprId,
            trimmed,
            actorName,
            target,
            inspectorUserIds,
            userId,
            sendBackStakeholders
          );
        } catch (e) {
          console.error('Team Head send-back notifications:', e);
        }

        return NextResponse.json({
          message:
            target === 'designer'
              ? 'IR sent back for designer / Part I corrections. Initiator can edit Part I and resubmit.'
              : 'IR sent back to initiator for Part I corrections.',
        });
      }

      case 'ordaqa_inspector_send_back':
        return NextResponse.json(
          { error: 'ORDAQA inspector send back is not available' },
          { status: 403 }
        );

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Workflow error:', error);
    return NextResponse.json({ error: 'Workflow action failed' }, { status: 500 });
  }
}
