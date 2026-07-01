import { query } from '@/lib/db';

/** Matches dashboard Users → Department value `R&QA`. */
export const R_QA_DEPARTMENT = 'R&QA';

/** Team Head designation stored on user records. */
export const TEAM_HEAD_DESIGNATION = 'TH';

/** Active user eligible for Part II “Team Head - QA” nomination. */
export async function isEligibleRqaTeamHead(userId: number): Promise<boolean> {
  if (!Number.isFinite(userId) || userId < 1) return false;
  const r = await query(
    `SELECT 1 FROM users
     WHERE id = $1
       AND COALESCE(status, 'active') = 'active'
       AND TRIM(COALESCE(department, '')) = $2
       AND TRIM(COALESCE(designation, '')) = $3`,
    [userId, R_QA_DEPARTMENT, TEAM_HEAD_DESIGNATION]
  );
  return r.rows.length > 0;
}

/** Active R&QA Team Head users (`qa_approver` + TH in R&QA) — notified for skip-path final approval. */
export async function listActiveRqaTeamHeadUserIds(): Promise<number[]> {
  const r = await query(
    `SELECT id FROM users
     WHERE role = 'qa_approver'
       AND COALESCE(status, 'active') = 'active'
       AND TRIM(COALESCE(department, '')) = $1
       AND TRIM(COALESCE(designation, '')) = $2
     ORDER BY id`,
    [R_QA_DEPARTMENT, TEAM_HEAD_DESIGNATION]
  );
  return r.rows
    .map((row: { id: number }) => Number(row.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}
