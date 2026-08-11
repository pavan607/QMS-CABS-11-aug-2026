import pool from './db';
import { normalizeEmployeeId } from './employee-id';
import { PART1_APPROVER_EMPLOYEE_ID } from './part1-approver';


export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'request_submitted'
  | 'request_assigned'
  | 'request_approved'
  | 'request_rejected'
  | 'request_closed'
  | 'inspection_completed'
  | 'overdue_alert'
  | 'returned_to_designer'
  | 'ir_resubmitted_after_return'
  | 'forwarded_to_qa_head'
  | 'forwarded_to_ordaqa'
  | 'memo_returned_to_qa_head'
  | 'team_head_qa_nominated'
  | 'part2_inspector_assigned'
  | 'part2_inspector_replaced'
  | 'part4_saved'
  | 'part4_pending_team_head_approval'
  | 'part4_team_head_rejected'
  | 'part4_team_head_approved'
  | 'part4_forwarded_for_part5'
  | 'part3_completed'
  | 'part5_pending_ordaqa_approval'
  | 'part5_head_send_back'
  | 'part5_ordaqa_approved'
  | 'part5_approved_start_inspection';

export interface NotificationPayload {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string;
  entityId?: number;
  sendEmail?: boolean;
}

/**
 * Create a notification for a user
 */
export async function createNotification(payload: NotificationPayload): Promise<void> {
  const { userId, title, message, type, entityType, entityId, sendEmail = false } = payload;

  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, entity_type, entity_id, sent_via_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, title, message, type, entityType || null, entityId || null, sendEmail]
    );

    // TODO: Send email notification if sendEmail is true
    if (sendEmail) {
      await sendEmailNotification({ userId, title, message, type });
    }
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications(
  userIds: number[],
  payload: Omit<NotificationPayload, 'userId'>
): Promise<void> {
  const promises = userIds.map((userId) =>
    createNotification({ ...payload, userId })
  );
  await Promise.all(promises);
}

async function lookupUserNames(userIds: number[]): Promise<string> {
  const ids = [...new Set(userIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (!ids.length) return '—';
  const r = await pool.query(
    `SELECT name FROM users WHERE id = ANY($1::int[]) ORDER BY name`,
    [ids]
  );
  const names = r.rows
    .map((row: { name: string }) => row.name?.trim())
    .filter((n: string | undefined): n is string => !!n);
  return names.length ? names.join(', ') : '—';
}

function normalizePositiveIds(userIds: unknown[]): number[] {
  return [
    ...new Set(
      userIds
        .map((x) => parseInt(String(x), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
}

function sameIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

/**
 * Notify the IR initiator of a workflow milestone on their inspection request.
 */
export async function notifyInitiatorIrMilestone(
  initiatorId: number | null | undefined,
  requestId: number,
  requestNumber: string,
  payload: {
    title: string;
    message: string;
    type: NotificationType;
    sendEmail?: boolean;
  }
): Promise<void> {
  const uid = initiatorId != null ? Number(initiatorId) : NaN;
  if (!Number.isFinite(uid) || uid < 1) return;
  await createNotification({
    userId: uid,
    title: payload.title,
    message: payload.message,
    type: payload.type,
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: payload.sendEmail ?? false,
  });
}

/**
 * Notify about inspection request submission (Part I create).
 * When `nominatedRequestApproverId` is set (field 21 — certifier), that user also gets an in-app (bell) notification.
 */
export async function notifyInspectionRequestSubmitted(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  nominatedRequestApproverId: number | null = null
): Promise<void> {
  // Notify administrators about new request (exclude initiator to avoid duplicate)
  const adminResult = await pool.query(
    `SELECT id FROM users WHERE role = 'administrator' AND status = 'active' AND id != $1`,
    [initiatorId]
  );

  const adminIds = adminResult.rows.map((row) => row.id);

  if (adminIds.length > 0) {
    await createBulkNotifications(adminIds, {
      title: 'New Inspection Request Submitted',
      message: `Inspection request ${requestNumber} has been submitted and is awaiting assignment.`,
      type: 'request_submitted',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  // Notify initiator
  await createNotification({
    userId: initiatorId,
    title: 'Inspection Request Submitted',
    message: `Your inspection request ${requestNumber} has been successfully submitted.`,
    type: 'request_submitted',
    entityType: 'inspection_request',
    entityId: requestId,
  });

  // Notify nominated Request Approver (field 21 — Designer DH/GD/TH certifier), if distinct from initiator
  if (
    nominatedRequestApproverId != null &&
    nominatedRequestApproverId > 0 &&
    nominatedRequestApproverId !== initiatorId
  ) {
    const appr = await pool.query(
      `SELECT id FROM users u
       WHERE u.id = $1
         AND COALESCE(u.status, 'active') = 'active'
         AND (
           u.role = 'request_approver'
           OR (
             u.role = 'initiator'
             AND UPPER(TRIM(COALESCE(u.designation, ''))) = 'DH'
           )
         )`,
      [nominatedRequestApproverId]
    );
    if (appr.rows[0]) {
      const initiatorName = await lookupUserNames([initiatorId]);
      const by =
        initiatorName !== '—' ? ` by ${initiatorName}` : '';
      await createNotification({
        userId: nominatedRequestApproverId,
        title: 'Inspection request — you are nominated certifier',
        message: `Inspection request ${requestNumber} was submitted${by}. You are selected as Request Approver (certifier) for this IR.`,
        type: 'request_submitted',
        entityType: 'inspection_request',
        entityId: requestId,
        sendEmail: true,
      });
    }
  }
}

/**
 * When a nominated field-21 certifier (e.g. DH + Initiator/Designer) edits Part I,
 * notify the original initiator/designer with the list of changed fields.
 */
export async function notifyInitiatorPart1EditedByCertifier(
  requestId: number,
  requestNumber: string,
  initiatorId: number | null | undefined,
  editorUserId: number,
  editorName: string,
  changedFieldsSummary?: string
): Promise<void> {
  if (initiatorId == null || !Number.isFinite(Number(initiatorId)) || Number(initiatorId) < 1) {
    return;
  }
  if (Number(initiatorId) === editorUserId) return;

  const by = editorName.trim() || 'Request Approver';
  const fieldsNote = changedFieldsSummary?.trim()
    ? `\n\nChanged fields:\n${changedFieldsSummary.trim()}`
    : '\n\nOpen the IR to review the updated Part I fields.';
  await createNotification({
    userId: Number(initiatorId),
    title: 'Part I fields updated by Request Approver',
    message: `${by} updated Part I of inspection request ${requestNumber}.${fieldsNote}`,
    type: 'request_updated',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * When an IR is submitted for Request Approver forward, notify the nominated approver (field 21),
 * or — if none is stored (legacy rows) — every Request Approver on the initiator's management chain.
 */
export async function notifyRequestApproversPendingForward(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  nominatedRequestApproverId: number | null
): Promise<void> {
  let userIds: number[] = [];
  if (nominatedRequestApproverId != null && nominatedRequestApproverId > 0) {
    const r = await pool.query(
      `SELECT id FROM users u
       WHERE u.id = $1
         AND COALESCE(u.status, 'active') = 'active'
         AND (
           u.role = 'request_approver'
           OR (
             u.role = 'initiator'
             AND UPPER(TRIM(COALESCE(u.designation, ''))) = 'DH'
           )
         )`,
      [nominatedRequestApproverId]
    );
    if (r.rows[0]) userIds.push(r.rows[0].id);
  }
  if (userIds.length === 0) {
    const chain = await pool.query(
      `WITH RECURSIVE anc AS (
         SELECT id, reporting_to, role FROM users WHERE id = $1
         UNION ALL
         SELECT u.id, u.reporting_to, u.role FROM users u INNER JOIN anc a ON u.id = a.reporting_to
       )
       SELECT id FROM anc WHERE role = 'request_approver'`,
      [initiatorId]
    );
    userIds = chain.rows.map((row: { id: number }) => row.id);
  }
  if (userIds.length === 0) return;
  const initiatorName = await lookupUserNames([initiatorId]);
  const by = initiatorName !== '—' ? ` by ${initiatorName}` : '';
  await createBulkNotifications(userIds, {
    title: 'Inspection request awaiting your forward',
    message: `Inspection request ${requestNumber} was submitted${by} for Request Approver forward.`,
    type: 'request_submitted',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After Request Approver forwards, notify the fixed Part I approver (employee 1021).
 */
export async function notifyPart1ApproverAfterRequestApproverForward(
  requestId: number,
  requestNumber: string,
  forwardedByName: string,
  initiatorId?: number | null,
  forwardComment?: string | null
): Promise<void> {
  const { normalizeEmployeeId } = await import('@/lib/employee-id');
  const eid = normalizeEmployeeId(PART1_APPROVER_EMPLOYEE_ID);
  const r = await pool.query(
    `SELECT id FROM users
     WHERE UPPER(TRIM(COALESCE(employee_id, ''))) = $1
       AND COALESCE(status, 'active') = 'active'
     LIMIT 1`,
    [eid]
  );
  const by = forwardedByName.trim() || 'Request Approver';
  const commentNote = forwardComment?.trim() ? ` Comment: ${forwardComment.trim()}` : '';

  if (r.rows[0]) {
    await createNotification({
      userId: r.rows[0].id,
      title: 'IR awaiting Part I approval',
      message: `Inspection request ${requestNumber} was forwarded by ${by} and awaits your Part I approval.${commentNote}`,
      type: 'request_submitted',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
    title: 'Forwarded for Part I approval',
    message: `Your inspection request ${requestNumber} was forwarded by ${by} and is awaiting Part I approval.`,
    type: 'request_submitted',
    sendEmail: true,
  });
}

/**
 * Notify about inspection request assignment
 */
export async function notifyInspectionRequestAssigned(
  requestId: number,
  requestNumber: string,
  inspectorId: number,
  initiatorId: number
): Promise<void> {
  // Notify inspector
  await createNotification({
    userId: inspectorId,
    title: 'Inspection Request Assigned',
    message: `Inspection request ${requestNumber} has been assigned to you.`,
    type: 'request_assigned',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });

  // Notify initiator
  await createNotification({
    userId: initiatorId,
    title: 'Inspection Request Assigned',
    message: `Your inspection request ${requestNumber} has been assigned to an inspector.`,
    type: 'request_assigned',
    entityType: 'inspection_request',
    entityId: requestId,
  });
}

/**
 * Notify about inspection completion
 */
export async function notifyInspectionCompleted(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  approverId?: number,
  nominatedTeamHeadId?: number | null,
  options?: { skipPart2Part3?: boolean }
): Promise<void> {
  // Notify initiator
  await createNotification({
    userId: initiatorId,
    title: 'Inspection Completed',
    message: `Inspection ${requestNumber} has been completed and is awaiting approval.`,
    type: 'inspection_completed',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });

  if (options?.skipPart2Part3) {
    const { listActiveRqaTeamHeadUserIds } = await import('@/lib/rqa-users');
    const teamHeadIds = await listActiveRqaTeamHeadUserIds();
    if (teamHeadIds.length > 0) {
      await createBulkNotifications(teamHeadIds, {
        title: 'Inspection Ready for Approval',
        message: `Inspection ${requestNumber} has been completed (no joint inspection). Approve & Close as Team Head – QA.`,
        type: 'inspection_completed',
        entityType: 'inspection_request',
        entityId: requestId,
        sendEmail: true,
      });
    }
    return;
  }

  const teamHeadId =
    nominatedTeamHeadId != null && Number(nominatedTeamHeadId) > 0
      ? Number(nominatedTeamHeadId)
      : null;

  if (teamHeadId) {
    await createNotification({
      userId: teamHeadId,
      title: 'Inspection Ready for Approval',
      message: `Inspection ${requestNumber} has been completed and is ready for your approval as Team Head – QA.`,
      type: 'inspection_completed',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  } else if (approverId) {
    await createNotification({
      userId: approverId,
      title: 'Inspection Ready for Approval',
      message: `Inspection ${requestNumber} has been completed and is ready for your approval.`,
      type: 'inspection_completed',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  } else {
    const qaHeadResult = await pool.query(
      `SELECT id FROM users WHERE role = 'qa_head' AND COALESCE(status, 'active') = 'active'`
    );
    const qaHeadIds = qaHeadResult.rows.map((row: { id: number }) => row.id);
    if (qaHeadIds.length > 0) {
      await createBulkNotifications(qaHeadIds, {
        title: 'Inspection Ready for Approval',
        message: `Inspection ${requestNumber} has been completed and is ready for approval (no Team Head – QA nominated).`,
        type: 'inspection_completed',
        entityType: 'inspection_request',
        entityId: requestId,
        sendEmail: true,
      });
    }
  }
}

/**
 * Notify about inspection approval
 */
export async function notifyInspectionApproved(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  inspectorId?: number
): Promise<void> {
  const userIds = [initiatorId];
  if (inspectorId) userIds.push(inspectorId);

  await createBulkNotifications(userIds, {
    title: 'Inspection Approved',
    message: `Inspection request ${requestNumber} has been approved.`,
    type: 'request_approved',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * Notify about inspection rejection
 */
export async function notifyInspectionRejected(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  inspectorId?: number,
  reason?: string
): Promise<void> {
  const message = reason
    ? `Inspection request ${requestNumber} has been rejected. Reason: ${reason}`
    : `Inspection request ${requestNumber} has been rejected.`;

  const userIds = [initiatorId];
  if (inspectorId) userIds.push(inspectorId);

  await createBulkNotifications(userIds, {
    title: 'Inspection Rejected',
    message,
    type: 'request_rejected',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * Notify about overdue inspection
 */
/**
 * QA Head returned IR to designer (Section 22). Notify initiator, Design Request Approver,
 * nominated Team Head – QA, and all QA Heads (R&QA visibility).
 */
export async function notifyReturnedToDesignerByQaHead(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  requestApproverId: number | null,
  nominatedTeamHeadQaId: number | null,
  returnComments: string,
  qaHeadActorName: string
): Promise<void> {
  const snippet =
    returnComments.length > 200 ? `${returnComments.slice(0, 200)}…` : returnComments;
  const message = `Inspection request ${requestNumber} was returned to the designer/initiator by ${qaHeadActorName}. Comments: ${snippet}`;

  const ids = new Set<number>([initiatorId]);
  if (nominatedTeamHeadQaId) ids.add(nominatedTeamHeadQaId);
  if (requestApproverId) ids.add(requestApproverId);

  const heads = await pool.query(
    `SELECT id FROM users WHERE role = 'qa_head' AND status = 'active'`
  );
  heads.rows.forEach((r: { id: number }) => ids.add(r.id));

  await createBulkNotifications(Array.from(ids), {
    title: 'Inspection request returned to designer',
    message,
    type: 'returned_to_designer',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * Nominated Team Head – QA sent the IR back to initiator/designer (Part I corrections).
 * Notifies initiator, Request Approver, QA Heads, and previously assigned inspectors.
 */
export async function notifyQaApproverSendBack(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  requestApproverId: number | null,
  returnComments: string,
  actorName: string,
  target: 'initiator' | 'designer',
  inspectorUserIds: number[]
): Promise<void> {
  const snippet =
    returnComments.length > 200 ? `${returnComments.slice(0, 200)}…` : returnComments;
  const audience =
    target === 'designer'
      ? 'the designer (update Part I as applicable)'
      : 'the initiator (Part I account holder)';
  const message = `Inspection request ${requestNumber} was sent back by Team Head – QA ${actorName} for ${audience}. Comments: ${snippet}`;

  const ids = new Set<number>([initiatorId]);
  if (requestApproverId) ids.add(requestApproverId);
  for (const uid of inspectorUserIds) {
    if (Number.isFinite(uid) && uid > 0) ids.add(uid);
  }

  const heads = await pool.query(
    `SELECT id FROM users WHERE role = 'qa_head' AND status = 'active'`
  );
  heads.rows.forEach((r: { id: number }) => ids.add(r.id));

  const title =
    target === 'designer'
      ? 'IR sent back — designer / Part I'
      : 'IR sent back — initiator';

  await createBulkNotifications(Array.from(ids), {
    title,
    message,
    type: 'returned_to_designer',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * Assigned ORDAQA person (Sections 24–25) sent the IR back for Part I corrections.
 * Notifies initiator, Request Approver, QA Heads, ORDAQA Heads, and assigned R&QA inspectors.
 */
export async function notifyOrdaqaInspectorSendBack(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  requestApproverId: number | null,
  returnComments: string,
  actorName: string,
  target: 'initiator' | 'designer',
  inspectorUserIds: number[]
): Promise<void> {
  const snippet =
    returnComments.length > 200 ? `${returnComments.slice(0, 200)}…` : returnComments;
  const audience =
    target === 'designer'
      ? 'the designer (update Part I as applicable)'
      : 'the initiator (Part I account holder)';
  const message = `Inspection request ${requestNumber} was sent back by ORDAQA assignee ${actorName} for ${audience}. Comments: ${snippet}`;

  const ids = new Set<number>([initiatorId]);
  if (requestApproverId) ids.add(requestApproverId);
  for (const uid of inspectorUserIds) {
    if (Number.isFinite(uid) && uid > 0) ids.add(uid);
  }

  const heads = await pool.query(
    `SELECT id FROM users WHERE role IN ('qa_head', 'ordaqa_head') AND status = 'active'`
  );
  heads.rows.forEach((r: { id: number }) => ids.add(r.id));

  const title =
    target === 'designer'
      ? 'IR sent back — designer / Part I (ORDAQA)'
      : 'IR sent back — initiator (ORDAQA)';

  await createBulkNotifications(Array.from(ids), {
    title,
    message,
    type: 'returned_to_designer',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/** After initiator resubmits an IR that had previously been in the QA pipeline, notify QA Heads. */
export async function notifyQaHeadsResubmittedAfterReturn(
  requestId: number,
  requestNumber: string
): Promise<void> {
  const heads = await pool.query(
    `SELECT id FROM users WHERE role = 'qa_head' AND status = 'active'`
  );
  const userIds = heads.rows.map((r: { id: number }) => r.id);
  if (userIds.length === 0) return;

  await createBulkNotifications(userIds, {
    title: 'Inspection request resubmitted',
    message: `Inspection request ${requestNumber} was updated by the initiator and submitted again for Request Approver forward, then QA Head (Part II).`,
    type: 'ir_resubmitted_after_return',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After Part I is approved (status → `request_approved`), notify QA Heads for Part II.
 */
export async function notifyQaHeadsAfterRequestApproverForward(
  requestId: number,
  requestNumber: string,
  forwardedByName: string,
  initiatorId?: number | null,
  forwardComment?: string | null
): Promise<void> {
  const heads = await pool.query(
    `SELECT id FROM users WHERE role = 'qa_head' AND COALESCE(status, 'active') = 'active'`
  );
  const userIds = heads.rows.map((r: { id: number }) => r.id);
  const by = forwardedByName.trim() || 'Request Approver';
  const commentNote =
    forwardComment?.trim()
      ? ` Comment: ${forwardComment.trim()}`
      : '';

  if (userIds.length > 0) {
    await createBulkNotifications(userIds, {
      title: 'IR forwarded to QA Head',
      message: `Inspection request ${requestNumber} was forwarded by ${by}. Complete Part II (QA Head) when ready.${commentNote}`,
      type: 'forwarded_to_qa_head',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
    title: 'IR forwarded to QA Head',
    message: `Your inspection request ${requestNumber} was forwarded by ${by} and is with QA Head (Part II).`,
    type: 'forwarded_to_qa_head',
    sendEmail: true,
  });
}

/**
 * After QA Head saves Part II Step 1 with Forward to ORDAQA enabled,
 * notify all active ORDAQA Heads (bell + optional email). Call only when newly forwarded.
 */
export async function notifyOrdaqaHeadsForwardedToOrdaqa(
  requestId: number,
  requestNumber: string,
  initiatorId?: number | null
): Promise<void> {
  const heads = await pool.query(
    `SELECT id FROM users WHERE role = 'ordaqa_head' AND COALESCE(status, 'active') = 'active'`
  );
  const userIds = heads.rows.map((r: { id: number }) => r.id);

  if (userIds.length > 0) {
    await createBulkNotifications(userIds, {
      title: 'IR forwarded to ORDAQA',
      message: `Inspection request ${requestNumber} was forwarded to ORDAQA for joint inspection. Complete Part III (Section 23) when ready.`,
      type: 'forwarded_to_ordaqa',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
    title: 'IR forwarded to ORDAQA',
    message: `Your inspection request ${requestNumber} was forwarded to ORDAQA for joint inspection.`,
    type: 'forwarded_to_ordaqa',
    sendEmail: true,
  });
}

/**
 * After ORDAQA Head saves Part III Section 23 with Memo to be Returned = Yes,
 * notify QA Heads so they can review Part II and re-forward to ORDAQA when ready.
 */
export async function notifyQaHeadsMemoReturnedFromOrdaqa(
  requestId: number,
  requestNumber: string,
  ordaqaHeadName: string,
  initiatorId?: number | null
): Promise<void> {
  const heads = await pool.query(
    `SELECT id FROM users WHERE role = 'qa_head' AND COALESCE(status, 'active') = 'active'`
  );
  const userIds = heads.rows.map((r: { id: number }) => r.id);
  const by = ordaqaHeadName.trim() || 'ORDAQA Head';

  if (userIds.length > 0) {
    await createBulkNotifications(userIds, {
      title: 'Memo returned — review Part II',
      message: `Inspection request ${requestNumber}: ${by} marked the memo for return in Part III (Section 23). Review Part II and re-forward to ORDAQA when ready.`,
      type: 'memo_returned_to_qa_head',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
    title: 'Memo returned to QA Head',
    message: `Your inspection request ${requestNumber}: ORDAQA returned the memo to QA Head for Part II review.`,
    type: 'memo_returned_to_qa_head',
    sendEmail: true,
  });
}

/**
 * After QA Head saves Part II Step 1 with a nominated Team Head – QA (`qa_approver`),
 * notify that user (bell + optional email). Call only when the nomination is new or changed.
 */
export async function notifyNominatedTeamHeadQaPart2(
  requestId: number,
  requestNumber: string,
  nominatedTeamHeadUserId: number,
  nominatorName?: string,
  initiatorId?: number | null
): Promise<void> {
  if (!nominatedTeamHeadUserId || nominatedTeamHeadUserId < 1) return;
  const r = await pool.query(
    `SELECT id, name FROM users WHERE id = $1 AND COALESCE(status, 'active') = 'active'
     AND TRIM(COALESCE(department, '')) = 'R&QA'`,
    [nominatedTeamHeadUserId]
  );
  if (!r.rows[0]) return;

  const who = (nominatorName && String(nominatorName).trim()) || 'QA Head';
  const teamHeadName = (r.rows[0] as { name?: string }).name?.trim() || 'Team Head – QA';

  await createNotification({
    userId: nominatedTeamHeadUserId,
    title: 'You are nominated as Team Head – QA',
    message: `Inspection request ${requestNumber}: ${who} saved Part II and nominated you as Team Head – QA. Assign inspector(s) in Part II when ready.`,
    type: 'team_head_qa_nominated',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });

  await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
    title: 'Team Head – QA nominated',
    message: `Your inspection request ${requestNumber}: ${who} nominated ${teamHeadName} as Team Head – QA. Inspector(s) will be assigned next.`,
    type: 'team_head_qa_nominated',
    sendEmail: true,
  });
}

/**
 * After assignee saves Part V — notify all ORDAQA Heads to approve Sections 24–25.
 */
export async function notifyOrdaqaHeadsPart5PendingApproval(
  requestId: number,
  requestNumber: string
): Promise<void> {
  const heads = await pool.query(
    `SELECT id FROM users WHERE role = 'ordaqa_head' AND COALESCE(status, 'active') = 'active'`
  );
  const userIds = heads.rows.map((r: { id: number }) => r.id);
  if (userIds.length === 0) return;

  await createBulkNotifications(userIds, {
    title: 'Part V pending your approval',
    message: `Inspection request ${requestNumber}: Part V (Sections 24–25) was submitted and awaits ORDAQA Head approval.`,
    type: 'part5_pending_ordaqa_approval',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After ORDAQA Head approves Part V — notify Team Head – QA that Part V is complete.
 */
export async function notifyTeamHeadPart5ApprovedForInspection(
  requestId: number,
  requestNumber: string,
  nominatedTeamHeadId: number | null | undefined,
  skipsPart2Part3: boolean,
  ordaqaHeadName?: string
): Promise<void> {
  const recipientIds = new Set<number>();

  if (skipsPart2Part3) {
    const { listActiveRqaTeamHeadUserIds } = await import('@/lib/rqa-users');
    for (const id of await listActiveRqaTeamHeadUserIds()) recipientIds.add(id);
  } else if (nominatedTeamHeadId != null && Number(nominatedTeamHeadId) > 0) {
    recipientIds.add(Number(nominatedTeamHeadId));
  }

  if (recipientIds.size === 0) return;

  const who = (ordaqaHeadName && String(ordaqaHeadName).trim()) || 'ORDAQA Head';

  await createBulkNotifications(Array.from(recipientIds), {
    title: 'ORDAQA Head approved Part V',
    message: `Inspection request ${requestNumber}: ${who} has approved Part V. The IR is ready for your review.`,
    type: 'part5_approved_start_inspection',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After ORDAQA Head sends Part V back — notify the assigned ORDAQA inspector to revise and resubmit.
 */
export async function notifyOrdaqaAssigneePart5SentBack(
  requestId: number,
  requestNumber: string,
  assigneeUserId: number | null | undefined,
  headName: string,
  commentSnippet: string
): Promise<void> {
  if (!assigneeUserId || assigneeUserId < 1) return;
  const who = (headName && String(headName).trim()) || 'ORDAQA Head';
  const snippet =
    commentSnippet.length > 200 ? `${commentSnippet.slice(0, 200)}…` : commentSnippet;
  await createNotification({
    userId: assigneeUserId,
    title: 'Part V sent back for revision',
    message: `Inspection request ${requestNumber}: ${who} sent back Part V (Sections 24–25) for your revision. Comments: ${snippet}`,
    type: 'part5_head_send_back',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After ORDAQA Head approves Part V — notify the assignee who saved Sections 24–25.
 */
export async function notifyOrdaqaAssigneePart5Approved(
  requestId: number,
  requestNumber: string,
  assigneeUserId: number | null | undefined,
  approverName?: string
): Promise<void> {
  if (!assigneeUserId || assigneeUserId < 1) return;
  const who = (approverName && String(approverName).trim()) || 'ORDAQA Head';
  await createNotification({
    userId: assigneeUserId,
    title: 'Part V approved by ORDAQA Head',
    message: `Inspection request ${requestNumber}: Part V (Sections 24–25) was approved by ${who}.`,
    type: 'part5_ordaqa_approved',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After ORDAQA Head completes Part III (Section 23), notify each Part II–assigned Inspector / QA Rep.
 */
export async function notifyPart2InspectorsPart3Completed(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  ordaqaHeadName?: string,
  initiatorId?: number | null
): Promise<void> {
  const ids = [
    ...new Set(
      inspectorUserIds
        .map((x) => parseInt(String(x), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (ids.length === 0) return;

  const result = await pool.query(
    `SELECT id FROM users WHERE id = ANY($1::int[]) AND role = 'inspector' AND COALESCE(status, 'active') = 'active'`,
    [ids]
  );
  const validIds = result.rows.map((r: { id: number }) => r.id);
  const who = (ordaqaHeadName && String(ordaqaHeadName).trim()) || 'ORDAQA Head';

  if (validIds.length === 0) {
    await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
      title: 'ORDAQA Part III completed',
      message: `Your inspection request ${requestNumber}: ${who} completed Part III (Section 23).`,
      type: 'part3_completed',
      sendEmail: true,
    });
    return;
  }

  await createBulkNotifications(validIds, {
    title: `Part III completed by ${who}`,
    message: `Inspection request ${requestNumber}: ORDAQA Head completed Part III (Section 23). Complete Part IV (R&QA inspection report) when ready.`,
    type: 'part3_completed',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });

  if (initiatorId != null && Number(initiatorId) > 0) {
    const names = await lookupUserNames(validIds);
    await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
      title: 'ORDAQA Part III completed',
      message: `Your inspection request ${requestNumber}: ${who} completed Part III. ${names} notified to complete Part IV.`,
      type: 'part3_completed',
      sendEmail: true,
    });
  }
}

/**
 * After Part II — Team Head assigns Inspector(s) / QA Rep(s), notify each assigned active `inspector` user.
 */
export async function notifyInspectorsAssignedPart2(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  initiatorId?: number | null,
  teamHeadName?: string
): Promise<void> {
  const ids = normalizePositiveIds(inspectorUserIds);
  if (ids.length === 0) return;

  const result = await pool.query(
    `SELECT id FROM users WHERE id = ANY($1::int[]) AND role = 'inspector' AND COALESCE(status, 'active') = 'active'`,
    [ids]
  );
  const validIds = result.rows.map((r: { id: number }) => r.id);
  if (validIds.length === 0) return;

  const teamHead = (teamHeadName && String(teamHeadName).trim()) || 'Team Head – QA';

  await createBulkNotifications(validIds, {
    title: `Assigned as Inspector / QA Rep by ${teamHead}`,
    message: `Inspection request ${requestNumber}: You were assigned on Part II. Complete inspector Part II Outstation inspection details and part-4.`,
    type: 'part2_inspector_assigned',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });

  if (initiatorId != null && Number(initiatorId) > 0) {
    const names = await lookupUserNames(validIds);
    await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
      title: 'Inspector(s) assigned',
      message: `Your inspection request ${requestNumber}: ${names} assigned as Inspector / QA Rep.`,
      type: 'part2_inspector_assigned',
      sendEmail: true,
    });
  }
}

/**
 * When Team Head replaces / updates Part II Inspector(s), notify removed, newly assigned, and initiator
 * with explicit "X has been replaced with Y" wording.
 */
export async function notifyInspectorsReassignedPart2(
  requestId: number,
  requestNumber: string,
  previousInspectorIds: unknown[],
  nextInspectorIds: unknown[],
  initiatorId?: number | null,
  teamHeadName?: string
): Promise<void> {
  const previousIds = normalizePositiveIds(previousInspectorIds);
  const nextIds = normalizePositiveIds(nextInspectorIds);
  if (sameIdSet(previousIds, nextIds)) return;

  const previousSet = new Set(previousIds);
  const nextSet = new Set(nextIds);
  const removedIds = previousIds.filter((id) => !nextSet.has(id));
  const addedIds = nextIds.filter((id) => !previousSet.has(id));

  const teamHead = (teamHeadName && String(teamHeadName).trim()) || 'Team Head – QA';
  const [removedNames, addedNames, nextNames] = await Promise.all([
    lookupUserNames(removedIds),
    lookupUserNames(addedIds),
    lookupUserNames(nextIds),
  ]);

  const replacementSummary =
    removedIds.length > 0 && addedIds.length > 0
      ? `${removedNames} ${removedIds.length > 1 ? 'have' : 'has'} been replaced with ${addedNames}`
      : removedIds.length > 0
        ? `${removedNames} ${removedIds.length > 1 ? 'have' : 'has'} been unassigned; current Inspector / QA Rep: ${nextNames}`
        : `${addedNames} ${addedIds.length > 1 ? 'have' : 'has'} been assigned as Inspector / QA Rep (in addition to existing)`;

  if (removedIds.length > 0) {
    const removedMessage =
      addedIds.length > 0
        ? `Inspection request ${requestNumber}: You have been replaced with ${addedNames} by ${teamHead}.`
        : `Inspection request ${requestNumber}: You have been unassigned as Inspector / QA Rep by ${teamHead}. Current assignee(s): ${nextNames}.`;

    await createBulkNotifications(removedIds, {
      title: 'Inspector / QA Rep replaced',
      message: removedMessage,
      type: 'part2_inspector_replaced',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  if (addedIds.length > 0) {
    const activeAdded = await pool.query(
      `SELECT id FROM users WHERE id = ANY($1::int[]) AND role = 'inspector' AND COALESCE(status, 'active') = 'active'`,
      [addedIds]
    );
    const validAddedIds = activeAdded.rows.map((r: { id: number }) => r.id);
    if (validAddedIds.length > 0) {
      const addedMessage =
        removedIds.length > 0
          ? `Inspection request ${requestNumber}: ${removedNames} ${removedIds.length > 1 ? 'have' : 'has'} been replaced with you. Complete inspector Part II Outstation inspection details and part-4.`
          : `Inspection request ${requestNumber}: You were assigned on Part II by ${teamHead}. Complete inspector Part II Outstation inspection details and part-4.`;

      await createBulkNotifications(validAddedIds, {
        title:
          removedIds.length > 0
            ? `Assigned as Inspector / QA Rep (replacement) by ${teamHead}`
            : `Assigned as Inspector / QA Rep by ${teamHead}`,
        message: addedMessage,
        type: removedIds.length > 0 ? 'part2_inspector_replaced' : 'part2_inspector_assigned',
        entityType: 'inspection_request',
        entityId: requestId,
        sendEmail: true,
      });
    }
  }

  if (initiatorId != null && Number(initiatorId) > 0) {
    await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
      title:
        removedIds.length > 0 && addedIds.length > 0
          ? 'Inspector / QA Rep replaced'
          : 'Inspector assignment updated',
      message: `Your inspection request ${requestNumber}: ${replacementSummary}.`,
      type: 'part2_inspector_replaced',
      sendEmail: true,
    });
  }
}

/** Context from `inspection_requests` row when Part IV is saved (before/after update — IDs unchanged). */
export interface Part4SavedStakeholderContext {
  initiator_id: number | null;
  nominated_team_head_id: number | null;
  inspector_id: number | null;
  inspector_ids_raw: string | null;
  forwarded_to_ordaqa: boolean;
  ordaqa_inspector_id: number | null;
}

/**
 * After Part IV — R&QA Inspection Report is saved, notify initiator and other assigned inspectors.
 * Team Head – QA gets a dedicated pending-approval notification (see notifyTeamHeadPart4PendingApproval).
 * Excludes the user who saved Part IV.
 */
export async function notifyStakeholdersPart4Saved(
  requestId: number,
  requestNumber: string,
  savedByUserId: number,
  ctx: Part4SavedStakeholderContext
): Promise<void> {
  const exclude = savedByUserId;
  const recipientIds = new Set<number>();

  const add = (uid: unknown) => {
    const n = uid != null ? Number(uid) : NaN;
    if (Number.isFinite(n) && n > 0 && n !== exclude) recipientIds.add(n);
  };

  add(ctx.initiator_id);
  add(ctx.inspector_id);

  if (ctx.inspector_ids_raw) {
    try {
      const arr = JSON.parse(ctx.inspector_ids_raw);
      if (Array.isArray(arr)) arr.forEach((x: unknown) => add(x));
    } catch {
      /* ignore */
    }
  }

  if (recipientIds.size === 0) return;

  await createBulkNotifications(Array.from(recipientIds), {
    title: 'Part IV — R&QA Inspection report submitted',
    message: `Inspection request ${requestNumber}: Part IV (CABS R&QA Inspection Report) has been submitted and is awaiting Team Head – QA approval.`,
    type: 'part4_saved',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After Part IV is submitted — notify nominated Team Head – QA (or all R&QA Team Heads on skip-path).
 */
export async function notifyTeamHeadPart4PendingApproval(
  requestId: number,
  requestNumber: string,
  nominatedTeamHeadId: number | null | undefined,
  skipsPart2Part3: boolean
): Promise<void> {
  const recipientIds = new Set<number>();

  if (skipsPart2Part3) {
    const { listActiveRqaTeamHeadUserIds } = await import('@/lib/rqa-users');
    for (const id of await listActiveRqaTeamHeadUserIds()) recipientIds.add(id);
  } else if (nominatedTeamHeadId != null && Number(nominatedTeamHeadId) > 0) {
    recipientIds.add(Number(nominatedTeamHeadId));
  }

  if (recipientIds.size === 0) return;

  await createBulkNotifications(Array.from(recipientIds), {
    title: 'Part IV pending your approval',
    message: `Inspection request ${requestNumber}: Part IV (R&QA Inspection Report) was submitted and awaits your Approve or Reject (with comments).`,
    type: 'part4_pending_team_head_approval',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After Team Head – QA rejects Part IV — notify the inspector(s) who must revise and resubmit.
 */
export async function notifyInspectorsPart4Rejected(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  teamHeadName: string,
  commentSnippet: string
): Promise<void> {
  const ids = [
    ...new Set(
      inspectorUserIds
        .map((x) => parseInt(String(x), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (ids.length === 0) return;

  const who = (teamHeadName && String(teamHeadName).trim()) || 'Team Head – QA';
  const snippet =
    commentSnippet.length > 200 ? `${commentSnippet.slice(0, 200)}…` : commentSnippet;

  await createBulkNotifications(ids, {
    title: 'Part IV rejected — revise and resubmit',
    message: `Inspection request ${requestNumber}: ${who} rejected Part IV. Comments: ${snippet}`,
    type: 'part4_team_head_rejected',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After Team Head – QA approves Part IV — notify inspector(s).
 */
export async function notifyInspectorsPart4Approved(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  teamHeadName?: string
): Promise<void> {
  const ids = [
    ...new Set(
      inspectorUserIds
        .map((x) => parseInt(String(x), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  if (ids.length === 0) return;

  const who = (teamHeadName && String(teamHeadName).trim()) || 'Team Head – QA';

  await createBulkNotifications(ids, {
    title: 'Part IV approved by Team Head – QA',
    message: `Inspection request ${requestNumber}: Part IV was approved by ${who}. You may proceed with the next workflow step.`,
    type: 'part4_team_head_approved',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After Part IV is saved on an ORDAQA-forwarded IR — notify the ORDAQA assignee to complete Part V.
 */
export async function notifyOrdaqaAssigneePart4ForwardedForPart5(
  requestId: number,
  requestNumber: string,
  ordaqaAssigneeUserId: number | null | undefined,
  part4InspectorName?: string
): Promise<void> {
  if (!ordaqaAssigneeUserId || ordaqaAssigneeUserId < 1) return;
  const who = (part4InspectorName && String(part4InspectorName).trim()) || 'The assigned inspector';
  await createNotification({
    userId: ordaqaAssigneeUserId,
    title: 'Part IV complete — fill Part V',
    message: `Inspection request ${requestNumber}: ${who} has completed Part IV and forwarded the IR to you. Please fill Part V (Sections 24–25).`,
    type: 'part4_forwarded_for_part5',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

export async function notifyOverdueInspection(
  requestId: number,
  requestNumber: string,
  dueDate: Date
): Promise<void> {
  // Get all stakeholders
  const result = await pool.query(
    `SELECT initiator_id, inspector_id, approver_id 
     FROM inspection_requests 
     WHERE id = $1`,
    [requestId]
  );

  if (result.rows.length === 0) return;

  const { initiator_id, inspector_id, approver_id } = result.rows[0];
  const stakeholderIds = new Set([initiator_id, inspector_id, approver_id].filter(Boolean) as number[]);

  // Also include administrators (deduplicated)
  const adminResult = await pool.query(
    `SELECT id FROM users WHERE role = 'administrator' AND status = 'active'`
  );
  adminResult.rows.forEach((row) => stakeholderIds.add(row.id));

  await createBulkNotifications(Array.from(stakeholderIds), {
    title: 'Overdue Inspection Alert',
    message: `Inspection request ${requestNumber} is overdue. Due date was ${dueDate.toLocaleDateString()}.`,
    type: 'overdue_alert',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * Notify about inspection closure
 */
export async function notifyInspectionClosed(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  inspectorId?: number,
  approverId?: number
): Promise<void> {
  const userIds = [initiatorId];
  if (inspectorId) userIds.push(inspectorId);
  if (approverId) userIds.push(approverId);

  await createBulkNotifications(userIds, {
    title: 'Inspection Closed',
    message: `Inspection request ${requestNumber} has been officially closed.`,
    type: 'request_closed',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * Send email notification (placeholder for actual email implementation)
 */
async function sendEmailNotification(payload: {
  userId: number;
  title: string;
  message: string;
  type: NotificationType;
}): Promise<void> {
  // Get user email
  const result = await pool.query(`SELECT email, name FROM users WHERE id = $1`, [payload.userId]);

  if (result.rows.length === 0) return;

  const { email, name } = result.rows[0];

  // TODO: Implement actual email sending using a service like SendGrid, AWS SES, etc.
  console.log('Email notification would be sent:', {
    to: email,
    name,
    subject: payload.title,
    body: payload.message,
    type: payload.type,
  });

  // Update notification to mark email as sent
  await pool.query(
    `UPDATE notifications 
     SET email_sent_at = CURRENT_TIMESTAMP 
     WHERE user_id = $1 
     AND title = $2 
     AND sent_via_email = true 
     AND email_sent_at IS NULL`,
    [payload.userId, payload.title]
  );
}

/**
 * Check for overdue inspections and send alerts
 */
export async function checkOverdueInspections(): Promise<void> {
  const result = await pool.query(
    `SELECT id, request_number, due_date
     FROM inspection_requests
     WHERE status IN ('pending', 'assigned', 'in_progress')
     AND due_date < CURRENT_DATE
     AND id NOT IN (
       SELECT DISTINCT entity_id 
       FROM notifications 
       WHERE entity_type = 'inspection_request' 
       AND type = 'overdue_alert'
       AND created_at > CURRENT_DATE - INTERVAL '24 hours'
     )`
  );

  for (const row of result.rows) {
    await notifyOverdueInspection(row.id, row.request_number, new Date(row.due_date));
  }
}

