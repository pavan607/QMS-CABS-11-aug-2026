import pool from './db';
import { normalizeEmployeeId } from './employee-id';
import { PART1_APPROVER_EMPLOYEE_ID } from './part1-approver';
import { parseInspectorIds } from './inspector-ids';


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
  | 'request_updated'
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
  | 'part2_inspector_rejected'
  | 'part2_inspector_send_back'
  | 'part4_saved'
  | 'part4_pending_team_head_approval'
  | 'part4_team_head_rejected'
  | 'part4_team_head_approved'
  | 'part4_forwarded_for_part5'
  | 'part3_completed'
  | 'ordaqa_delegated_to_rqa'
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

  const stakeholderIds = await collectIrStakeholderIds(requestId, null, [
    initiatorId,
    ...userIds,
  ]);
  const broadcastIds = stakeholderIds.filter((id) => !userIds.includes(id));
  if (broadcastIds.length > 0) {
    await createBulkNotifications(broadcastIds, {
      title: 'Inspection request submitted',
      message: `Inspection request ${requestNumber} was submitted${by} and is awaiting Request Approver forward.`,
      type: 'request_submitted',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }
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
      title: 'IR awaiting pending forward to QA Head',
      message: `Inspection request ${requestNumber} was forwarded by ${by} and is awaiting pending forward to QA Head.${commentNote}`,
      type: 'request_submitted',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  await notifyInitiatorIrMilestone(initiatorId, requestId, requestNumber, {
    title: 'Awaiting pending forward to QA Head',
    message: `Your inspection request ${requestNumber} was forwarded by ${by} and is awaiting pending forward to QA Head.`,
    type: 'request_submitted',
    sendEmail: true,
  });

  await notifyIrStakeholders(
    requestId,
    {
      title: 'IR forwarded — awaiting pending forward to QA Head',
      message: `Inspection request ${requestNumber} was forwarded by ${by} and is awaiting pending forward to QA Head.${commentNote}`,
      type: 'request_submitted',
    },
    {
      extraUserIds: initiatorId != null ? [initiatorId] : [],
      excludeUserId: initiatorId ?? r.rows[0]?.id ?? null,
    }
  );
}

/**
 * Notify about inspection request assignment — assigned inspector (action) + all stakeholders.
 */
export async function notifyInspectionRequestAssigned(
  requestId: number,
  requestNumber: string,
  inspectorId: number,
  initiatorId: number,
  excludeUserId?: number | null
): Promise<void> {
  await createNotification({
    userId: inspectorId,
    title: 'Inspection Request Assigned',
    message: `Inspection request ${requestNumber} has been assigned to you.`,
    type: 'request_assigned',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });

  const stakeholderIds = await collectIrStakeholderIds(requestId, excludeUserId, [
    initiatorId,
    inspectorId,
  ]);
  const broadcastIds = stakeholderIds.filter((id) => id !== inspectorId);
  if (broadcastIds.length > 0) {
    await createBulkNotifications(broadcastIds, {
      title: 'Inspection Request Assigned',
      message: `Inspection request ${requestNumber} has been assigned to an inspector.`,
      type: 'request_assigned',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }
}

/**
 * Notify about inspection completion — action to Team Head + broadcast to all IR stakeholders.
 */
export async function notifyInspectionCompleted(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  approverId?: number,
  nominatedTeamHeadId?: number | null,
  options?: { skipPart2Part3?: boolean; excludeUserId?: number | null }
): Promise<void> {
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
  } else {
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
    }
  }

  await notifyIrStakeholders(
    requestId,
    {
      title: 'Inspection Completed',
      message: `Inspection ${requestNumber} has been completed and is awaiting Team Head – QA Approve & Close.`,
      type: 'inspection_completed',
    },
    {
      excludeUserId: options?.excludeUserId,
      extraUserIds: [initiatorId, approverId, nominatedTeamHeadId].filter(Boolean),
    }
  );
}

/**
 * Notify about inspection approval — all IR stakeholders.
 */
export async function notifyInspectionApproved(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  inspectorId?: number,
  excludeUserId?: number | null
): Promise<void> {
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Inspection Approved',
      message: `Inspection request ${requestNumber} has been approved.`,
      type: 'request_approved',
    },
    {
      excludeUserId,
      extraUserIds: [initiatorId, inspectorId].filter(Boolean),
    }
  );
}

/**
 * Notify about inspection rejection — all IR stakeholders.
 */
export async function notifyInspectionRejected(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  inspectorId?: number,
  reason?: string,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const message = reason
    ? `Inspection request ${requestNumber} has been rejected. Reason: ${reason}`
    : `Inspection request ${requestNumber} has been rejected.`;

  await notifyIrStakeholders(
    requestId,
    {
      title: 'Inspection Rejected',
      message,
      type: 'request_rejected',
    },
    {
      excludeUserId,
      extraUserIds: [initiatorId, inspectorId, ...extraUserIds].filter(Boolean),
    }
  );
}

/**
 * Notify about overdue inspection
 */
/**
 * QA Head returned IR to designer (Section 22) — notify all IR stakeholders.
 */
export async function notifyReturnedToDesignerByQaHead(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  requestApproverId: number | null,
  nominatedTeamHeadQaId: number | null,
  returnComments: string,
  qaHeadActorName: string,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const snippet =
    returnComments.length > 200 ? `${returnComments.slice(0, 200)}…` : returnComments;
  const message = `Inspection request ${requestNumber} was returned to the designer/initiator by ${qaHeadActorName}. Comments: ${snippet}`;

  await notifyIrStakeholders(
    requestId,
    {
      title: 'Inspection request returned to designer',
      message,
      type: 'returned_to_designer',
    },
    {
      excludeUserId,
      extraUserIds: [initiatorId, requestApproverId, nominatedTeamHeadQaId, ...extraUserIds].filter(
        Boolean
      ),
    }
  );
}

/**
 * Nominated Team Head – QA sent the IR back to initiator/designer — all IR stakeholders.
 */
export async function notifyQaApproverSendBack(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  requestApproverId: number | null,
  returnComments: string,
  actorName: string,
  target: 'initiator' | 'designer',
  inspectorUserIds: number[],
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const snippet =
    returnComments.length > 200 ? `${returnComments.slice(0, 200)}…` : returnComments;
  const audience =
    target === 'designer'
      ? 'the designer (update Part I as applicable)'
      : 'the initiator (Part I account holder)';
  const message = `Inspection request ${requestNumber} was sent back by Team Head – QA ${actorName} for ${audience}. Comments: ${snippet}`;

  const title =
    target === 'designer'
      ? 'IR sent back — designer / Part I'
      : 'IR sent back — initiator';

  await notifyIrStakeholders(
    requestId,
    { title, message, type: 'returned_to_designer' },
    {
      excludeUserId,
      extraUserIds: [initiatorId, requestApproverId, ...inspectorUserIds, ...extraUserIds].filter(
        Boolean
      ),
    }
  );
}

/**
 * Assigned ORDAQA person sent the IR back for Part I corrections — all IR stakeholders.
 */
export async function notifyOrdaqaInspectorSendBack(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  requestApproverId: number | null,
  returnComments: string,
  actorName: string,
  target: 'initiator' | 'designer',
  inspectorUserIds: number[],
  excludeUserId?: number | null
): Promise<void> {
  const snippet =
    returnComments.length > 200 ? `${returnComments.slice(0, 200)}…` : returnComments;
  const audience =
    target === 'designer'
      ? 'the designer (update Part I as applicable)'
      : 'the initiator (Part I account holder)';
  const message = `Inspection request ${requestNumber} was sent back by ORDAQA assignee ${actorName} for ${audience}. Comments: ${snippet}`;

  const title =
    target === 'designer'
      ? 'IR sent back — designer / Part I (ORDAQA)'
      : 'IR sent back — initiator (ORDAQA)';

  await notifyIrStakeholders(
    requestId,
    { title, message, type: 'returned_to_designer' },
    {
      excludeUserId,
      extraUserIds: [initiatorId, requestApproverId, ...inspectorUserIds].filter(Boolean),
    }
  );
}

/** After initiator resubmits an IR that had previously been in the QA pipeline — all stakeholders. */
export async function notifyQaHeadsResubmittedAfterReturn(
  requestId: number,
  requestNumber: string,
  excludeUserId?: number | null
): Promise<void> {
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Inspection request resubmitted',
      message: `Inspection request ${requestNumber} was updated by the initiator and submitted again for Request Approver forward, then QA Head (Part II).`,
      type: 'ir_resubmitted_after_return',
    },
    { excludeUserId }
  );
}

/**
 * After Part I is approved (status → `request_approved`) — notify all IR stakeholders (incl. QA Heads).
 */
export async function notifyQaHeadsAfterRequestApproverForward(
  requestId: number,
  requestNumber: string,
  forwardedByName: string,
  initiatorId?: number | null,
  forwardComment?: string | null,
  excludeUserId?: number | null
): Promise<void> {
  const by = forwardedByName.trim() || 'Request Approver';
  const commentNote =
    forwardComment?.trim()
      ? ` Comment: ${forwardComment.trim()}`
      : '';

  await notifyIrStakeholders(
    requestId,
    {
      title: 'IR forwarded to QA Head',
      message: `Inspection request ${requestNumber} was forwarded by ${by}. Complete Part II (QA Head) when ready.${commentNote}`,
      type: 'forwarded_to_qa_head',
    },
    {
      excludeUserId,
      extraUserIds: initiatorId != null ? [initiatorId] : [],
    }
  );
}

/**
 * After QA Head forwards to ORDAQA — notify all IR stakeholders (incl. ORDAQA Heads).
 */
export async function notifyOrdaqaHeadsForwardedToOrdaqa(
  requestId: number,
  requestNumber: string,
  initiatorId?: number | null,
  excludeUserId?: number | null
): Promise<void> {
  await notifyIrStakeholders(
    requestId,
    {
      title: 'IR forwarded to ORDAQA',
      message: `Inspection request ${requestNumber} was forwarded to ORDAQA for joint inspection. Part III (Section 23) will be available after Outstation details (if enabled) are completed.`,
      type: 'forwarded_to_ordaqa',
    },
    {
      excludeUserId,
      extraUserIds: initiatorId != null ? [initiatorId] : [],
    }
  );
}

/**
 * After ORDAQA Head marks Memo to be Returned — notify every stakeholder involved in the IR.
 */
export async function notifyQaHeadsMemoReturnedFromOrdaqa(
  requestId: number,
  requestNumber: string,
  ordaqaHeadName: string,
  initiatorId?: number | null,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const by = ordaqaHeadName.trim() || 'ORDAQA Head';

  await notifyIrStakeholders(
    requestId,
    {
      title: 'Memo returned to QA Head',
      message: `Inspection request ${requestNumber}: ${by} marked Memo to be Returned as Yes in Part III (Section 23). The request has been returned to QA Head for Part II review.`,
      type: 'memo_returned_to_qa_head',
    },
    {
      excludeUserId,
      extraUserIds: [initiatorId, ...extraUserIds],
    }
  );
}

/**
 * After QA Head nominates Team Head – QA — action notify to nominee + broadcast to all stakeholders.
 */
export async function notifyNominatedTeamHeadQaPart2(
  requestId: number,
  requestNumber: string,
  nominatedTeamHeadUserId: number,
  nominatorName?: string,
  initiatorId?: number | null,
  excludeUserId?: number | null
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

  await notifyIrStakeholders(
    requestId,
    {
      title: 'Team Head – QA nominated',
      message: `Inspection request ${requestNumber}: ${who} nominated ${teamHeadName} as Team Head – QA. Inspector(s) will be assigned next.`,
      type: 'team_head_qa_nominated',
    },
    {
      excludeUserId: excludeUserId ?? nominatedTeamHeadUserId,
      extraUserIds: initiatorId != null ? [initiatorId] : [],
    }
  );
}

/**
 * After assignee saves Part V — notify IR stakeholders except ORDAQA Inspectors
 * (this is an ORDAQA Head action, not an inspector action).
 */
export async function notifyOrdaqaHeadsPart5PendingApproval(
  requestId: number,
  requestNumber: string,
  excludeUserId?: number | null
): Promise<void> {
  const ids = await collectIrStakeholderIds(requestId, excludeUserId);
  if (ids.length === 0) return;

  const inspectorRows = await pool.query(
    `SELECT id FROM users
     WHERE id = ANY($1::int[])
       AND role = 'ordaqa_inspector'`,
    [ids]
  );
  const inspectorSet = new Set(
    inspectorRows.rows.map((r: { id: number }) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0)
  );
  const recipients = ids.filter((id) => !inspectorSet.has(id));
  if (recipients.length === 0) return;

  await createBulkNotifications(recipients, {
    title: 'Part V pending ORDAQA Head approval',
    message: `Inspection request ${requestNumber}: Part V (Sections 24–25) was submitted and awaits ORDAQA Head approval.`,
    type: 'part5_pending_ordaqa_approval',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After ORDAQA Head approves Part V — notify Team Head – QA (action) + all IR stakeholders.
 */
export async function notifyTeamHeadPart5ApprovedForInspection(
  requestId: number,
  requestNumber: string,
  nominatedTeamHeadId: number | null | undefined,
  skipsPart2Part3: boolean,
  ordaqaHeadName?: string,
  excludeUserId?: number | null
): Promise<void> {
  const recipientIds = new Set<number>();

  if (skipsPart2Part3) {
    const { listActiveRqaTeamHeadUserIds } = await import('@/lib/rqa-users');
    for (const id of await listActiveRqaTeamHeadUserIds()) recipientIds.add(id);
  } else if (nominatedTeamHeadId != null && Number(nominatedTeamHeadId) > 0) {
    recipientIds.add(Number(nominatedTeamHeadId));
  }

  const who = (ordaqaHeadName && String(ordaqaHeadName).trim()) || 'ORDAQA Head';

  if (recipientIds.size > 0) {
    await createBulkNotifications(Array.from(recipientIds), {
      title: 'ORDAQA Head approved Part V',
      message: `Inspection request ${requestNumber}: ${who} has approved Part V. The IR is ready for your review.`,
      type: 'part5_approved_start_inspection',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  const stakeholderIds = await collectIrStakeholderIds(
    requestId,
    excludeUserId,
    Array.from(recipientIds)
  );
  const broadcastIds = stakeholderIds.filter((id) => !recipientIds.has(id));
  if (broadcastIds.length > 0) {
    await createBulkNotifications(broadcastIds, {
      title: 'ORDAQA Head approved Part V',
      message: `Inspection request ${requestNumber}: ${who} has approved Part V.`,
      type: 'part5_approved_start_inspection',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }
}

/**
 * After ORDAQA Head sends Part V back — notify assignee (action) + all IR stakeholders.
 */
export async function notifyOrdaqaAssigneePart5SentBack(
  requestId: number,
  requestNumber: string,
  assigneeUserId: number | null | undefined,
  headName: string,
  commentSnippet: string,
  excludeUserId?: number | null
): Promise<void> {
  const who = (headName && String(headName).trim()) || 'ORDAQA Head';
  const snippet =
    commentSnippet.length > 200 ? `${commentSnippet.slice(0, 200)}…` : commentSnippet;
  const message = `Inspection request ${requestNumber}: ${who} sent back Part V (Sections 24–25) for revision. Comments: ${snippet}`;

  if (assigneeUserId && assigneeUserId > 0) {
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

  await notifyIrStakeholders(
    requestId,
    {
      title: 'Part V sent back for revision',
      message,
      type: 'part5_head_send_back',
    },
    {
      excludeUserId: excludeUserId ?? assigneeUserId,
      extraUserIds: assigneeUserId ? [assigneeUserId] : [],
    }
  );
}

/**
 * After ORDAQA Head approves Part V — notify all IR stakeholders.
 */
export async function notifyOrdaqaAssigneePart5Approved(
  requestId: number,
  requestNumber: string,
  assigneeUserId: number | null | undefined,
  approverName?: string,
  excludeUserId?: number | null
): Promise<void> {
  const who = (approverName && String(approverName).trim()) || 'ORDAQA Head';
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Part V approved by ORDAQA Head',
      message: `Inspection request ${requestNumber}: Part V (Sections 24–25) was approved by ${who}.`,
      type: 'part5_ordaqa_approved',
    },
    {
      excludeUserId,
      extraUserIds: assigneeUserId ? [assigneeUserId] : [],
    }
  );
}

/**
 * After ORDAQA Head completes Part III (Section 23) — notify all IR stakeholders.
 */
export async function notifyPart2InspectorsPart3Completed(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  ordaqaHeadName?: string,
  initiatorId?: number | null,
  excludeUserId?: number | null
): Promise<void> {
  const who = (ordaqaHeadName && String(ordaqaHeadName).trim()) || 'ORDAQA Head';
  await notifyIrStakeholders(
    requestId,
    {
      title: `Part III completed by ${who}`,
      message: `Inspection request ${requestNumber}: ORDAQA Head completed Part III (Section 23). Assigned R&QA Inspector(s) may complete Part IV when ready.`,
      type: 'part3_completed',
    },
    {
      excludeUserId,
      extraUserIds: [...normalizePositiveIds(inspectorUserIds), initiatorId].filter(Boolean),
    }
  );
}

/**
 * When ORDAQA Head delegates Part III / Part V work to an R&QA Inspector (or QA Rep),
 * notify all IR stakeholders (initiator, certifier, Team Head, Part II inspectors, assignee, etc.).
 */
export async function notifyStakeholdersOrdaqaDelegatedToRqa(params: {
  requestId: number;
  requestNumber: string;
  delegatedToUserId: number;
  delegatedToName?: string;
  ordaqaHeadName?: string;
  excludeUserId?: number;
  stakeholderIds?: number[];
}): Promise<void> {
  const {
    requestId,
    requestNumber,
    delegatedToUserId,
    delegatedToName,
    ordaqaHeadName,
    excludeUserId,
    stakeholderIds = [],
  } = params;

  const who = (ordaqaHeadName && String(ordaqaHeadName).trim()) || 'ORDAQA Head';
  const toName =
    (delegatedToName && String(delegatedToName).trim()) || 'R&QA Inspector';
  const exclude = excludeUserId != null ? Number(excludeUserId) : NaN;

  const recipientIds = new Set<number>();
  const add = (uid: unknown) => {
    const n = uid != null ? Number(uid) : NaN;
    if (Number.isFinite(n) && n > 0 && n !== exclude) recipientIds.add(n);
  };

  for (const id of stakeholderIds) add(id);
  add(delegatedToUserId);

  // Ensure core IR roles from DB are included even if stakeholder list was incomplete
  const irRes = await pool.query(
    `SELECT initiator_id, request_approver_id, nominated_request_approver_id,
            nominated_team_head_id, qa_approver_id, part1_approved_by,
            inspector_id, inspector_ids, ordaqa_inspector_id
     FROM inspection_requests WHERE id = $1`,
    [requestId]
  );
  const row = irRes.rows[0] as
    | {
        initiator_id?: number | null;
        request_approver_id?: number | null;
        nominated_request_approver_id?: number | null;
        nominated_team_head_id?: number | null;
        qa_approver_id?: number | null;
        part1_approved_by?: number | null;
        inspector_id?: number | null;
        inspector_ids?: unknown;
        ordaqa_inspector_id?: number | null;
      }
    | undefined;
  if (row) {
    add(row.initiator_id);
    add(row.request_approver_id);
    add(row.nominated_request_approver_id);
    add(row.nominated_team_head_id);
    add(row.qa_approver_id);
    add(row.part1_approved_by);
    add(row.inspector_id);
    add(row.ordaqa_inspector_id);
    try {
      const raw = row.inspector_ids;
      const arr =
        typeof raw === 'string'
          ? JSON.parse(raw || '[]')
          : Array.isArray(raw)
            ? raw
            : [];
      if (Array.isArray(arr)) arr.forEach((x) => add(x));
    } catch {
      /* ignore */
    }
  }

  if (recipientIds.size === 0) return;

  await createBulkNotifications(Array.from(recipientIds), {
    title: 'ORDAQA delegated to R&QA Inspector',
    message: `Inspection request ${requestNumber}: ${who} delegated inspection to ${toName} (R&QA). Sections 24–25 will be completed in Part V after Part IV.`,
    type: 'ordaqa_delegated_to_rqa',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });
}

/**
 * After Part II — Team Head assigns Inspector(s) / QA Rep(s).
 * Action notify to assigned inspectors + broadcast to all other IR stakeholders.
 */
export async function notifyInspectorsAssignedPart2(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  initiatorId?: number | null,
  teamHeadName?: string,
  outstationEnabled?: boolean,
  excludeUserId?: number | null
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
  const nextSteps = outstationEnabled
    ? 'Complete Part II Outstation details (Email Sent, Name & Sign, Date & Time), then Part IV when ready.'
    : 'Complete Part IV when ready.';
  const names = await lookupUserNames(validIds);

  await createBulkNotifications(validIds, {
    title: `Assigned as Inspector / QA Rep by ${teamHead}`,
    message: `Inspection request ${requestNumber}: You were assigned on Part II. ${nextSteps}`,
    type: 'part2_inspector_assigned',
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: true,
  });

  const stakeholderIds = await collectIrStakeholderIds(requestId, excludeUserId, [
    initiatorId,
    ...validIds,
  ]);
  const broadcastIds = stakeholderIds.filter((id) => !validIds.includes(id));
  if (broadcastIds.length > 0) {
    await createBulkNotifications(broadcastIds, {
      title: 'Inspector(s) assigned',
      message: `Inspection request ${requestNumber}: ${names} assigned as Inspector / QA Rep by ${teamHead}.`,
      type: 'part2_inspector_assigned',
      entityType: 'inspection_request',
      entityId: requestId,
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
  teamHeadName?: string,
  outstationEnabled?: boolean
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
      const nextSteps = outstationEnabled
        ? 'Complete Part II Outstation details (Email Sent, Name & Sign, Date & Time), then Part IV when ready.'
        : 'Complete Part IV when ready.';
      const addedMessage =
        removedIds.length > 0
          ? `Inspection request ${requestNumber}: ${removedNames} ${removedIds.length > 1 ? 'have' : 'has'} been replaced with you. ${nextSteps}`
          : `Inspection request ${requestNumber}: You were assigned on Part II by ${teamHead}. ${nextSteps}`;

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

  // Broadcast to all other IR stakeholders (exclude already-notified inspectors + initiator)
  const alreadyNotified = new Set<number>([...removedIds, ...addedIds]);
  if (initiatorId != null && Number(initiatorId) > 0) alreadyNotified.add(Number(initiatorId));
  const stakeholderIds = await collectIrStakeholderIds(requestId, null, [
    ...previousIds,
    ...nextIds,
    initiatorId,
  ]);
  const broadcastIds = stakeholderIds.filter((id) => !alreadyNotified.has(id));
  if (broadcastIds.length > 0) {
    await createBulkNotifications(broadcastIds, {
      title:
        removedIds.length > 0 && addedIds.length > 0
          ? 'Inspector / QA Rep replaced'
          : 'Inspector assignment updated',
      message: `Inspection request ${requestNumber}: ${replacementSummary}.`,
      type: 'part2_inspector_replaced',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }
}

/**
 * Collect user ids involved in an IR (initiator, certifiers, Team Head, inspectors,
 * ORDAQA assignees/approvers, Forward Request user, activity actors, observation
 * chat participants, plus active QA / ORDAQA Heads).
 */
function addPart2InvolvedUserIds(add: (uid: unknown) => void, part2: unknown): void {
  let p: Record<string, unknown> = {};
  if (part2 && typeof part2 === 'object' && !Array.isArray(part2)) {
    p = part2 as Record<string, unknown>;
  } else if (typeof part2 === 'string' && part2.trim()) {
    try {
      const o = JSON.parse(part2);
      if (o && typeof o === 'object' && !Array.isArray(o)) p = o as Record<string, unknown>;
    } catch {
      p = {};
    }
  }
  add(p.inspector_send_back_by);
  add(p.inspector_rejected_by);
  for (const id of parseInspectorIds(p.previous_inspector_ids)) add(id);
  if (Array.isArray(p.return_history)) {
    for (const entry of p.return_history) {
      if (entry && typeof entry === 'object') {
        add((entry as Record<string, unknown>).by_user_id);
      }
    }
  }
}

export async function collectIrStakeholderIds(
  requestId: number,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<number[]> {
  const exclude = excludeUserId != null ? Number(excludeUserId) : NaN;
  const recipientIds = new Set<number>();
  const add = (uid: unknown) => {
    const n = uid != null ? Number(uid) : NaN;
    if (Number.isFinite(n) && n > 0 && n !== exclude) recipientIds.add(n);
  };

  for (const uid of extraUserIds) add(uid);

  const irRes = await pool.query(
    `SELECT initiator_id, request_approver_id, nominated_request_approver_id,
            nominated_team_head_id, qa_approver_id, part1_approved_by,
            inspector_id, inspector_ids, ordaqa_inspector_id, ordaqa_approver_id,
            final_qa_approver_id, approver_id, part2_data, part3_completed_by,
            part4_completed_by
     FROM inspection_requests WHERE id = $1`,
    [requestId]
  );
  const row = irRes.rows[0] as Record<string, unknown> | undefined;
  if (row) {
    add(row.initiator_id);
    add(row.request_approver_id);
    add(row.nominated_request_approver_id);
    add(row.nominated_team_head_id);
    add(row.qa_approver_id);
    add(row.part1_approved_by);
    add(row.inspector_id);
    add(row.ordaqa_inspector_id);
    add(row.ordaqa_approver_id);
    add(row.final_qa_approver_id);
    add(row.approver_id);
    add(row.part3_completed_by);
    add(row.part4_completed_by);
    try {
      const raw = row.inspector_ids;
      const arr =
        typeof raw === 'string'
          ? JSON.parse(raw || '[]')
          : Array.isArray(raw)
            ? raw
            : [];
      if (Array.isArray(arr)) arr.forEach((x) => add(x));
    } catch {
      /* ignore */
    }
    addPart2InvolvedUserIds(add, row.part2_data);
  }

  // Forward Request (Part I Approver) by known employee id — always include 1021
  try {
    const part1Emp = normalizeEmployeeId(PART1_APPROVER_EMPLOYEE_ID);
    if (part1Emp) {
      const p1 = await pool.query(
        `SELECT id FROM users
         WHERE UPPER(TRIM(COALESCE(employee_id, ''))) = $1
         ORDER BY CASE WHEN COALESCE(status, 'active') = 'active' THEN 0 ELSE 1 END, id
         LIMIT 1`,
        [part1Emp]
      );
      if (p1.rows[0]?.id) add(p1.rows[0].id);
    }
  } catch {
    /* ignore */
  }

  const roleHeads = await pool.query(
    `SELECT id FROM users
     WHERE role IN ('qa_head', 'ordaqa_head')
       AND COALESCE(status, 'active') = 'active'`
  );
  roleHeads.rows.forEach((r: { id: number }) => add(r.id));

  try {
    const actors = await pool.query(
      `SELECT DISTINCT user_id FROM inspection_activities
       WHERE inspection_request_id = $1 AND user_id IS NOT NULL`,
      [requestId]
    );
    actors.rows.forEach((r: { user_id: number }) => add(r.user_id));
  } catch {
    /* ignore */
  }

  try {
    const chatUsers = await pool.query(
      `SELECT DISTINCT x.uid FROM (
         SELECT om.sender_id AS uid
           FROM observation_messages om
           INNER JOIN observation_threads ot ON ot.id = om.thread_id
          WHERE ot.inspection_request_id = $1
         UNION
         SELECT ot.closed_by AS uid
           FROM observation_threads ot
          WHERE ot.inspection_request_id = $1 AND ot.closed_by IS NOT NULL
       ) x`,
      [requestId]
    );
    chatUsers.rows.forEach((r: { uid: number }) => add(r.uid));
  } catch {
    /* ignore */
  }

  return Array.from(recipientIds);
}

/**
 * Notify every stakeholder currently involved in the IR (plus optional extras).
 * Use for approvals, rejections, send-backs, assignments, delegation, etc.
 */
export async function notifyIrStakeholders(
  requestId: number,
  payload: {
    title: string;
    message: string;
    type: NotificationType;
    sendEmail?: boolean;
  },
  options?: {
    excludeUserId?: number | null;
    extraUserIds?: unknown[];
  }
): Promise<void> {
  const ids = await collectIrStakeholderIds(
    requestId,
    options?.excludeUserId,
    options?.extraUserIds || []
  );
  if (ids.length === 0) return;
  await createBulkNotifications(ids, {
    title: payload.title,
    message: payload.message,
    type: payload.type,
    entityType: 'inspection_request',
    entityId: requestId,
    sendEmail: payload.sendEmail ?? true,
  });
}

/**
 * R&QA Inspector rejected the IR — notify all IR stakeholders.
 */
export async function notifyStakeholdersInspectorOutstationRejected(
  requestId: number,
  requestNumber: string,
  inspectorName: string,
  comments: string,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const who = (inspectorName && String(inspectorName).trim()) || 'R&QA Inspector';
  const snippet = comments.length > 200 ? `${comments.slice(0, 200)}…` : comments;
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Inspection Rejected by R&QA Inspector',
      message: `Inspection request ${requestNumber} was rejected by ${who}. Comment: ${snippet}`,
      type: 'part2_inspector_rejected',
    },
    { excludeUserId, extraUserIds }
  );
}

/**
 * R&QA Inspector sent IR back to Team Head – QA — notify all stakeholders.
 */
export async function notifyStakeholdersInspectorOutstationSendBack(
  requestId: number,
  requestNumber: string,
  inspectorName: string,
  comments: string,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const who = (inspectorName && String(inspectorName).trim()) || 'R&QA Inspector';
  const snippet = comments.length > 200 ? `${comments.slice(0, 200)}…` : comments;
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Sent back to Team Head – QA by R&QA Inspector',
      message: `Inspection request ${requestNumber}: ${who} sent the IR back to Team Head – QA. Comment: ${snippet}`,
      type: 'part2_inspector_send_back',
    },
    { excludeUserId, extraUserIds }
  );
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
 * After Part IV — R&QA Inspection Report is saved — notify all IR stakeholders.
 * Team Head – QA also gets a dedicated pending-approval notification (see notifyTeamHeadPart4PendingApproval).
 */
export async function notifyStakeholdersPart4Saved(
  requestId: number,
  requestNumber: string,
  savedByUserId: number,
  _ctx?: Part4SavedStakeholderContext
): Promise<void> {
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Part IV — R&QA Inspection report submitted',
      message: `Inspection request ${requestNumber}: Part IV (CABS R&QA Inspection Report) has been submitted and is awaiting Team Head – QA approval.`,
      type: 'part4_saved',
    },
    { excludeUserId: savedByUserId }
  );
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
 * After Team Head – QA rejects Part IV — notify inspectors (action) + all IR stakeholders.
 */
export async function notifyInspectorsPart4Rejected(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  teamHeadName: string,
  commentSnippet: string,
  excludeUserId?: number | null,
  extraUserIds: unknown[] = []
): Promise<void> {
  const ids = normalizePositiveIds(inspectorUserIds);
  const who = (teamHeadName && String(teamHeadName).trim()) || 'Team Head – QA';
  const snippet =
    commentSnippet.length > 200 ? `${commentSnippet.slice(0, 200)}…` : commentSnippet;

  if (ids.length > 0) {
    await createBulkNotifications(ids, {
      title: 'Part IV sent back — revise and resubmit',
      message: `Inspection request ${requestNumber}: ${who} sent Part IV back for revision. Comments: ${snippet}`,
      type: 'part4_team_head_rejected',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }

  const stakeholderIds = await collectIrStakeholderIds(requestId, excludeUserId, [
    ...ids,
    ...extraUserIds,
  ]);
  const already = new Set(ids);
  if (excludeUserId != null && Number(excludeUserId) > 0) already.add(Number(excludeUserId));
  const broadcastIds = stakeholderIds.filter((id) => !already.has(id));
  if (broadcastIds.length > 0) {
    await createBulkNotifications(broadcastIds, {
      title: 'Part IV sent back by Team Head – QA',
      message: `Inspection request ${requestNumber}: ${who} sent Part IV back for revision. Comments: ${snippet}`,
      type: 'part4_team_head_rejected',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }
}

/**
 * After Team Head – QA approves Part IV — notify all IR stakeholders.
 */
export async function notifyInspectorsPart4Approved(
  requestId: number,
  requestNumber: string,
  inspectorUserIds: unknown[],
  teamHeadName?: string,
  excludeUserId?: number | null
): Promise<void> {
  const who = (teamHeadName && String(teamHeadName).trim()) || 'Team Head – QA';
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Part IV approved by Team Head – QA',
      message: `Inspection request ${requestNumber}: Part IV was approved by ${who}.`,
      type: 'part4_team_head_approved',
    },
    {
      excludeUserId,
      extraUserIds: normalizePositiveIds(inspectorUserIds),
    }
  );
}

/**
 * After Part IV is saved on an ORDAQA-forwarded IR — notify ORDAQA assignee + all stakeholders.
 */
export async function notifyOrdaqaAssigneePart4ForwardedForPart5(
  requestId: number,
  requestNumber: string,
  ordaqaAssigneeUserId: number | null | undefined,
  part4InspectorName?: string,
  excludeUserId?: number | null
): Promise<void> {
  const who = (part4InspectorName && String(part4InspectorName).trim()) || 'The assigned inspector';
  if (ordaqaAssigneeUserId && ordaqaAssigneeUserId > 0) {
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

  const stakeholderIds = await collectIrStakeholderIds(requestId, excludeUserId, [
    ordaqaAssigneeUserId,
  ]);
  const broadcastIds = stakeholderIds.filter(
    (id) => id !== Number(ordaqaAssigneeUserId)
  );
  if (broadcastIds.length > 0) {
    await createBulkNotifications(broadcastIds, {
      title: 'Part IV complete — Part V pending',
      message: `Inspection request ${requestNumber}: ${who} completed Part IV. ORDAQA assignee may now fill Part V (Sections 24–25).`,
      type: 'part4_forwarded_for_part5',
      entityType: 'inspection_request',
      entityId: requestId,
      sendEmail: true,
    });
  }
}

export async function notifyOverdueInspection(
  requestId: number,
  requestNumber: string,
  dueDate: Date
): Promise<void> {
  await notifyIrStakeholders(requestId, {
    title: 'Overdue Inspection Alert',
    message: `Inspection request ${requestNumber} is overdue. Due date was ${dueDate.toLocaleDateString()}.`,
    type: 'overdue_alert',
  });
}

/**
 * Notify about inspection closure — all IR stakeholders.
 */
export async function notifyInspectionClosed(
  requestId: number,
  requestNumber: string,
  initiatorId: number,
  inspectorId?: number,
  approverId?: number,
  excludeUserId?: number | null
): Promise<void> {
  await notifyIrStakeholders(
    requestId,
    {
      title: 'Inspection Closed',
      message: `Inspection request ${requestNumber} has been officially closed.`,
      type: 'request_closed',
    },
    {
      excludeUserId,
      extraUserIds: [initiatorId, inspectorId, approverId].filter(Boolean),
    }
  );
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

