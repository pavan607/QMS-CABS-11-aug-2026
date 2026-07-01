import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
  sqlInspectionScopeCondition,
  sqlInspectionScopeNeedsUserId,
  userHasGlobalInspectionAccess,
} from '@/lib/inspection-access';
import { normalizeSystemRole } from '@/lib/user-roles';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = normalizeSystemRole((session.user as any).role);
    const userId = parseInt((session.user as any).id);
    const employeeId = (session.user as any).employee_id as string | undefined;
    const hasGlobalInspectionScope = userHasGlobalInspectionAccess(userRole, employeeId);

    let baseFilter = '';
    const params: any[] = [];

    if (!hasGlobalInspectionScope) {
      const scopeCond = sqlInspectionScopeCondition(userRole, 'ir', '$1');
      if (scopeCond) {
        baseFilter = `WHERE ${scopeCond}`;
        if (sqlInspectionScopeNeedsUserId(userRole)) params.push(userId);
      } else if (userRole === 'initiator') {
        baseFilter = 'WHERE ir.initiator_id = $1';
        params.push(userId);
      } else if (userRole === 'request_approver') {
        baseFilter = `WHERE (
          ir.nominated_request_approver_id = $1
          OR (
            ir.nominated_request_approver_id IS NULL
            AND ir.initiator_id IN (
              WITH RECURSIVE team AS (
                SELECT id FROM users WHERE reporting_to = $1
                UNION ALL
                SELECT u.id FROM users u INNER JOIN team t ON u.reporting_to = t.id
              )
              SELECT id FROM team
            )
          )
        )`;
        params.push(userId);
      }
    }
    // administrator, os_director, global employee override — no row filter

    const statusResult = await query(
      `SELECT status, COUNT(*) as count
       FROM inspection_requests ir ${baseFilter}
       GROUP BY status`,
      params
    );

    const overdueResult = await query(
      `SELECT COUNT(*) as count
       FROM inspection_requests ir ${baseFilter}
       ${baseFilter ? 'AND' : 'WHERE'} due_date < CURRENT_DATE
       AND status IN ('pending', 'assigned', 'in_progress', 'pending_request_approval', 'request_approved')`,
      params
    );

    const upcomingResult = await query(
      `SELECT COUNT(*) as count
       FROM inspection_requests ir ${baseFilter}
       ${baseFilter ? 'AND' : 'WHERE'} due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       AND status IN ('pending', 'assigned', 'in_progress', 'pending_request_approval', 'request_approved')`,
      params
    );

    const completionResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('completed', 'approved', 'closed')) as completed,
         COUNT(*) as total
       FROM inspection_requests ir ${baseFilter}
       ${baseFilter ? 'AND' : 'WHERE'} created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      params
    );

    const avgCompletionResult = await query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_date - created_at)) / 86400) as avg_days
       FROM inspection_requests ir ${baseFilter}
       ${baseFilter ? 'AND' : 'WHERE'} completed_date IS NOT NULL
       AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      params
    );

    const recentResult = await query(
      `SELECT ir.*, initiator.name as initiator_name, inspector.name as inspector_name
       FROM inspection_requests ir
       LEFT JOIN users initiator ON ir.initiator_id = initiator.id
       LEFT JOIN users inspector ON ir.inspector_id = inspector.id
       ${baseFilter}
       ORDER BY ir.created_at DESC
       LIMIT 10`,
      params
    );

    // Role-specific action items
    let actionItems: any = {};

    if (userRole === 'initiator') {
      const draftRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE initiator_id = $1 AND status = 'draft'`,
        [userId]
      );
      const pendingRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE initiator_id = $1 AND status IN ('pending', 'pending_request_approval')`,
        [userId]
      );
      actionItems = {
        my_drafts: parseInt(draftRes.rows[0]?.count || 0),
        my_pending: parseInt(pendingRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'inspector') {
      const assignedRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE (
          ordaqa_inspector_id = $1
          OR inspector_id = $1
          OR inspector_ids::jsonb @> to_jsonb($1::int)
        ) AND status = 'assigned'`,
        [userId]
      );
      const inProgressRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE (
          ordaqa_inspector_id = $1
          OR inspector_id = $1
          OR inspector_ids::jsonb @> to_jsonb($1::int)
        ) AND status = 'in_progress'`,
        [userId]
      );
      actionItems = {
        my_assigned: parseInt(assignedRes.rows[0]?.count || 0),
        my_in_progress: parseInt(inProgressRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'ordaqa_inspector') {
      const ordaqaFilter = `(ordaqa_inspector_id = $1 OR inspector_id = $1 OR inspector_ids::jsonb @> to_jsonb($1::int))`;
      const assignedRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE ${ordaqaFilter} AND status = 'assigned'`,
        [userId]
      );
      const inProgressRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE ${ordaqaFilter} AND status = 'in_progress'`,
        [userId]
      );
      actionItems = {
        my_assigned: parseInt(assignedRes.rows[0]?.count || 0),
        my_in_progress: parseInt(inProgressRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'request_approver') {
      const raScope = `(
        nominated_request_approver_id = $1
        OR (
          nominated_request_approver_id IS NULL
          AND initiator_id IN (
            WITH RECURSIVE team AS (
              SELECT id FROM users WHERE reporting_to = $1
              UNION ALL
              SELECT u.id FROM users u INNER JOIN team t ON u.reporting_to = t.id
            )
            SELECT id FROM team
          )
        )
      )`;
      const pendingApprovalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status IN ('pending_request_approval', 'pending') AND ${raScope}`,
        [userId]
      );
      const needsAssignmentRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status = 'request_approved'
           AND inspector_id IS NULL
           AND (inspector_ids IS NULL OR inspector_ids::jsonb = '[]'::jsonb)
           AND ${raScope}`,
        [userId]
      );
      actionItems = {
        pending_approval: parseInt(pendingApprovalRes.rows[0]?.count || 0),
        needs_assignment: parseInt(needsAssignmentRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'qa_head') {
      const pendingPart2Res = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status = 'request_approved' AND nominated_team_head_id IS NULL`,
        []
      );
      const pendingFinalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status = 'inspection_completed'`,
        []
      );
      actionItems = {
        pending_approval: parseInt(pendingPart2Res.rows[0]?.count || 0),
        needs_assignment: parseInt(pendingFinalRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'qa_approver') {
      const pendingAssignRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE nominated_team_head_id = $1 AND inspector_id IS NULL AND status = 'request_approved'
           AND NOT (LOWER(COALESCE(confirmations::jsonb ->> 'joint_inspection_request', '')) IN ('no', 'na', 'n/a'))`,
        [userId]
      );
      const pendingFinalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests ir
         WHERE ir.status = 'inspection_completed'
           AND (
             ir.nominated_team_head_id = $1
             OR (
               LOWER(COALESCE(ir.confirmations::jsonb ->> 'joint_inspection_request', '')) IN ('no', 'na', 'n/a')
               AND EXISTS (
                 SELECT 1 FROM users u
                 WHERE u.id = $1
                   AND u.role = 'qa_approver'
                   AND COALESCE(u.status, 'active') = 'active'
                   AND TRIM(COALESCE(u.department, '')) = 'R&QA'
                   AND TRIM(COALESCE(u.designation, '')) = 'TH'
               )
             )
           )`,
        [userId]
      );
      actionItems = {
        pending_approval: parseInt(pendingAssignRes.rows[0]?.count || 0),
        needs_assignment: parseInt(pendingFinalRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'ordaqa_head') {
      const pendingOrdaqaRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE forwarded_to_ordaqa = true AND status IN ('assigned', 'in_progress')`,
        []
      );
      const pendingPart5Res = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE forwarded_to_ordaqa = true
           AND ordaqa_approver_id IS NULL
           AND COALESCE(TRIM(part3_data::jsonb ->> 'clearance_status'), '') <> ''`,
        []
      );
      actionItems = {
        pending_approval: parseInt(pendingOrdaqaRes.rows[0]?.count || 0),
        needs_assignment: parseInt(pendingPart5Res.rows[0]?.count || 0),
      };
    } else if (userRole === 'os_director') {
      const pendingApprovalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status IN ('pending_request_approval', 'pending')`,
        []
      );
      const needsAssignmentRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status = 'request_approved'
           AND inspector_id IS NULL
           AND (inspector_ids IS NULL OR inspector_ids::jsonb = '[]'::jsonb)`,
        []
      );
      actionItems = {
        pending_approval: parseInt(pendingApprovalRes.rows[0]?.count || 0),
        needs_assignment: parseInt(needsAssignmentRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'administrator') {
      const totalUsersRes = await query(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`, []);
      const totalProjectsRes = await query(`SELECT COUNT(*) as count FROM projects WHERE status = 'active'`, []);
      const pendingApprovalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status IN ('pending_request_approval', 'inspection_completed')`,
        []
      );
      const needsAssignmentRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE status = 'request_approved' AND inspector_id IS NULL`,
        []
      );
      actionItems = {
        total_users: parseInt(totalUsersRes.rows[0]?.count || 0),
        total_projects: parseInt(totalProjectsRes.rows[0]?.count || 0),
        pending_approval: parseInt(pendingApprovalRes.rows[0]?.count || 0),
        needs_assignment: parseInt(needsAssignmentRes.rows[0]?.count || 0),
      };
    }

    const stats = {
      byStatus: statusResult.rows,
      overdue: parseInt(overdueResult.rows[0]?.count || 0),
      upcoming: parseInt(upcomingResult.rows[0]?.count || 0),
      completionRate: completionResult.rows[0]
        ? {
            completed: parseInt(completionResult.rows[0].completed || 0),
            total: parseInt(completionResult.rows[0].total || 0),
            percentage:
              completionResult.rows[0].total > 0
                ? Math.round((completionResult.rows[0].completed / completionResult.rows[0].total) * 100)
                : 0,
          }
        : { completed: 0, total: 0, percentage: 0 },
      avgCompletionDays: avgCompletionResult.rows[0]?.avg_days
        ? parseFloat(avgCompletionResult.rows[0].avg_days).toFixed(1)
        : '0',
      recentRequests: recentResult.rows,
      actionItems,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching inspection request stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
