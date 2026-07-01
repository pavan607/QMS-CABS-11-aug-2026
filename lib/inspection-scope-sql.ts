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

/** Part I 19(f) No or N/A — Parts II–III skipped; R&QA Inspector fills Part IV. */
export function sqlPart1JointInspectionSkippedCondition(irAlias: string): string {
  return `LOWER(COALESCE(${irAlias}.confirmations::jsonb ->> 'joint_inspection_request', '')) IN ('no', 'na', 'n/a')`;
}
