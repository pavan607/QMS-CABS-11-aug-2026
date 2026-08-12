/**
 * SQL fragment for listing / scoping inspection requests when a user may appear
 * in `inspector_ids` (JSON array of user ids) in addition to `inspector_id`.
 *
 * @param inspectionRequestsAlias — table alias for `inspection_requests` (e.g. `ir`)
 * @param userIdPlaceholder — a single bound placeholder, e.g. `$1` (integer user id)
 */
export function sqlInspectorIdsContainsUserId(
  inspectionRequestsAlias: string,
  userIdPlaceholder: string
): string {
  return `COALESCE(${inspectionRequestsAlias}.inspector_ids, '[]')::jsonb @> to_jsonb(${userIdPlaceholder}::int)`;
}

/** Part I 19(f) No (or legacy N/A) — ORDAQA Parts III/V skipped; Part II Team Head still used. */
export function sqlPart1JointInspectionSkippedCondition(irAlias: string): string {
  return `LOWER(COALESCE(${irAlias}.confirmations::jsonb ->> 'joint_inspection_request', '')) IN ('no', 'na', 'n/a')`;
}

/** Legacy open Part IV: 19(f) No and no nominated Team Head yet. */
export function sqlLegacyOpenRqaPart4Condition(irAlias: string): string {
  return `(
    ${sqlPart1JointInspectionSkippedCondition(irAlias)}
    AND ${irAlias}.nominated_team_head_id IS NULL
  )`;
}
