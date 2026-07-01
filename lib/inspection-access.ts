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

/** Employee IDs with organisation-wide inspection list/detail access (any system role). */
const GLOBAL_INSPECTION_ACCESS_EMPLOYEE_IDS = new Set(['1021']);

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

/** IRs not yet forwarded by the nominated Request Approver — hidden from QA Head. */
export function irVisibleToQaHead(ir: {
  status?: string | null;
  request_approver_id?: number | null;
}): boolean {
  const status = String(ir.status ?? '');
  if (['draft', 'pending', 'pending_request_approval'].includes(status)) return false;
  const reqApprId =
    ir.request_approver_id != null ? Number(ir.request_approver_id) : NaN;
  return Number.isFinite(reqApprId) && reqApprId > 0;
}

/** SQL fragment: only IRs the Request Approver has forwarded (Part II / QA pipeline). */
export function sqlQaHeadInspectionVisibleCondition(irAlias: string): string {
  return `(
    ${irAlias}.request_approver_id IS NOT NULL
    AND ${irAlias}.status NOT IN ('draft', 'pending', 'pending_request_approval')
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
      return `${irAlias}.initiator_id = ${userIdPlaceholder}`;
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
  employeeId?: string | null
): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1) return false;
  if (userHasGlobalInspectionAccess(role, employeeId)) return true;
  if (role === 'qa_head') return irVisibleToQaHead(ir);
  if (role === 'ordaqa_head') return isForwardedToOrdqa(ir);
  if (role === 'initiator') {
    return ir.initiator_id != null && Number(ir.initiator_id) === userId;
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
      return isEligibleRqaTeamHead(userId);
    }
    return false;
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
    return false;
  }

  if (role === 'ordaqa_inspector') {
    return userIsAssignedInspector(ir, userId);
  }

  if (role === 'request_approver') {
    if (ir.nominated_request_approver_id != null) {
      return Number(ir.nominated_request_approver_id) === userId;
    }
    if (ir.initiator_id == null) return false;
    const teamRes = await query(
      `WITH RECURSIVE team AS (
         SELECT id FROM users WHERE reporting_to = $1
         UNION ALL
         SELECT u.id FROM users u INNER JOIN team t ON u.reporting_to = t.id
       )
       SELECT 1 FROM team WHERE id = $2 LIMIT 1`,
      [userId, ir.initiator_id]
    );
    return teamRes.rows.length > 0;
  }

  return false;
}
