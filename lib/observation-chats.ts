import { query } from '@/lib/db';
import {
  userCanAccessInspectionRequest,
  type InspectionRequestScopeRow,
} from '@/lib/inspection-access';
import type { ObservationPart } from '@/lib/observation-chats-shared';

export type { ObservationPart } from '@/lib/observation-chats-shared';
export { generateObservationChatId, normalizeRemarkWithChatId } from '@/lib/observation-chats-shared';

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
  created_at: string;
}

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
            ir.nominated_request_approver_id, ir.request_approver_id, ir.confirmations,
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
  ir: InspectionRequestScopeRow
): Promise<boolean> {
  if (userRole === 'administrator') return true;
  if (ir.initiator_id != null && Number(ir.initiator_id) === userId) return true;
  if (userRole === 'inspector' || userRole === 'ordaqa_inspector') {
    return userCanAccessInspectionRequest(userRole, userId, ir);
  }
  return false;
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
  options?: { excludeClosed?: boolean }
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

  let scopeSql = '';
  const params: unknown[] = [userId];

  if (userRole === 'administrator') {
    scopeSql = 'TRUE';
  } else if (userRole === 'initiator') {
    scopeSql = `ir.initiator_id = $1`;
  } else if (userRole === 'inspector') {
    scopeSql = `(
      ir.inspector_id = $1
      OR ir.ordaqa_inspector_id = $1
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(ir.inspector_ids, '[]')::jsonb) elem
        WHERE elem::int = $1
      )
    )`;
  } else if (userRole === 'ordaqa_inspector') {
    scopeSql = `ir.ordaqa_inspector_id = $1`;
  } else {
    return [];
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
  message: string
): Promise<ObservationMessageRow> {
  await ensureObservationChatTables();
  const trimmed = message.trim();
  if (!trimmed) throw new Error('Message cannot be empty');

  const thread = await getObservationThreadById(threadId);
  if (!thread) throw new Error('Thread not found');
  if (thread.is_closed) throw new Error('This observation is closed — chat is no longer available');

  const result = await query(
    `INSERT INTO observation_messages (thread_id, sender_id, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [threadId, senderId, trimmed]
  );
  const row = result.rows[0];
  const sender = await query(`SELECT name FROM users WHERE id = $1`, [senderId]);
  return { ...row, sender_name: sender.rows[0]?.name || 'Unknown' };
}

export async function syncObservationThreadsFromRemarks(
  inspectionRequestId: number,
  part: ObservationPart,
  remarks: unknown
): Promise<void> {
  if (!Array.isArray(remarks)) return;
  await ensureObservationChatTables();
  for (const raw of remarks) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
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
  actionRequired: string;
  senderId: number;
}): Promise<{ thread: ObservationThreadRow; message: ObservationMessageRow }> {
  const { inspectionRequestId, part, observationKey, observation, actionRequired, senderId } = params;
  const obs = observation.trim();
  const action = actionRequired.trim();
  if (!obs) throw new Error('Observation text is required');
  if (!action) throw new Error('Action required must be filled before sending');

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
    throw new Error('This observation was already sent to the initiator');
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

  return { thread: updated.rows[0] || thread, message };
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
