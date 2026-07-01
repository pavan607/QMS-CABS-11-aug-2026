import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
  createNotification,
  notifyReturnedToDesignerByQaHead,
  notifyQaHeadsResubmittedAfterReturn,
  notifyQaApproverSendBack,
  notifyRequestApproversPendingForward,
  notifyQaHeadsAfterRequestApproverForward,
  notifyNominatedTeamHeadQaPart2,
  notifyOrdaqaHeadsForwardedToOrdaqa,
  notifyQaHeadsMemoReturnedFromOrdaqa,
  notifyInspectorsAssignedPart2,
  notifyPart2InspectorsPart3Completed,
  notifyStakeholdersPart4Saved,
  notifyOrdaqaAssigneePart4ForwardedForPart5,
  notifyOrdaqaHeadsPart5PendingApproval,
  notifyOrdaqaAssigneePart5SentBack,
  notifyOrdaqaAssigneePart5Approved,
  notifyPart2InspectorsPart5ApprovedForInspection,
  notifyInitiatorIrMilestone,
  notifyInspectionRejected,
  notifyInspectionCompleted,
  notifyInspectionClosed,
  createBulkNotifications,
} from '@/lib/notifications';
import { syncObservationThreadsFromRemarks } from '@/lib/observation-chats';
import {
  canUserApproveOrdqaPart5,
  canUserOrdqaHeadPart5SendBack,
  canUserCompleteInspection,
  canUserStartInspection,
  inspectionReadyToStart,
  inspectionRequiresOrdqaPart5,
  canUserUpdatePart4,
  inspectionReportsReadyForTeamHead,
  inspectionSkipsPart2Part3,
  isForwardedToOrdqa,
  ordqaPart5Approved,
  ordqaPart5Completed,
  ordqaPart5Submitted,
  part3Section23EditableStatus,
  part4BlockedByPart3,
} from '@/lib/inspection-display';
import {
  userCanAccessInspectionRequest,
  collectInspectorIds,
  parseInspectorIds,
} from '@/lib/inspection-access';
import { isEligibleRqaTeamHead } from '@/lib/rqa-users';

async function notifyInitiatorRequestApproverSendBack(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  comment: string
): Promise<void> {
  const preview =
    comment.length > 200 ? `${comment.slice(0, 197)}…` : comment;
  await createNotification({
    userId: initiatorId,
    title: 'Request sent back for corrections',
    message: `Inspection request ${requestNumber} was sent back by your Request Approver. ${preview}`,
    type: 'returned_to_designer',
    entityType: 'inspection_request',
    entityId: requestId,
  });
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

function isNominatedTeamHeadActor(ir: { nominated_team_head_id?: unknown }, actorUserId: number): boolean {
  if (ir.nominated_team_head_id == null) return false;
  return Number(ir.nominated_team_head_id) === actorUserId;
}

/** Nominated Request Approver (field 21) takes precedence; otherwise initiator must sit under this approver's subtree. */
async function assertRequestApproverActingOnIr(
  userRole: string,
  userId: number,
  ir: { nominated_request_approver_id?: unknown; initiator_id: number }
): Promise<NextResponse | undefined> {
  if (userRole !== 'request_approver') return undefined;
  const nominated = toPositiveInt(ir.nominated_request_approver_id);
  if (nominated != null) {
    if (userId !== nominated) {
      return NextResponse.json(
        { error: 'Only the nominated Request Approver (field 21) can act on this IR' },
        { status: 403 }
      );
    }
    return undefined;
  }
  const teamCheck = await query(
    `WITH RECURSIVE team AS (
      SELECT id FROM users WHERE reporting_to = $1
      UNION ALL
      SELECT u.id FROM users u INNER JOIN team t ON u.reporting_to = t.id
    )
    SELECT id FROM team WHERE id = $2`,
    [userId, ir.initiator_id]
  );
  if (teamCheck.rows.length === 0) {
    return NextResponse.json(
      { error: 'You can only process requests from your team members' },
      { status: 403 }
    );
  }
  return undefined;
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
    const body = await request.json();
    const { action } = body;

    const existing = await query('SELECT * FROM inspection_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const ir = existing.rows[0];

    const canAccess = await userCanAccessInspectionRequest(userRole, userId, ir, employeeId);
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
        await logActivity(id, 'submitted', 'IR submitted for Request Approver approval', userId);
        await notifyRequestApproversPendingForward(
          parseInt(id, 10),
          ir.request_number,
          ir.initiator_id,
          ir.nominated_request_approver_id != null ? Number(ir.nominated_request_approver_id) : null
        );
        try {
          await notifyInitiatorIrMilestone(ir.initiator_id, parseInt(id, 10), String(ir.request_number), {
            title: 'Submitted for Request Approver',
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
        if (userRole !== 'request_approver' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only Request Approver can forward' }, { status: 403 });
        }
        if (ir.status !== 'pending_request_approval' && ir.status !== 'pending') {
          return NextResponse.json({ error: 'IR is not pending forward' }, { status: 400 });
        }
        if (userRole === 'request_approver') {
          const deny = await assertRequestApproverActingOnIr(userRole, userId, ir);
          if (deny) return deny;
        }
        const { comments } = body as { comments?: string };
        const trimmedForwardComment = typeof comments === 'string' ? comments.trim() : '';
        await ensureRequestApproverForwardCommentColumn();
        await query(
          `UPDATE inspection_requests 
           SET status = 'request_approved', 
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
            ? `Request forwarded by approver: ${trimmedForwardComment}`
            : 'Request forwarded by approver',
          userId
        );
        try {
          const forwardedByName =
            (session.user as { name?: string })?.name?.trim() || 'Request Approver';
          await notifyQaHeadsAfterRequestApproverForward(
            parseInt(id, 10),
            ir.request_number,
            forwardedByName,
            ir.initiator_id,
            trimmedForwardComment
          );
        } catch (e) {
          console.error('QA Head forward notification:', e);
        }
        return NextResponse.json({ message: 'Request forwarded successfully' });
      }

      case 'request_reject': {
        if (userRole !== 'request_approver' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only Request Approver can reject' }, { status: 403 });
        }
        if (userRole === 'request_approver') {
          const deny = await assertRequestApproverActingOnIr(userRole, userId, ir);
          if (deny) return deny;
        }
        const { reason } = body;
        await query(
          `UPDATE inspection_requests 
           SET status = 'rejected', 
               rejection_reason = $2,
               updated_at = NOW() 
           WHERE id = $1`,
          [id, reason || 'Rejected by Request Approver']
        );
        await logActivity(id, 'rejected', `Request rejected: ${reason || 'No reason provided'}`, userId);
        try {
          await notifyInspectionRejected(
            parseInt(id, 10),
            String(ir.request_number),
            ir.initiator_id,
            undefined,
            reason || 'Rejected by Request Approver'
          );
        } catch (e) {
          console.error('Initiator request-reject notification:', e);
        }
        return NextResponse.json({ message: 'Request rejected' });
      }

      case 'request_send_back': {
        if (userRole !== 'request_approver' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only Request Approver can send back' }, { status: 403 });
        }
        if (ir.status !== 'pending_request_approval' && ir.status !== 'pending') {
          return NextResponse.json({ error: 'IR is not pending Request Approver action' }, { status: 400 });
        }
        if (userRole === 'request_approver') {
          const deny = await assertRequestApproverActingOnIr(userRole, userId, ir);
          if (deny) return deny;
        }
        const { comments } = body as { comments?: string };
        const trimmed = typeof comments === 'string' ? comments.trim() : '';
        if (!trimmed) {
          return NextResponse.json({ error: 'Comment is required to send back' }, { status: 400 });
        }
        await ensureRequestApproverSendBackColumn();
        await query(
          `UPDATE inspection_requests
           SET status = 'returned_to_designer',
               request_approver_send_back_comment = $2,
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
        await notifyInitiatorRequestApproverSendBack(parseInt(id, 10), ir.request_number, ir.initiator_id, trimmed);
        return NextResponse.json({ message: 'Request sent back to initiator for corrections' });
      }

      case 'save_part2_step1': {
        if (inspectionSkipsPart2Part3(ir)) {
          return NextResponse.json(
            {
              error:
                'Part II is not used when Part I 19(f) joint inspection is No or N/A — R&QA Inspector completes Part IV only',
            },
            { status: 400 }
          );
        }
        if (userRole !== 'qa_head' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only QA Head can complete Part II Step 1' }, { status: 403 });
        }
        if (userRole === 'qa_head' && hasInspectorsAssigned(ir)) {
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
        const { nominated_team_head_id: bodyNominatedId, forward_to_ordaqa: fwdOrdaqa, part2_notes: p2notes, part2_data: p2data } = body;
        if (!bodyNominatedId) {
          return NextResponse.json({ error: 'Team Head - QA must be selected' }, { status: 400 });
        }

        const inspectorsLocked = hasInspectorsAssigned(ir);
        if (inspectorsLocked && Number(bodyNominatedId) !== Number(ir.nominated_team_head_id)) {
          return NextResponse.json(
            {
              error:
                'Inspectors are already assigned. Change nominated Team Head only after unassigning inspectors, or keep the current Team Head.',
            },
            { status: 400 }
          );
        }

        const effectiveNominatedId = inspectorsLocked ? Number(ir.nominated_team_head_id) : Number(bodyNominatedId);

        if (effectiveNominatedId > 0 && !(await isEligibleRqaTeamHead(effectiveNominatedId))) {
          return NextResponse.json(
            {
              error:
                'Team Head - QA must be an active Team Head (TH) in the R&QA department',
            },
            { status: 400 }
          );
        }

        const incomingP2 =
          p2data && typeof p2data === 'object' ? (p2data as Record<string, unknown>) : parsePart2Data(p2data);
        const wantsReturn = incomingP2.return_to_designer === 'yes';

        if (wantsReturn) {
          if (ir.status !== 'request_approved') {
            return NextResponse.json(
              {
                error:
                  'Return to designer is only available while the IR is in Forwarded status (before inspection has started).',
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
                nominated_team_head_id: effectiveNominatedId,
              },
            ],
          };
          const actorName = (session.user as { name?: string })?.name || 'QA Head';
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
            effectiveNominatedId,
            comments,
            actorName
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
            const resetP3 = { ...existingP3 };
            delete resetP3.section23_complete;
            resetP3.memo_returned = 'no';
            delete resetP3.delegation_type;
            delete resetP3.assigned_delegated_to;
            await query(
              `UPDATE inspection_requests
               SET part3_data = $2, ordaqa_inspector_id = NULL, part3_completed_by = NULL, part3_date = NULL, updated_at = NOW()
               WHERE id = $1`,
              [id, JSON.stringify(resetP3)]
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
          message: isPart2Update
            ? `Part II updated — forwarded to ${teamHeadName}`
            : `Inspection request forwarded to ${teamHeadName}`,
          nominated_team_head_name: teamHeadName,
          forwarded_to_team_head: true,
        });
      }

      case 'assign_inspector': {
        if (inspectionSkipsPart2Part3(ir)) {
          return NextResponse.json(
            {
              error:
                'Part II inspector assignment is not used when Part I 19(f) joint inspection is No or N/A',
            },
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

        if (alreadyAssigned) {
          await query(
            `UPDATE inspection_requests
             SET inspector_id = $2, inspector_ids = $3,
                 updated_at = NOW()
             WHERE id = $1`,
            [id, inspectorIds[0], JSON.stringify(inspectorIds)]
          );
          await logActivity(
            id,
            'assigned',
            `Inspector assignment updated by Team Head (${inspectorIds.length} inspector(s))`,
            userId
          );
        } else {
          await query(
            `UPDATE inspection_requests
             SET status = 'assigned', inspector_id = $2, inspector_ids = $3,
                 updated_at = NOW()
             WHERE id = $1`,
            [id, inspectorIds[0], JSON.stringify(inspectorIds)]
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
          await notifyInspectorsAssignedPart2(
            parseInt(id, 10),
            String(ir.request_number),
            inspectorIds,
            ir.initiator_id,
            teamHeadName
          );
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
        if (inspectionSkipsPart2Part3(ir)) {
          return NextResponse.json(
            { error: 'Part II is not used when Part I 19(f) joint inspection is No or N/A' },
            { status: 400 }
          );
        }
        if (userRole !== 'inspector' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only assigned inspector can update these Part II details' }, { status: 403 });
        }
        if (!['assigned', 'in_progress'].includes(ir.status)) {
          return NextResponse.json({ error: 'Inspector Part II details can only be updated after assignment' }, { status: 400 });
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
        const outstationInspection = !!incomingP2.outstation_inspection;
        const mergedP2 = {
          ...existingP2,
          third_party_agency: String(incomingP2.third_party_agency || ''),
          outstation_inspection: outstationInspection,
          email_sent: outstationInspection ? String(incomingP2.email_sent || 'no') : null,
          email_sent_by: outstationInspection ? String(incomingP2.email_sent_by || '') : null,
          email_sent_date: outstationInspection ? String(incomingP2.email_sent_date || '') : null,
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
          'Part II outstation/third-party details updated by assigned inspector',
          userId
        );
        return NextResponse.json({ message: 'Inspector Part II details updated' });
      }

      case 'save_part3_section23': {
        if (inspectionSkipsPart2Part3(ir)) {
          return NextResponse.json(
            { error: 'Part III is not used when Part I 19(f) joint inspection is No or N/A' },
            { status: 400 }
          );
        }
        if (userRole !== 'ordaqa_head' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only ORDAQA Head can complete Section 23' }, { status: 403 });
        }
        if (!ir.forwarded_to_ordaqa) {
          return NextResponse.json({ error: 'IR is not forwarded to ORDAQA' }, { status: 400 });
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
        if (inspectionSkipsPart2Part3(ir)) {
          return NextResponse.json(
            { error: 'Part III is not used when Part I 19(f) joint inspection is No or N/A' },
            { status: 400 }
          );
        }
        if (userRole !== 'ordaqa_head' && userRole !== 'administrator') {
          return NextResponse.json({ error: 'Only ORDAQA Head can forward Part III to the inspector' }, { status: 403 });
        }
        if (!ir.forwarded_to_ordaqa) {
          return NextResponse.json({ error: 'IR is not forwarded to ORDAQA' }, { status: 400 });
        }
        if (!part3Section23EditableStatus(ir.status)) {
          return NextResponse.json(
            { error: 'Section 23 assignment can only be completed while the IR is forwarded, assigned, or in progress' },
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
              ir.initiator_id
            );
          } catch (e) {
            console.error('QA Head memo-return notification:', e);
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
                  'Delegated path: choose Inspector / QA Rep or Team Head - QA (inspector or qa_approver)',
              },
              { status: 400 }
            );
          }
        }
        const displayName =
          typeof assignPatch.assigned_delegated_to === 'string' && assignPatch.assigned_delegated_to.trim()
            ? String(assignPatch.assigned_delegated_to).trim()
            : assigneeName;
        const merged = {
          ...existing,
          ...assignPatch,
          section23_complete: true,
          delegation_type: delegationType,
          assigned_delegated_to: displayName,
        };
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
          if (section23WasComplete) {
            const assigneeLabel = assigneeName || 'ORDAQA assignee';
            await notifyInitiatorIrMilestone(ir.initiator_id, parseInt(id, 10), String(ir.request_number), {
              title: 'ORDAQA assignee set',
              message: `Your inspection request ${ir.request_number}: ORDAQA Head assigned ${assigneeLabel} for Part III / Part V follow-up.`,
              type: 'request_assigned',
            });
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
        await query(
          `UPDATE inspection_requests
           SET ordaqa_approver_id = $2, ordaqa_approval_date = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [id, userId]
        );
        await logActivity(id, 'part5_ordaqa_approved', 'Part V approved by ORDAQA Head', userId);
        const approverName = (session.user as { name?: string })?.name?.trim() || 'ORDAQA Head';
        try {
          const assigneeId =
            ir.part3_completed_by != null ? Number(ir.part3_completed_by) : ir.ordaqa_inspector_id;
          await notifyOrdaqaAssigneePart5Approved(
            parseInt(id, 10),
            String(ir.request_number),
            assigneeId,
            approverName
          );
          await notifyPart2InspectorsPart5ApprovedForInspection(
            parseInt(id, 10),
            String(ir.request_number),
            collectInspectorIds(ir),
            approverName
          );
        } catch (e) {
          console.error('Part V approved notification:', e);
        }
        return NextResponse.json({ message: 'Part V approved by ORDAQA Head' });
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
        await query(
          `UPDATE inspection_requests 
           SET part3_data = $2, part3_completed_by = $3, part3_date = NOW(), updated_at = NOW() 
           WHERE id = $1`,
          [id, JSON.stringify(merged), userId]
        );
        await logActivity(id, 'part5_saved', 'Part V — ORDAQA Sections 24–25 saved (in part3_data)', userId);
        try {
          await syncObservationThreadsFromRemarks(
            parseInt(id, 10),
            'part5',
            (merged.inspection_remarks as unknown) ?? []
          );
        } catch (e) {
          console.error('Observation thread sync (Part V):', e);
        }
        try {
          await notifyOrdaqaHeadsPart5PendingApproval(parseInt(id, 10), String(ir.request_number));
        } catch (e) {
          console.error('ORDAQA Heads Part V pending notification:', e);
        }
        return NextResponse.json({
          message: 'Part V saved — awaiting ORDAQA Head approval',
        });
      }

      case 'save_part4': {
        if (ordqaPart5Completed(ir)) {
          return NextResponse.json(
            { error: 'Part IV cannot be edited after Part V (ORDAQA Sections 24–25) is completed' },
            { status: 400 }
          );
        }
        if (!canUserUpdatePart4(ir, userId, userRole)) {
          return NextResponse.json(
            {
              error: inspectionSkipsPart2Part3(ir)
                ? 'Only an R&QA Inspector can update Part IV when joint inspection was not requested in Part I'
                : 'Only an inspector assigned in Part II can update Part IV',
            },
            { status: 403 }
          );
        }
        const skipPart23 = inspectionSkipsPart2Part3(ir);
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
        const { part4_data: p4data } = body;
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
        await logActivity(id, 'part4_saved', 'Part IV — R&QA Inspection Report saved', userId);
        try {
          await syncObservationThreadsFromRemarks(
            parseInt(id, 10),
            'part4',
            (p4data as { part4_remarks?: unknown })?.part4_remarks ?? []
          );
        } catch (e) {
          console.error('Observation thread sync (Part IV):', e);
        }
        try {
          const part4Ctx = {
            initiator_id: ir.initiator_id != null ? Number(ir.initiator_id) : null,
            nominated_team_head_id:
              ir.nominated_team_head_id != null ? Number(ir.nominated_team_head_id) : null,
            inspector_id: ir.inspector_id != null ? Number(ir.inspector_id) : null,
            inspector_ids_raw: (() => {
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
          if (part4Ctx.forwarded_to_ordaqa && part4Ctx.ordaqa_inspector_id) {
            const inspectorName = (session.user as { name?: string })?.name?.trim() || '';
            await notifyOrdaqaAssigneePart4ForwardedForPart5(
              parseInt(id, 10),
              String(ir.request_number),
              part4Ctx.ordaqa_inspector_id,
              inspectorName
            );
          }
        } catch (e) {
          console.error('Part IV saved notifications:', e);
        }
        return NextResponse.json({ message: 'Part IV saved' });
      }

      case 'start_inspection': {
        if (!canUserStartInspection(ir, userId, userRole)) {
          return NextResponse.json(
            {
              error:
                'Only an inspector assigned in Part II can start inspection',
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
        await logActivity(id, 'started', 'Inspection started by assigned inspector', userId);
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
              error: inspectionSkipsPart2Part3(ir)
                ? 'Only the R&QA Inspector who saved Part IV can complete inspection'
                : 'Only an inspector assigned in Part II can complete inspection',
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
            { skipPart2Part3: inspectionSkipsPart2Part3(ir) }
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
        if (ir.status !== 'inspection_completed') {
          return NextResponse.json({ error: 'Inspection must be completed first' }, { status: 400 });
        }
        const skipPart23Approve = inspectionSkipsPart2Part3(ir);
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
        if (ir.status !== 'inspection_completed') {
          return NextResponse.json(
            { error: 'Inspection must be completed by the inspector before Team Head can reject' },
            { status: 400 }
          );
        }
        const skipPart23Reject = inspectionSkipsPart2Part3(ir);
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
        await query(
          `UPDATE inspection_requests
           SET status = 'rejected',
               rejection_reason = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [id, trimmedReason]
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
            trimmedReason
          );
          if (inspectorUserIds.length > 1) {
            await createBulkNotifications(inspectorUserIds.slice(1), {
              title: 'Inspection Rejected',
              message: `Inspection request ${ir.request_number} has been rejected. Reason: ${trimmedReason}`,
              type: 'request_rejected',
              entityType: 'inspection_request',
              entityId: parseInt(id, 10),
              sendEmail: true,
            });
          }
        } catch (e) {
          console.error('QA reject notification:', e);
        }
        return NextResponse.json({ message: 'IR rejected' });
      }

      case 'qa_approver_send_back': {
        const skipPart23SendBack = inspectionSkipsPart2Part3(ir);
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
        const mergedP2 = {
          ...existingP2,
          qa_pipeline_touched: true,
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

        await notifyQaApproverSendBack(
          parseInt(id, 10),
          ir.request_number,
          ir.initiator_id,
          reqApprId,
          trimmed,
          actorName,
          target,
          inspectorUserIds
        );

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
