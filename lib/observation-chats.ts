import { query } from '@/lib/db';
import {
  collectInspectorIds,
  sqlInspectionScopeCondition,
  sqlGroupInspectionVisibleCondition,
  isGroupOversightDesignation,
  userCanAccessInspectionRequest,
  userHasGlobalInspectionAccess,
  type InspectionRequestScopeRow,
} from '@/lib/inspection-access';
import type { ObservationPart } from '@/lib/observation-chats-shared';
import {
  generateObservationChatId,
  normalizeRemarkWithChatId,
  OBSERVATION_CHAT_VIEW_ROLES,
  roleCanViewObservationChats,
} from '@/lib/observation-chats-shared';
import { canUserApprovePart4, part4PendingTeamHeadApproval } from '@/lib/inspection-display';

export type { ObservationPart } from '@/lib/observation-chats-shared';
export {
  generateObservationChatId,
  normalizeRemarkWithChatId,
  OBSERVATION_CHAT_VIEW_ROLES,
  roleCanViewObservationChats,
};
export interface ObservationThreadRow {
  id: number;
  inspection_request_id: number;
  part: ObservationPart;
  observation_key: string;
  observation_preview: string | null;
  is_closed: boolean;
  closed_at: string | null;
  closed_by: number | null;
  sent_to_initiator_at: string | null;
  sent_to_initiator_by: number | null;
  created_at: string;
}

export interface ObservationMessageRow {
  id: number;
  thread_id: number;
  sender_id: number;
  sender_name?: string;
  message: string;
  attachment_file_name?: string | null;
  attachment_file_path?: string | null;
  attachment_file_type?: string | null;
  attachment_file_size?: number | null;
  created_at: string;
}

export type ObservationMessageAttachment = {
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
};

let tablesEnsured = false;

export async function ensureObservationChatTables(): Promise<void> {
  if (tablesEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS observation_threads (
      id SERIAL PRIMARY KEY,
      inspection_request_id INTEGER NOT NULL REFERENCES inspection_requests(id) ON DELETE CASCADE,
      part VARCHAR(10) NOT NULL CHECK (part IN ('part4', 'part5')),
      observation_key VARCHAR(64) NOT NULL,
      observation_preview TEXT,
      is_closed BOOLEAN NOT NULL DEFAULT false,
      closed_at TIMESTAMP,
      closed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (observation_key)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS observation_messages (
      id SERIAL PRIMARY KEY,
      thread_id INTEGER NOT NULL REFERENCES observation_threads(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_observation_threads_ir ON observation_threads(inspection_request_id)
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_observation_messages_thread ON observation_messages(thread_id)
  `);
  await query(`
    ALTER TABLE observation_threads
    ADD COLUMN IF NOT EXISTS sent_to_initiator_at TIMESTAMP
  `);
  await query(`
    ALTER TABLE observation_threads
    ADD COLUMN IF NOT EXISTS sent_to_initiator_by INTEGER REFERENCES users(id)
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS observation_thread_reads (
      thread_id INTEGER NOT NULL REFERENCES observation_threads(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (thread_id, user_id)
    )
  `);
  await query(`
    ALTER TABLE observation_messages
    ADD COLUMN IF NOT EXISTS attachment_file_name TEXT
  `);
  await query(`
    ALTER TABLE observation_messages
    ADD COLUMN IF NOT EXISTS attachment_file_path TEXT
  `);
  await query(`
    ALTER TABLE observation_messages
    ADD COLUMN IF NOT EXISTS attachment_file_type TEXT
  `);
  await query(`
    ALTER TABLE observation_messages
    ADD COLUMN IF NOT EXISTS attachment_file_size INTEGER
  `);
  tablesEnsured = true;
}

export async function fetchInspectionForChatAccess(
  inspectionRequestId: number
): Promise<
  (InspectionRequestScopeRow & {
    id: number;
    request_number?: string;
    title?: string;
    initiator_name?: string;
  }) | null
> {
  const result = await query(
    `SELECT ir.id, ir.request_number, ir.title, ir.status, ir.initiator_id, ir.inspector_id, ir.inspector_ids,
            ir.forwarded_to_ordaqa, ir.ordaqa_inspector_id, ir.nominated_team_head_id, ir.final_qa_approver_id,
            ir.nominated_request_approver_id, ir.request_approver_id, ir.confirmations, ir.part4_data,
            u.name AS initiator_name
     FROM inspection_requests ir
     LEFT JOIN users u ON u.id = ir.initiator_id
     WHERE ir.id = $1`,
    [inspectionRequestId]
  );
  return result.rows[0] ?? null;
}

export async function canAccessObservationChat(
  userId: number,
  userRole: string,
  ir: InspectionRequestScopeRow,
  employeeId?: string | null,
  designation?: string | null
): Promise<boolean> {
  if (!roleCanViewObservationChats(userRole) && !userHasGlobalInspectionAccess(userRole, employeeId)) {
    return false;
  }
  return userCanAccessInspectionRequest(userRole, userId, ir, employeeId, designation);
}

/**
 * Only the IR initiator and the Part IV/V inspectors may reply.
 * Other involved users (approvers, heads, etc.) are read-only.
 */
export async function canReplyObservationChat(
  userId: number,
  userRole: string,
  part: ObservationPart,
  ir: InspectionRequestScopeRow
): Promise<boolean> {
  if (userRole === 'administrator') return true;
  if (ir.initiator_id != null && Number(ir.initiator_id) === userId) return true;
  return canCloseObservationChat(userId, userRole, part, ir);
}

export async function canCloseObservationChat(
  userId: number,
  userRole: string,
  part: ObservationPart,
  ir: InspectionRequestScopeRow
): Promise<boolean> {
  if (userRole === 'administrator') return true;
  if (part === 'part4') {
    return userRole === 'inspector' && (await userCanAccessInspectionRequest(userRole, userId, ir));
  }
  if (part === 'part5') {
    return (
      (userRole === 'ordaqa_inspector' || userRole === 'inspector') &&
      (await userCanAccessInspectionRequest(userRole, userId, ir))
    );
  }
  return false;
}

/**
 * R&QA Team Head – QA may edit Part IV observation sheet text after inspector submission
 * (while Part IV is pending Team Head approval).
 */
export function canEditObservationChat(
  userId: number,
  userRole: string,
  part: ObservationPart,
  ir: InspectionRequestScopeRow & {
    status?: string;
    part4_data?: unknown;
    nominated_team_head_id?: number | null;
    confirmations?: unknown;
  },
  threadClosed?: boolean
): boolean {
  if (threadClosed) return false;
  if (part !== 'part4') return false;
  if (userRole === 'administrator') return part4PendingTeamHeadApproval(ir);
  return canUserApprovePart4(ir, userId, userRole);
}

/** Update observation preview + matching Part IV Section 29 remark (Team Head edit). */
export async function updateObservationSheetText(params: {
  threadId: number;
  observation: string;
  actionRequired?: string;
}): Promise<ObservationThreadRow> {
  await ensureObservationChatTables();
  const observation = params.observation.trim();
  if (!observation) throw new Error('Observation text is required');
  const actionRequired =
    params.actionRequired != null ? String(params.actionRequired).trim() : undefined;

  const threadRes = await query(`SELECT * FROM observation_threads WHERE id = $1`, [params.threadId]);
  const thread = threadRes.rows[0] as ObservationThreadRow | undefined;
  if (!thread) throw new Error('Thread not found');
  if (thread.is_closed) throw new Error('This observation is closed and cannot be edited');
  if (thread.part !== 'part4') throw new Error('Only Part IV observations can be edited by Team Head – QA');

  const preview = observation.slice(0, 500);
  const updatedThread = await query(
    `UPDATE observation_threads
     SET observation_preview = $2
     WHERE id = $1
     RETURNING *`,
    [params.threadId, preview]
  );

  let resolvedAction = actionRequired ?? '';
  const irRes = await query(
    `SELECT part4_data FROM inspection_requests WHERE id = $1`,
    [thread.inspection_request_id]
  );
  const ir = irRes.rows[0];
  if (ir) {
    let part4: Record<string, unknown> = {};
    const raw = ir.part4_data;
    if (typeof raw === 'string') {
      try {
        part4 = JSON.parse(raw) || {};
      } catch {
        part4 = {};
      }
    } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      part4 = { ...(raw as Record<string, unknown>) };
    }
    const remarks = Array.isArray(part4.part4_remarks) ? [...(part4.part4_remarks as unknown[])] : [];
    let changed = false;
    const nextRemarks = remarks.map((r) => {
      if (!r || typeof r !== 'object') return r;
      const row = { ...(r as Record<string, unknown>) };
      const key = String(row.chat_id ?? '').trim();
      if (key && key === thread.observation_key) {
        if (actionRequired === undefined) {
          resolvedAction = String(row.action_required ?? '').trim();
        }
        row.observation = observation;
        if (actionRequired !== undefined) row.action_required = actionRequired;
        changed = true;
      }
      return row;
    });
    if (changed) {
      part4.part4_remarks = nextRemarks;
      await query(
        `UPDATE inspection_requests SET part4_data = $2::jsonb, updated_at = NOW() WHERE id = $1`,
        [thread.inspection_request_id, JSON.stringify(part4)]
      );
    }
  }

  // Keep the opening "sent to initiator" chat bubble in sync with the sheet.
  const sheetMessage = formatObservationSendMessage(observation, resolvedAction);
  await query(
    `UPDATE observation_messages
     SET message = $2
     WHERE id = (
       SELECT id FROM observation_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC, id ASC
       LIMIT 1
     )`,
    [params.threadId, sheetMessage]
  );

  return updatedThread.rows[0] || { ...thread, observation_preview: preview };
}

/** Stakeholder user ids who should see/be notified about observation activity on an IR. */
export function collectObservationStakeholderIds(
  ir: InspectionRequestScopeRow,
  excludeUserId?: number
): number[] {
  const ids = new Set<number>();
  const add = (uid: unknown) => {
    const n = uid != null ? Number(uid) : NaN;
    if (Number.isFinite(n) && n > 0 && n !== excludeUserId) ids.add(n);
  };

  add(ir.initiator_id);
  add(ir.request_approver_id);
  add(ir.nominated_request_approver_id);
  add(ir.nominated_team_head_id);
  add(ir.final_qa_approver_id);
  add(ir.inspector_id);
  add(ir.ordaqa_inspector_id);
  for (const id of collectInspectorIds(ir)) add(id);

  return [...ids];
}

export async function ensureObservationThread(params: {
  inspectionRequestId: number;
  part: ObservationPart;
  observationKey: string;
  observationPreview?: string;
}): Promise<ObservationThreadRow> {
  await ensureObservationChatTables();
  const { inspectionRequestId, part, observationKey, observationPreview } = params;
  const preview = (observationPreview || '').trim().slice(0, 500) || null;

  const existing = await query(`SELECT * FROM observation_threads WHERE observation_key = $1`, [observationKey]);
  if (existing.rows[0]) {
    if (preview && !existing.rows[0].observation_preview) {
      await query(`UPDATE observation_threads SET observation_preview = $1 WHERE id = $2`, [
        preview,
        existing.rows[0].id,
      ]);
      existing.rows[0].observation_preview = preview;
    }
    return existing.rows[0];
  }

  const inserted = await query(
    `INSERT INTO observation_threads (inspection_request_id, part, observation_key, observation_preview)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [inspectionRequestId, part, observationKey, preview]
  );
  return inserted.rows[0];
}

export async function getObservationThreadById(threadId: number): Promise<ObservationThreadRow | null> {
  await ensureObservationChatTables();
  const result = await query(`SELECT * FROM observation_threads WHERE id = $1`, [threadId]);
  return result.rows[0] ?? null;
}

export async function getObservationThreadByKey(observationKey: string): Promise<ObservationThreadRow | null> {
  await ensureObservationChatTables();
  const result = await query(`SELECT * FROM observation_threads WHERE observation_key = $1`, [observationKey]);
  return result.rows[0] ?? null;
}

export async function listObservationThreadsForUser(
  userId: number,
  userRole: string,
  options?: { excludeClosed?: boolean; designation?: string | null }
): Promise<
  Array<
    ObservationThreadRow & {
      request_number: string;
      title: string;
      initiator_name: string;
      unread_count: number;
      last_message: string | null;
      last_message_at: string | null;
    }
  >
> {
  await ensureObservationChatTables();

  if (!roleCanViewObservationChats(userRole) && !userHasGlobalInspectionAccess(userRole)) {
    return [];
  }

  const params: unknown[] = [userId];
  let scopeSql = 'TRUE';
  const isGroupLead = isGroupOversightDesignation(options?.designation);

  if (userHasGlobalInspectionAccess(userRole) || userRole === 'administrator') {
    scopeSql = 'TRUE';
  } else if (userRole === 'request_approver' || isGroupLead) {
    let cond = sqlGroupInspectionVisibleCondition('ir', '$1');
    if (userRole !== 'request_approver') {
      const roleCond = sqlInspectionScopeCondition(userRole, 'ir', '$1');
      if (roleCond) cond = `(${cond} OR ${roleCond})`;
    }
    scopeSql = cond;
  } else if (userRole === 'qa_head') {
    const cond = sqlInspectionScopeCondition('qa_head', 'ir', '$1');
    scopeSql = cond || 'FALSE';
  } else if (userRole === 'ordaqa_head') {
    const cond = sqlInspectionScopeCondition('ordaqa_head', 'ir', '$1');
    scopeSql = cond || 'FALSE';
  } else {
    const cond = sqlInspectionScopeCondition(userRole, 'ir', '$1');
    if (!cond) return [];
    scopeSql = cond;
  }

  const excludeClosed = options?.excludeClosed === true;
  const closedFilter = excludeClosed ? 'AND ot.is_closed = false' : '';

  const result = await query(
    `SELECT
       ot.*,
       ir.request_number,
       ir.title,
       u.name AS initiator_name,
       (
         SELECT COUNT(*)::int FROM observation_messages om
         WHERE om.thread_id = ot.id
           AND om.sender_id != $1
           AND om.created_at > COALESCE(
             (SELECT r.last_read_at FROM observation_thread_reads r
              WHERE r.thread_id = ot.id AND r.user_id = $1),
             '1970-01-01'::timestamp
           )
       ) AS unread_count,
       (SELECT om.message FROM observation_messages om
        WHERE om.thread_id = ot.id ORDER BY om.created_at DESC LIMIT 1) AS last_message,
       (SELECT om.created_at FROM observation_messages om
        WHERE om.thread_id = ot.id ORDER BY om.created_at DESC LIMIT 1) AS last_message_at
     FROM observation_threads ot
     JOIN inspection_requests ir ON ir.id = ot.inspection_request_id
     LEFT JOIN users u ON u.id = ir.initiator_id
     WHERE ${scopeSql}
       AND ot.sent_to_initiator_at IS NOT NULL
       ${closedFilter}
     ORDER BY
       ${excludeClosed ? '' : 'CASE WHEN ot.is_closed THEN 1 ELSE 0 END,'}
       COALESCE(
         (SELECT MAX(om.created_at) FROM observation_messages om WHERE om.thread_id = ot.id),
         ot.created_at
       ) DESC`,
    params
  );

  return result.rows;
}

export async function getObservationMessages(threadId: number): Promise<ObservationMessageRow[]> {
  await ensureObservationChatTables();
  const result = await query(
    `SELECT om.*, u.name AS sender_name
     FROM observation_messages om
     JOIN users u ON u.id = om.sender_id
     WHERE om.thread_id = $1
     ORDER BY om.created_at ASC`,
    [threadId]
  );
  return result.rows;
}

export async function markObservationThreadRead(threadId: number, userId: number): Promise<void> {
  await ensureObservationChatTables();
  await query(
    `INSERT INTO observation_thread_reads (thread_id, user_id, last_read_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (thread_id, user_id)
     DO UPDATE SET last_read_at = CURRENT_TIMESTAMP`,
    [threadId, userId]
  );
}

/** Mark thread read and remove observation-chat notifications for this user. */
export async function acknowledgeObservationThread(threadId: number, userId: number): Promise<void> {
  await markObservationThreadRead(threadId, userId);
  await query(
    `DELETE FROM notifications
     WHERE user_id = $1 AND entity_type = 'observation_thread' AND entity_id = $2`,
    [userId, threadId]
  );
}

export async function sendObservationMessage(
  threadId: number,
  senderId: number,
  message: string,
  attachment?: ObservationMessageAttachment | null
): Promise<ObservationMessageRow> {
  await ensureObservationChatTables();
  const trimmed = message.trim();
  if (!trimmed && !attachment) throw new Error('Message or attachment is required');

  const thread = await getObservationThreadById(threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.is_closed) throw new Error('This observation is closed — chat is no longer available');

  const result = await query(
    `INSERT INTO observation_messages (
       thread_id, sender_id, message,
       attachment_file_name, attachment_file_path, attachment_file_type, attachment_file_size
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      threadId,
      senderId,
      trimmed || (attachment ? `[Attachment] ${attachment.file_name}` : ''),
      attachment?.file_name ?? null,
      attachment?.file_path ?? null,
      attachment?.file_type ?? null,
      attachment?.file_size ?? null,
    ]
  );
  const row = result.rows[0];
  const sender = await query(`SELECT name FROM users WHERE id = $1`, [senderId]);
  return { ...row, sender_name: sender.rows[0]?.name || 'Unknown' };
}

export async function syncObservationThreadsFromRemarks(
  inspectionRequestId: number,
  part: ObservationPart,
  remarks: unknown
): Promise<Array<Record<string, unknown>>> {
  if (!Array.isArray(remarks)) return [];
  await ensureObservationChatTables();
  const normalized: Array<Record<string, unknown>> = [];
  for (const raw of remarks) {
    if (!raw || typeof raw !== 'object') continue;
    const row = normalizeRemarkWithChatId({ ...(raw as Record<string, unknown>) });
    normalized.push(row);
    const obs = String(row.observation ?? '').trim();
    const key = String(row.chat_id ?? '').trim();
    if (!obs || !key) continue;
    await ensureObservationThread({
      inspectionRequestId,
      part,
      observationKey: key,
      observationPreview: obs,
    });
  }
  return normalized;
}

export function formatObservationSendMessage(observation: string, actionRequired: string): string {
  const obs = observation.trim();
  const action = actionRequired.trim();
  const lines = [`Observation: ${obs}`];
  if (action) lines.push(`Action Required: ${action}`);
  return lines.join('\n');
}

export async function sendObservationToInitiator(params: {
  inspectionRequestId: number;
  part: ObservationPart;
  observationKey: string;
  observation: string;
  actionRequired?: string;
  senderId: number;
}): Promise<{ thread: ObservationThreadRow; message: ObservationMessageRow; alreadySent: boolean }> {
  const { inspectionRequestId, part, observationKey, observation, actionRequired = '', senderId } = params;
  const obs = observation.trim();
  const action = actionRequired.trim();
  if (!obs) throw new Error('Observation text is required');

  const thread = await ensureObservationThread({
    inspectionRequestId,
    part,
    observationKey,
    observationPreview: obs,
  });

  if (thread.is_closed) {
    throw new Error('This observation is closed — cannot send to initiator');
  }
  if (thread.sent_to_initiator_at) {
    const messages = await getObservationMessages(thread.id);
    return {
      thread,
      message: messages[0] || {
        id: 0,
        thread_id: thread.id,
        sender_id: senderId,
        message: '',
        created_at: thread.sent_to_initiator_at,
      },
      alreadySent: true,
    };
  }

  const messageText = formatObservationSendMessage(obs, action);
  const message = await sendObservationMessage(thread.id, senderId, messageText);

  const updated = await query(
    `UPDATE observation_threads
     SET sent_to_initiator_at = CURRENT_TIMESTAMP, sent_to_initiator_by = $2
     WHERE id = $1
     RETURNING *`,
    [thread.id, senderId]
  );

  return { thread: updated.rows[0] || thread, message, alreadySent: false };
}

/**
 * After Part IV / Part V is saved, sync threads and auto-send every remark that has observation text.
 * Ensures each remark has a chat_id (generates one if missing).
 * Returns newly sent threads (skips already-sent / closed) and the normalized remarks array.
 */
export async function autoSendObservationsFromRemarks(params: {
  inspectionRequestId: number;
  part: ObservationPart;
  remarks: unknown;
  senderId: number;
}): Promise<{
  sent: Array<{ thread: ObservationThreadRow; observation: string; actionRequired: string }>;
  remarks: Array<Record<string, unknown>>;
}> {
  const { inspectionRequestId, part, remarks, senderId } = params;
  if (!Array.isArray(remarks)) return { sent: [], remarks: [] };

  const normalized = await syncObservationThreadsFromRemarks(inspectionRequestId, part, remarks);

  const sent: Array<{ thread: ObservationThreadRow; observation: string; actionRequired: string }> = [];
  for (const row of normalized) {
    const observation = String(row.observation ?? '').trim();
    const observationKey = String(row.chat_id ?? '').trim();
    const actionRequired = String(row.action_required ?? '').trim();
    if (!observation || !observationKey) continue;

    try {
      const result = await sendObservationToInitiator({
        inspectionRequestId,
        part,
        observationKey,
        observation,
        actionRequired,
        senderId,
      });
      if (!result.alreadySent) {
        sent.push({ thread: result.thread, observation, actionRequired });
      }
    } catch (e) {
      console.error('Auto-send observation failed:', observationKey, e);
    }
  }
  return { sent, remarks: normalized };
}

export async function closeObservationThread(
  threadId: number,
  closedBy: number
): Promise<ObservationThreadRow> {
  await ensureObservationChatTables();
  const result = await query(
    `UPDATE observation_threads
     SET is_closed = true, closed_at = CURRENT_TIMESTAMP, closed_by = $2
     WHERE id = $1 AND is_closed = false
     RETURNING *`,
    [threadId, closedBy]
  );
  if (!result.rows[0]) {
    const existing = await getObservationThreadById(threadId);
    if (!existing) throw new Error('Thread not found');
    return existing;
  }
  await query(
    `DELETE FROM notifications WHERE entity_type = 'observation_thread' AND entity_id = $1`,
    [threadId]
  );
  return result.rows[0];
}
