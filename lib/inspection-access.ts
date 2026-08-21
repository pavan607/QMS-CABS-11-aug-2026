import { query } from '@/lib/db';
import { normalizeEmployeeId } from '@/lib/employee-id';
import { collectInspectorIds, parseInspectorIds } from '@/lib/inspector-ids';
import {
  inspectionUsesLegacyOpenRqaPart4,
  isForwardedToOrdqa,
  QA_APPROVER_SKIP_PATH_STATUSES,
} from '@/lib/inspection-display';
import { isEligibleRqaTeamHead, R_QA_DEPARTMENT, TEAM_HEAD_DESIGNATION } from '@/lib/rqa-users';
import {
  sqlInspectorIdsContainsUserId,
  sqlInspectorSendBackVisibleCondition,
  sqlPart1JointInspectionSkippedCondition,
  sqlLegacyOpenRqaPart4Condition,
} from '@/lib/inspection-scope-sql';
import {
  PART1_APPROVER_EMPLOYEE_ID,
  employeeIsPart1Approver,
} from '@/lib/part1-approver';

export { PART1_APPROVER_EMPLOYEE_ID, employeeIsPart1Approver } from '@/lib/part1-approver';

/**
 * Employee IDs with organisation-wide inspection list/detail access (any system role).
 * Note: Part I Approver (1021) is NOT global — they only see the Part I approval queue
 * (pending_part1_approval) plus their normal role/designation scope.
 */
const GLOBAL_INSPECTION_ACCESS_EMPLOYEE_IDS = new Set<string>([]);

export function employeeHasGlobalInspectionAccess(employeeId?: string | null): boolean {
  if (!employeeId) return false;
  return GLOBAL_INSPECTION_ACCESS_EMPLOYEE_IDS.has(normalizeEmployeeId(employeeId));
}

export function userHasGlobalInspectionAccess(
  role: string,
  employeeId?: string | null,
  designation?: string | null
): boolean {
  if (isProjectDirectorUser(role, designation)) return true;
  return roleHasGlobalInspectionAccess(role) || employeeHasGlobalInspectionAccess(employeeId);
}

/** IRs awaiting Part I Approver (1021) action after Request Approver forward. */
export function irVisibleToPart1ApproverQueue(ir: { status?: string | null }): boolean {
  return String(ir.status ?? '') === 'pending_part1_approval';
}

/** SQL: IR is in the Part I Approver queue. */
export function sqlPart1ApproverQueueCondition(irAlias: string): string {
  return `${irAlias}.status = 'pending_part1_approval'`;
}

/**
 * Visibility for employee 1021 (Part I Approver):
 * - IRs that have reached Part I approval or later (including rejected / returned after Part I)
 * - Plus IRs they created or are nominated on (field 21), even if still pending Request Approver
 * Unforwarded IRs (pending_request_approval / draft / returned before Part I) from other teams stay hidden.
 */
export function sqlPart1ApproverVisibleCondition(
  irAlias: string,
  userIdPlaceholder: string
): string {
  const stillBeforePart1 = `${irAlias}.status IN (
    'draft', 'pending', 'pending_request_approval'
  )`;
  const returnedBeforePart1 = `(
    ${irAlias}.status = 'returned_to_designer'
    AND ${irAlias}.part1_approved_by IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM inspection_activities a
      WHERE a.inspection_request_id = ${irAlias}.id
        AND a.activity_type = 'part1_approved'
    )
  )`;
  return `(
    NOT (${stillBeforePart1} OR ${returnedBeforePart1})
    OR ${irAlias}.initiator_id = ${userIdPlaceholder}
    OR ${irAlias}.nominated_request_approver_id = ${userIdPlaceholder}
    OR ${irAlias}.request_approver_id = ${userIdPlaceholder}
  )`;
}

/** Resolve the active Part I approver user row (employee_id = PART1_APPROVER_EMPLOYEE_ID). */
export async function resolvePart1ApproverUser(): Promise<{
  id: number;
  name: string;
  employee_id: string;
  designation: string | null;
  role: string;
} | null> {
  const eid = normalizeEmployeeId(PART1_APPROVER_EMPLOYEE_ID);
  const result = await query(
    `SELECT id, name, employee_id, designation, role
     FROM users
     WHERE UPPER(TRIM(COALESCE(employee_id, ''))) = $1
       AND COALESCE(status, 'active') = 'active'
     LIMIT 1`,
    [eid]
  );
  return result.rows[0] ?? null;
}

export { collectInspectorIds, parseInspectorIds } from '@/lib/inspector-ids';

export type InspectionRequestScopeRow = {
  id?: number | null;
  status?: string | null;
  project_id?: number | null;
  initiator_id?: number | null;
  inspector_id?: number | null;
  inspector_ids?: string | null;
  confirmations?: unknown;
  forwarded_to_ordaqa?: unknown;
  ordaqa_inspector_id?: number | null;
  nominated_team_head_id?: number | null;
  qa_approver_id?: number | null;
  final_qa_approver_id?: number | null;
  nominated_request_approver_id?: number | null;
  request_approver_id?: number | null;
  part1_approved_by?: number | null;
  part2_data?: unknown;
  part3_data?: unknown;
  part3_completed_by?: number | null;
  part4_data?: unknown;
};

/** SQL: IR was forwarded to ORDAQA in Part II (boolean may be stored loosely). */
export function sqlOrdaqaForwardedCondition(irAlias: string): string {
  return `(
    ${irAlias}.forwarded_to_ordaqa IS TRUE
    OR ${irAlias}.forwarded_to_ordaqa::text IN ('true', '1', 't')
  )`;
}

/** SQL: ORDAQA Head may see currently forwarded IRs and IRs they already actioned in Part III. */
export function sqlOrdaqaHeadVisibleCondition(irAlias: string): string {
  return `(
    ${sqlOrdaqaForwardedCondition(irAlias)}
    OR ${irAlias}.part3_completed_by IS NOT NULL
    OR LOWER(COALESCE(${irAlias}.part3_data::jsonb ->> 'memo_returned', '')) = 'yes'
    OR COALESCE(${irAlias}.part3_data::jsonb ->> 'section23_complete', '') IN ('true', 't', '1', 'yes')
  )`;
}

function parsePart3ScopeData(part3: unknown): Record<string, unknown> {
  if (!part3) return {};
  if (typeof part3 === 'object' && !Array.isArray(part3)) return part3 as Record<string, unknown>;
  if (typeof part3 === 'string') {
    try {
      const parsed = JSON.parse(part3);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * ORDAQA Head visibility: currently forwarded, or Part III already completed / memo returned
 * (so Save & Return to QA Head can refresh without 403 after clearing forwarded_to_ordaqa).
 */
export function irVisibleToOrdaqaHead(ir: {
  forwarded_to_ordaqa?: unknown;
  part3_data?: unknown;
  part3_completed_by?: number | null;
}): boolean {
  if (isForwardedToOrdqa(ir)) return true;
  if (ir.part3_completed_by != null && Number(ir.part3_completed_by) > 0) return true;
  const p3 = parsePart3ScopeData(ir.part3_data);
  if (String(p3.memo_returned ?? '').trim().toLowerCase() === 'yes') return true;
  const s23 = String(p3.section23_complete ?? '').trim().toLowerCase();
  return s23 === 'true' || s23 === 't' || s23 === '1' || s23 === 'yes';
}

/**
 * QA Head list/detail:
 * - Hide first-cycle drafts and Part I queues (Request Approver / 1021 still acting).
 * - Keep IRs that already entered the QA pipeline (qa_approver_id set) even if
 *   Team Head sent them back and they are re-queued for Part I.
 */
export function irVisibleToQaHead(ir: {
  status?: string | null;
  request_approver_id?: number | null;
  qa_approver_id?: number | null;
}): boolean {
  const status = String(ir.status ?? '');
  if (['draft', 'pending'].includes(status)) return false;

  const touchedQaPipeline =
    ir.qa_approver_id != null && Number(ir.qa_approver_id) > 0;
  if (['pending_request_approval', 'pending_part1_approval'].includes(status)) {
    return touchedQaPipeline;
  }

  const reqApprId =
    ir.request_approver_id != null ? Number(ir.request_approver_id) : NaN;
  return Number.isFinite(reqApprId) && reqApprId > 0;
}

/** SQL fragment: QA pipeline IRs, plus previously processed IRs re-queued after send-back. */
export function sqlQaHeadInspectionVisibleCondition(irAlias: string): string {
  return `(
    (
      ${irAlias}.request_approver_id IS NOT NULL
      AND ${irAlias}.status NOT IN ('draft', 'pending', 'pending_request_approval', 'pending_part1_approval')
    )
    OR (
      ${irAlias}.qa_approver_id IS NOT NULL
      AND ${irAlias}.status IN ('pending_request_approval', 'pending_part1_approval', 'returned_to_designer')
    )
  )`;
}

export async function fetchAssignedInspectorsByIds(ids: number[]) {
  if (!ids.length) return [];
  const inspResult = await query(
    `SELECT u.id, u.name, u.employee_id, u.designation, u.signature_path
     FROM unnest($1::int[]) WITH ORDINALITY AS t(id, ord)
     JOIN users u ON u.id = t.id
     ORDER BY t.ord`,
    [ids]
  );
  return inspResult.rows;
}

export function userIsNominatedTeamHead(ir: InspectionRequestScopeRow, userId: number): boolean {
  return ir.nominated_team_head_id != null && Number(ir.nominated_team_head_id) === userId;
}

export function userIsAssignedInspector(ir: InspectionRequestScopeRow, userId: number): boolean {
  if (ir.inspector_id != null && Number(ir.inspector_id) === userId) return true;
  if (ir.ordaqa_inspector_id != null && Number(ir.ordaqa_inspector_id) === userId) return true;
  return collectInspectorIds(ir).includes(userId);
}

/** Inspector who sent the IR back (or was assigned when it was sent back) — view only until re-assigned. */
export function userWasInspectorAfterSendBack(ir: InspectionRequestScopeRow, userId: number): boolean {
  const p2 = parsePart3ScopeData(ir.part2_data);
  const sentBy = Number(p2.inspector_send_back_by);
  if (Number.isFinite(sentBy) && sentBy === userId) return true;
  return parseInspectorIds(p2.previous_inspector_ids).includes(userId);
}

/** Roles with organisation-wide inspection visibility (no row filter). */
export function roleHasGlobalInspectionAccess(role: string): boolean {
  return (
    role === 'administrator' ||
    role === 'os_director' ||
    role === 'project_director' ||
    role === 'os' ||
    role === 'director'
  );
}

/** Project Director (system role or designation PD) — sees all inspection requests. */
export function isProjectDirectorUser(
  role?: string | null,
  designation?: string | null
): boolean {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'project_director') return true;
  return String(designation || '').trim().toUpperCase() === 'PD';
}

/** Program Director (system role or designation PGD) — sees only their programme projects. */
export function isProgramDirectorUser(
  role?: string | null,
  designation?: string | null
): boolean {
  // PD sees everything — do not treat as programme-scoped PGD.
  if (isProjectDirectorUser(role, designation)) return false;
  const r = String(role || '').trim().toLowerCase();
  if (r === 'program_director') return true;
  return String(designation || '').trim().toUpperCase() === 'PGD';
}

/**
 * IRs whose project is linked to this user as Program Director (PGD).
 * Requires `projects.program_director_id`.
 */
export function sqlProgramDirectorVisibleCondition(
  irAlias: string,
  userIdPlaceholder: string
): string {
  return `EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = ${irAlias}.project_id
      AND p.program_director_id = ${userIdPlaceholder}
  )`;
}

export async function userOwnsIrProgrammeAsPgd(
  userId: number,
  ir: { project_id?: number | null }
): Promise<boolean> {
  const projectId = ir.project_id != null ? Number(ir.project_id) : NaN;
  if (!Number.isFinite(projectId) || projectId < 1) return false;
  try {
    await ensureProjectsProgramDirectorColumn();
    const res = await query(
      `SELECT 1 FROM projects
       WHERE id = $1 AND program_director_id = $2
       LIMIT 1`,
      [projectId, userId]
    );
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

export async function ensureProjectsProgramDirectorColumn(): Promise<void> {
  await query(
    `ALTER TABLE projects
     ADD COLUMN IF NOT EXISTS program_director_id INTEGER REFERENCES users(id)`,
    []
  );
}

/** Org designations that oversee their reporting group's inspection activity. */
export const GROUP_OVERSIGHT_DESIGNATIONS = new Set(['GD', 'DGD']);

export function isGroupOversightDesignation(designation?: string | null): boolean {
  return GROUP_OVERSIGHT_DESIGNATIONS.has(String(designation || '').trim().toUpperCase());
}

/** Recursive reporting-line IDs under the given user placeholder (e.g. `$1`). */
export function sqlReportingTeamIds(userIdPlaceholder: string): string {
  return `(
    WITH RECURSIVE team AS (
      SELECT id FROM users WHERE reporting_to = ${userIdPlaceholder}
      UNION ALL
      SELECT u.id FROM users u INNER JOIN team t ON u.reporting_to = t.id
    )
    SELECT id FROM team
  )`;
}

/**
 * IRs visible to a GD/DGD (or request approver) via nomination or reporting hierarchy.
 * Includes requests from their team even when field 21 nominates someone else.
 */
export function sqlGroupInspectionVisibleCondition(
  irAlias: string,
  userIdPlaceholder: string
): string {
  const team = sqlReportingTeamIds(userIdPlaceholder);
  return `(
    ${irAlias}.nominated_request_approver_id = ${userIdPlaceholder}
    OR ${irAlias}.request_approver_id = ${userIdPlaceholder}
    OR ${irAlias}.initiator_id IN ${team}
    OR ${irAlias}.nominated_request_approver_id IN ${team}
  )`;
}

/** True when the IR initiator or nominated certifier reports (directly/indirectly) to userId. */
export async function userOverseesInspectionViaReportingLine(
  userId: number,
  ir: InspectionRequestScopeRow
): Promise<boolean> {
  if (ir.nominated_request_approver_id != null && Number(ir.nominated_request_approver_id) === userId) {
    return true;
  }
  if (ir.request_approver_id != null && Number(ir.request_approver_id) === userId) {
    return true;
  }

  const relatedIds = [
    ir.initiator_id != null ? Number(ir.initiator_id) : null,
    ir.nominated_request_approver_id != null ? Number(ir.nominated_request_approver_id) : null,
  ].filter((id): id is number => id != null && Number.isFinite(id) && id > 0 && id !== userId);

  if (relatedIds.length === 0) return false;

  const teamRes = await query(
    `WITH RECURSIVE team AS (
       SELECT id FROM users WHERE reporting_to = $1
       UNION ALL
       SELECT u.id FROM users u INNER JOIN team t ON u.reporting_to = t.id
     )
     SELECT 1 FROM team WHERE id = ANY($2::int[]) LIMIT 1`,
    [userId, relatedIds]
  );
  return teamRes.rows.length > 0;
}

/** Scope conditions that do not bind the user id placeholder. */
export function sqlInspectionScopeNeedsUserId(role: string): boolean {
  return !['qa_head', 'ordaqa_head'].includes(role);
}

/**
 * SQL `AND …` fragment for listing / stats (without leading AND).
 * Returns null when the role has global access or uses a separate filter (request_approver).
 */
export function sqlInspectionScopeCondition(
  role: string,
  irAlias: string,
  userIdPlaceholder: string
): string | null {
  switch (role) {
    case 'program_director':
      return sqlProgramDirectorVisibleCondition(irAlias, userIdPlaceholder);
    case 'initiator':
      // Own IRs, or IRs where this user is nominated field-21 certifier (e.g. DH + Initiator/Designer)
      return `(
        ${irAlias}.initiator_id = ${userIdPlaceholder}
        OR ${irAlias}.nominated_request_approver_id = ${userIdPlaceholder}
      )`;
    case 'qa_approver': {
      const skipStatuses = (QA_APPROVER_SKIP_PATH_STATUSES as readonly string[])
        .map((s) => `'${s}'`)
        .join(', ');
      return `(
        ${irAlias}.nominated_team_head_id = ${userIdPlaceholder}
        OR ${irAlias}.final_qa_approver_id = ${userIdPlaceholder}
        OR (
          ${irAlias}.qa_approver_id = ${userIdPlaceholder}
          AND ${irAlias}.status = 'returned_to_designer'
        )
        OR (
          ${sqlLegacyOpenRqaPart4Condition(irAlias)}
          AND ${irAlias}.status IN (${skipStatuses})
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = ${userIdPlaceholder}
              AND u.role = 'qa_approver'
              AND COALESCE(u.status, 'active') = 'active'
              AND TRIM(COALESCE(u.department, '')) = '${R_QA_DEPARTMENT}'
              AND TRIM(COALESCE(u.designation, '')) = '${TEAM_HEAD_DESIGNATION}'
          )
        )
      )`;
    }
    case 'inspector':
      return `(
        ${irAlias}.ordaqa_inspector_id = ${userIdPlaceholder}
        OR ${irAlias}.inspector_id = ${userIdPlaceholder}
        OR ${sqlInspectorIdsContainsUserId(irAlias, userIdPlaceholder)}
        OR ${sqlInspectorSendBackVisibleCondition(irAlias, userIdPlaceholder)}
        OR (
          ${sqlLegacyOpenRqaPart4Condition(irAlias)}
          AND ${irAlias}.status IN ('request_approved', 'assigned', 'in_progress', 'inspection_completed', 'completed')
        )
      )`;
    case 'ordaqa_inspector':
      return `(
        ${irAlias}.ordaqa_inspector_id = ${userIdPlaceholder}
        OR ${irAlias}.inspector_id = ${userIdPlaceholder}
        OR ${sqlInspectorIdsContainsUserId(irAlias, userIdPlaceholder)}
      )`;
    case 'qa_head':
      return sqlQaHeadInspectionVisibleCondition(irAlias);
    case 'ordaqa_head':
      return sqlOrdaqaHeadVisibleCondition(irAlias);
    default:
      return null;
  }
}

/** Whether the user may open / read this inspection request. */
export async function userCanAccessInspectionRequest(
  role: string,
  userId: number,
  ir: InspectionRequestScopeRow,
  employeeId?: string | null,
  designation?: string | null
): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1) return false;
  if (userHasGlobalInspectionAccess(role, employeeId, designation)) return true;

  // Part I Approver (1021): see IRs from Part I queue onward, including rejected /
  // returned-to-designer after they have already forwarded Part I.
  if (employeeIsPart1Approver(employeeId)) {
    const status = String(ir.status ?? '');
    const part1Approved =
      ir.part1_approved_by != null && Number(ir.part1_approved_by) > 0;
    if (part1Approved) return true;
    const beforePart1Forward = ['draft', 'pending', 'pending_request_approval'].includes(status);
    if (status === 'returned_to_designer' && !part1Approved) {
      const irId = ir.id != null ? Number(ir.id) : NaN;
      if (Number.isFinite(irId) && irId > 0) {
        const acted = await query(
          `SELECT 1 FROM inspection_activities
           WHERE inspection_request_id = $1 AND activity_type = 'part1_approved'
           LIMIT 1`,
          [irId]
        );
        if (acted.rows.length > 0) return true;
      }
    } else if (!beforePart1Forward && status !== 'returned_to_designer') {
      return true;
    }
    if (ir.initiator_id != null && Number(ir.initiator_id) === userId) return true;
    if (
      ir.nominated_request_approver_id != null &&
      Number(ir.nominated_request_approver_id) === userId
    ) {
      return true;
    }
    if (ir.request_approver_id != null && Number(ir.request_approver_id) === userId) {
      return true;
    }
    return false;
  }

  if (isProgramDirectorUser(role, designation)) {
    return userOwnsIrProgrammeAsPgd(userId, ir);
  }

  if (role === 'qa_head') return irVisibleToQaHead(ir);
  if (role === 'ordaqa_head') return irVisibleToOrdaqaHead(ir);
  if (role === 'initiator') {
    if (ir.initiator_id != null && Number(ir.initiator_id) === userId) return true;
    if (
      ir.nominated_request_approver_id != null &&
      Number(ir.nominated_request_approver_id) === userId
    ) {
      return true;
    }
  }

  if (role === 'qa_approver') {
    if (userIsNominatedTeamHead(ir, userId)) return true;
    if (ir.final_qa_approver_id != null && Number(ir.final_qa_approver_id) === userId) {
      return true;
    }
    // After Team Head Send back, nomination is cleared; keep the IR visible while it is with the initiator.
    if (
      String(ir.status ?? '') === 'returned_to_designer' &&
      ir.qa_approver_id != null &&
      Number(ir.qa_approver_id) === userId
    ) {
      return true;
    }
    if (
      inspectionUsesLegacyOpenRqaPart4(ir) &&
      (QA_APPROVER_SKIP_PATH_STATUSES as readonly string[]).includes(String(ir.status ?? ''))
    ) {
      if (await isEligibleRqaTeamHead(userId)) return true;
    }
  }

  if (role === 'inspector') {
    if (userIsAssignedInspector(ir, userId)) return true;
    if (userWasInspectorAfterSendBack(ir, userId)) return true;
    if (
      inspectionUsesLegacyOpenRqaPart4(ir) &&
      ['request_approved', 'assigned', 'in_progress', 'inspection_completed', 'completed'].includes(
        String(ir.status ?? '')
      )
    ) {
      return true;
    }
  }

  if (role === 'ordaqa_inspector') {
    if (userIsAssignedInspector(ir, userId)) return true;
  }

  // GD / DGD (any role) and Request Approvers see their reporting group's IRs.
  if (role === 'request_approver' || isGroupOversightDesignation(designation)) {
    if (await userOverseesInspectionViaReportingLine(userId, ir)) return true;
  }

  return false;
}
