import { query } from '@/lib/db';
import { normalizeEmployeeId } from '@/lib/employee-id';
import { collectInspectorIds, parseInspectorIds } from '@/lib/inspector-ids';
import {
  inspectionSkipsPart2Part3,
  isForwardedToOrdqa,
  QA_APPROVER_SKIP_PATH_STATUSES,
} from '@/lib/inspection-display';
import { isEligibleRqaTeamHead, R_QA_DEPARTMENT, TEAM_HEAD_DESIGNATION } from '@/lib/rqa-users';
import {
  sqlInspectorIdsContainsUserId,
  sqlPart1JointInspectionSkippedCondition,
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
  employeeId?: string | null
): boolean {
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
 * - All IRs that have reached Part I approval or later (pending_part1_approval → closed)
 * - Plus IRs they created or are nominated on (field 21), even if still pending Request Approver
 * Unforwarded IRs (pending_request_approval / draft / returned) from other teams stay hidden.
 */
export function sqlPart1ApproverVisibleCondition(
  irAlias: string,
  userIdPlaceholder: string
): string {
  const reachedPart1OrLater = `${irAlias}.status NOT IN (
    'draft', 'pending', 'pending_request_approval', 'returned_to_designer'
  )`;
  return `(
    ${reachedPart1OrLater}
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
  status?: string | null;
  initiator_id?: number | null;
  inspector_id?: number | null;
  inspector_ids?: string | null;
  confirmations?: unknown;
  forwarded_to_ordaqa?: unknown;
  ordaqa_inspector_id?: number | null;
  nominated_team_head_id?: number | null;
  final_qa_approver_id?: number | null;
  nominated_request_approver_id?: number | null;
  request_approver_id?: number | null;
};

/** SQL: IR was forwarded to ORDAQA in Part II (boolean may be stored loosely). */
export function sqlOrdaqaForwardedCondition(irAlias: string): string {
  return `(
    ${irAlias}.forwarded_to_ordaqa IS TRUE
    OR ${irAlias}.forwarded_to_ordaqa::text IN ('true', '1')
  )`;
}

/** IRs not yet Part I–approved — hidden from QA Head. Returned-to-designer stays visible (QA Head may have returned it). */
export function irVisibleToQaHead(ir: {
  status?: string | null;
  request_approver_id?: number | null;
}): boolean {
  const status = String(ir.status ?? '');
  if (['draft', 'pending', 'pending_request_approval', 'pending_part1_approval'].includes(status)) {
    return false;
  }
  const reqApprId =
    ir.request_approver_id != null ? Number(ir.request_approver_id) : NaN;
  return Number.isFinite(reqApprId) && reqApprId > 0;
}

/** SQL fragment: only IRs after Part I approval (QA pipeline), including returned-to-designer. */
export function sqlQaHeadInspectionVisibleCondition(irAlias: string): string {
  return `(
    ${irAlias}.request_approver_id IS NOT NULL
    AND ${irAlias}.status NOT IN ('draft', 'pending', 'pending_request_approval', 'pending_part1_approval')
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
  return parseInspectorIds(ir.inspector_ids).includes(userId);
}

/** Roles with organisation-wide inspection visibility (no row filter). */
export function roleHasGlobalInspectionAccess(role: string): boolean {
  return (
    role === 'administrator' ||
    role === 'os_director' ||
    role === 'os' ||
    role === 'director'
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
  ].filter((id): id is number => Number.isFinite(id) && id > 0 && id !== userId);

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
          ${sqlPart1JointInspectionSkippedCondition(irAlias)}
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
        OR (
          ${sqlPart1JointInspectionSkippedCondition(irAlias)}
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
      return sqlOrdaqaForwardedCondition(irAlias);
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
  if (userHasGlobalInspectionAccess(role, employeeId)) return true;

  // Part I Approver (1021): see IRs from Part I queue onward; hide unforwarded others.
  if (employeeIsPart1Approver(employeeId)) {
    const status = String(ir.status ?? '');
    const beforePart1Forward = [
      'draft',
      'pending',
      'pending_request_approval',
      'returned_to_designer',
    ].includes(status);
    if (!beforePart1Forward) return true;
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

  if (role === 'qa_head') return irVisibleToQaHead(ir);
  if (role === 'ordaqa_head') return isForwardedToOrdqa(ir);
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
    if (
      inspectionSkipsPart2Part3(ir) &&
      (QA_APPROVER_SKIP_PATH_STATUSES as readonly string[]).includes(String(ir.status ?? ''))
    ) {
      if (await isEligibleRqaTeamHead(userId)) return true;
    }
  }

  if (role === 'inspector') {
    if (userIsAssignedInspector(ir, userId)) return true;
    if (
      inspectionSkipsPart2Part3(ir) &&
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
