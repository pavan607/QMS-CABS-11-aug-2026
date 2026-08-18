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

/**
 * Inspector still sees an IR after Send back (assignment is cleared so Team Head can re-assign).
 * Matches Part II `inspector_send_back_by` / `previous_inspector_ids`, plus the send-back activity.
 */
export function sqlInspectorSendBackVisibleCondition(
  irAlias: string,
  userIdPlaceholder: string
): string {
  return `(
    COALESCE((${irAlias}.part2_data::jsonb ->> 'inspector_send_back_by')::int, 0) = ${userIdPlaceholder}
    OR COALESCE(${irAlias}.part2_data::jsonb -> 'previous_inspector_ids', '[]'::jsonb)
         @> to_jsonb(${userIdPlaceholder}::int)
    OR EXISTS (
      SELECT 1 FROM inspection_activities a
      WHERE a.inspection_request_id = ${irAlias}.id
        AND a.user_id = ${userIdPlaceholder}
        AND a.activity_type = 'inspector_send_back_to_team_head'
    )
  )`;
}

/**
 * DGAQA/ORDAQA not involved — Parts III/V skipped; Part II Team Head still used.
 * Uses field 4 so_involves_dgaqa; legacy 19(f) yes still counts as involved.
 */
export function sqlPart1JointInspectionSkippedCondition(irAlias: string): string {
  return `(
    COALESCE(${irAlias}.so_involves_dgaqa, FALSE) = FALSE
    AND LOWER(COALESCE(${irAlias}.confirmations::jsonb ->> 'joint_inspection_request', '')) IS DISTINCT FROM 'yes'
  )`;
}

/** Legacy open Part IV: ORDAQA skipped and no nominated Team Head yet. */
export function sqlLegacyOpenRqaPart4Condition(irAlias: string): string {
  return `(
    ${sqlPart1JointInspectionSkippedCondition(irAlias)}
    AND ${irAlias}.nominated_team_head_id IS NULL
  )`;
}
