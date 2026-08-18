import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
  sqlInspectionScopeCondition,
  sqlInspectionScopeNeedsUserId,
  sqlGroupInspectionVisibleCondition,
  isGroupOversightDesignation,
  userHasGlobalInspectionAccess,
  employeeIsPart1Approver,
  sqlPart1ApproverVisibleCondition,
  resolvePart1ApproverUser,
} from '@/lib/inspection-access';
import { normalizeSystemRole } from '@/lib/user-roles';
import { canUserUpdatePart4, canUserUpdatePart5, canUserFillPart2OutstationDetails } from '@/lib/inspection-display';
import { sqlPart1JointInspectionSkippedCondition } from '@/lib/inspection-scope-sql';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = normalizeSystemRole((session.user as any).role);
    const userId = parseInt((session.user as any).id);
    const employeeId = (session.user as any).employee_id as string | undefined;
    const designation = (session.user as any).designation as string | undefined;
    const hasGlobalInspectionScope = userHasGlobalInspectionAccess(userRole, employeeId);
    const isGroupLead = isGroupOversightDesignation(designation);
    let isPart1Approver = employeeIsPart1Approver(employeeId);
    if (!isPart1Approver) {
      const part1User = await resolvePart1ApproverUser();
      if (part1User && part1User.id === userId) isPart1Approver = true;
    }

    let baseFilter = '';
    const params: any[] = [];

    if (!hasGlobalInspectionScope) {
      if (isPart1Approver) {
        baseFilter = `WHERE ${sqlPart1ApproverVisibleCondition('ir', '$1')}`;
        params.push(userId);
      } else if (userRole === 'request_approver' || isGroupLead) {
        const ph = '$1';
        let cond = sqlGroupInspectionVisibleCondition('ir', ph);
        if (userRole !== 'request_approver') {
          if (userRole === 'initiator') {
            cond = `(ir.initiator_id = ${ph} OR ${cond})`;
          } else {
            const roleCond = sqlInspectionScopeCondition(userRole, 'ir', ph);
            if (roleCond) cond = `(${cond} OR ${roleCond})`;
          }
        }
        baseFilter = `WHERE ${cond}`;
        params.push(userId);
      } else if (userRole === 'initiator') {
        baseFilter =
          'WHERE (ir.initiator_id = $1 OR ir.nominated_request_approver_id = $1)';
        params.push(userId);
      } else {
        const scopeCond = sqlInspectionScopeCondition(userRole, 'ir', '$1');
        if (scopeCond) {
          baseFilter = `WHERE ${scopeCond}`;
          if (sqlInspectionScopeNeedsUserId(userRole)) params.push(userId);
        }
      }
    }
    // administrator, os_director — no row filter

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
       AND status IN ('pending', 'assigned', 'in_progress', 'pending_request_approval', 'pending_part1_approval', 'request_approved')`,
      params
    );

    const upcomingResult = await query(
      `SELECT COUNT(*) as count
       FROM inspection_requests ir ${baseFilter}
       ${baseFilter ? 'AND' : 'WHERE'} due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       AND status IN ('pending', 'assigned', 'in_progress', 'pending_request_approval', 'pending_part1_approval', 'request_approved')`,
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
      `SELECT ir.id, ir.request_number, ir.title, ir.item, ir.lru_nomenclature, ir.status,
              ir.due_date, ir.request_date, ir.created_at, ir.venue, ir.location,
              ir.inspection_stage, ir.inspection_type,
              initiator.name as initiator_name,
              inspector.name as inspector_name,
              (
                SELECT string_agg(u2.name, ', ' ORDER BY s.ord)
                FROM jsonb_array_elements_text(COALESCE(ir.inspector_ids, '[]')::jsonb) WITH ORDINALITY AS s(id_txt, ord)
                JOIN users u2 ON u2.id = s.id_txt::int
              ) as inspector_names,
              p.name as project_name,
              p.code as project_code,
              ss.name as subsystem_name
       FROM inspection_requests ir
       LEFT JOIN users initiator ON ir.initiator_id = initiator.id
       LEFT JOIN users inspector ON ir.inspector_id = inspector.id
       LEFT JOIN projects p ON ir.project_id = p.id
       LEFT JOIN subsystems ss ON ir.subsystem_id = ss.id
       ${baseFilter}
       ${baseFilter ? 'AND' : 'WHERE'} ir.status != 'draft'
       ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC
       LIMIT 200`,
      params
    );

    // Role-specific action items
    let actionItems: any = {};

    if (isPart1Approver) {
      // Employee 1021 — Part I approval queue (after Request Approver forward)
      const pendingPart1Res = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE status = 'pending_part1_approval'`
      );
      const part1Count = parseInt(pendingPart1Res.rows[0]?.count || 0);
      let needsAssignment = 0;
      let groupPendingForward = 0;
      if (userRole === 'request_approver' || isGroupLead) {
        const groupScope = sqlGroupInspectionVisibleCondition('ir', '$1');
        const pendingApprovalRes = await query(
          `SELECT COUNT(*) as count FROM inspection_requests ir
           WHERE status IN ('pending_request_approval', 'pending') AND ${groupScope}`,
          [userId]
        );
        const needsAssignmentRes = await query(
          `SELECT COUNT(*) as count FROM inspection_requests ir
           WHERE status = 'request_approved'
             AND inspector_id IS NULL
             AND (inspector_ids IS NULL OR inspector_ids::jsonb = '[]'::jsonb)
             AND ${groupScope}`,
          [userId]
        );
        groupPendingForward = parseInt(pendingApprovalRes.rows[0]?.count || 0);
        needsAssignment = parseInt(needsAssignmentRes.rows[0]?.count || 0);
      }
      actionItems = {
        // Dashboard "actions required" / pending card uses pending_approval for Part I queue
        pending_approval: part1Count,
        pending_part1_approval: part1Count,
        pending_request_forward: groupPendingForward,
        needs_assignment: needsAssignment,
      };
    } else if (userRole === 'initiator') {
      const draftRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE initiator_id = $1 AND status = 'draft'`,
        [userId]
      );
      const pendingRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE initiator_id = $1 AND status IN ('pending', 'pending_request_approval')`,
        [userId]
      );
      const returnedRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests WHERE initiator_id = $1 AND status = 'returned_to_designer'`,
        [userId]
      );
      actionItems = {
        my_drafts: parseInt(draftRes.rows[0]?.count || 0),
        my_pending: parseInt(pendingRes.rows[0]?.count || 0),
        returned_to_designer: parseInt(returnedRes.rows[0]?.count || 0),
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
      const part4Candidates = await query(
        `SELECT inspector_id, inspector_ids, status, confirmations, forwarded_to_ordaqa,
                part3_data, ordaqa_inspector_id, part4_data,
                so_involves_dgaqa, so_involves_rqa, nominated_team_head_id
         FROM inspection_requests
         WHERE status IN ('request_approved', 'assigned')
           AND (
             inspector_id = $1
             OR inspector_ids::jsonb @> to_jsonb($1::int)
             OR (
               ${sqlPart1JointInspectionSkippedCondition('inspection_requests').replace(/inspection_requests\./g, '')}
               AND nominated_team_head_id IS NULL
               AND inspector_id IS NULL
               AND (inspector_ids IS NULL OR inspector_ids::jsonb = '[]'::jsonb)
             )
           )`,
        [userId]
      );
      const pendingPart4 = part4Candidates.rows.filter((ir) =>
        canUserUpdatePart4(ir, userId, 'inspector')
      ).length;
      // Delegated path: R&QA inspector set as ordaqa_inspector_id must fill Part V
      const part5Candidates = await query(
        `SELECT status, confirmations, forwarded_to_ordaqa, part3_data, part4_data,
                so_involves_dgaqa, so_involves_rqa, ordaqa_inspector_id, ordaqa_approver_id
         FROM inspection_requests
         WHERE ordaqa_inspector_id = $1
           AND status IN ('assigned', 'in_progress', 'request_approved')`,
        [userId]
      );
      const pendingPart5 = part5Candidates.rows.filter((ir) =>
        canUserUpdatePart5(ir, userId, 'inspector')
      ).length;
      const outstationCandidates = await query(
        `SELECT status, part2_data, inspector_id, inspector_ids
         FROM inspection_requests
         WHERE status IN ('assigned', 'in_progress')
           AND (
             inspector_id = $1
             OR inspector_ids::jsonb @> to_jsonb($1::int)
           )`,
        [userId]
      );
      const pendingOutstation = outstationCandidates.rows.filter((ir) =>
        canUserFillPart2OutstationDetails(ir, userId, 'inspector')
      ).length;
      actionItems = {
        my_assigned: parseInt(assignedRes.rows[0]?.count || 0),
        my_in_progress: parseInt(inProgressRes.rows[0]?.count || 0),
        pending_part4: pendingPart4,
        pending_part5: pendingPart5,
        pending_outstation: pendingOutstation,
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
      const part5Candidates = await query(
        `SELECT status, confirmations, forwarded_to_ordaqa, part3_data, part4_data,
                so_involves_dgaqa, so_involves_rqa, ordaqa_inspector_id, ordaqa_approver_id
         FROM inspection_requests
         WHERE ordaqa_inspector_id = $1
           AND status IN ('assigned', 'in_progress')`,
        [userId]
      );
      const pendingPart5 = part5Candidates.rows.filter((ir) =>
        canUserUpdatePart5(ir, userId, 'ordaqa_inspector')
      ).length;
      actionItems = {
        my_assigned: parseInt(assignedRes.rows[0]?.count || 0),
        my_in_progress: parseInt(inProgressRes.rows[0]?.count || 0),
        pending_part5: pendingPart5,
      };
    } else if (userRole === 'request_approver' || isGroupLead) {
      const groupScope = sqlGroupInspectionVisibleCondition('ir', '$1');
      const pendingApprovalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests ir
         WHERE status IN ('pending_request_approval', 'pending') AND ${groupScope}`,
        [userId]
      );
      const needsAssignmentRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests ir
         WHERE status = 'request_approved'
           AND inspector_id IS NULL
           AND (inspector_ids IS NULL OR inspector_ids::jsonb = '[]'::jsonb)
           AND ${groupScope}`,
        [userId]
      );
      actionItems = {
        pending_approval: parseInt(pendingApprovalRes.rows[0]?.count || 0),
        needs_assignment: parseInt(needsAssignmentRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'qa_head') {
      // Part II not yet completed (no Team Head) OR ORDAQA memo returned for Part II re-review
      const pendingPart2Res = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE (
           (status = 'request_approved' AND nominated_team_head_id IS NULL)
           OR (
             LOWER(COALESCE(part3_data::jsonb ->> 'memo_returned', '')) = 'yes'
             AND COALESCE(forwarded_to_ordaqa, false) = false
             AND status NOT IN (
               'draft', 'pending', 'pending_request_approval', 'pending_part1_approval',
               'returned_to_designer', 'completed', 'closed', 'rejected'
             )
           )
         )`,
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
         WHERE nominated_team_head_id = $1
           AND status = 'request_approved'
           AND inspector_id IS NULL
           AND (inspector_ids IS NULL OR inspector_ids::jsonb = '[]'::jsonb)
           AND LOWER(COALESCE(part3_data::jsonb ->> 'memo_returned', '')) <> 'yes'`,
        [userId]
      );
      // Part IV submitted by R&QA Inspector — awaiting this Team Head – QA approve/reject
      const pendingPart4ApprovalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests ir
         WHERE ir.status IN ('assigned', 'in_progress')
           AND COALESCE(ir.part4_data::jsonb ->> 'team_head_approval_status', '') = 'pending'
           AND (
             ir.nominated_team_head_id = $1
             OR (
               ir.nominated_team_head_id IS NULL
               AND ${sqlPart1JointInspectionSkippedCondition('ir')}
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
      const pendingFinalRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests ir
         WHERE ir.status = 'inspection_completed'
           AND (
             ir.nominated_team_head_id = $1
             OR (
               ir.nominated_team_head_id IS NULL
               AND ${sqlPart1JointInspectionSkippedCondition('ir')}
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
        pending_part4_approval: parseInt(pendingPart4ApprovalRes.rows[0]?.count || 0),
        needs_assignment: parseInt(pendingFinalRes.rows[0]?.count || 0),
      };
    } else if (userRole === 'ordaqa_head') {
      // Part III only after Outstation details are complete (when Outstation was enabled)
      const outstationReady = `
           AND NOT (
             COALESCE(part2_data::jsonb ->> 'outstation_inspection', '') IN ('true', 't', '1', 'yes')
             AND (
               LOWER(TRIM(COALESCE(part2_data::jsonb ->> 'email_sent', ''))) NOT IN ('yes', 'no')
               OR TRIM(COALESCE(part2_data::jsonb ->> 'email_sent_by', '')) = ''
               OR TRIM(COALESCE(part2_data::jsonb ->> 'email_sent_date', '')) = ''
             )
           )`;
      const part3Base = `
         WHERE COALESCE(forwarded_to_ordaqa, false) = true
           AND status IN ('request_approved', 'assigned', 'in_progress')
           AND ordaqa_inspector_id IS NULL
           AND LOWER(COALESCE(part3_data::jsonb ->> 'memo_returned', '')) <> 'yes'
           ${outstationReady}`;
      const reforwardFlag = `
           AND (
             COALESCE(part3_data::jsonb ->> 'reforwarded_after_memo', '') IN ('true', 't', '1', 'yes')
             OR EXISTS (
               SELECT 1 FROM inspection_activities a
               WHERE a.inspection_request_id = inspection_requests.id
                 AND a.activity_type IN ('part3_memo_returned', 'part2_reforwarded_to_ordaqa')
             )
           )`;
      const notReforwardFlag = `
           AND COALESCE(part3_data::jsonb ->> 'reforwarded_after_memo', '') NOT IN ('true', 't', '1', 'yes')
           AND NOT EXISTS (
             SELECT 1 FROM inspection_activities a
             WHERE a.inspection_request_id = inspection_requests.id
               AND a.activity_type IN ('part3_memo_returned', 'part2_reforwarded_to_ordaqa')
           )`;

      const pendingPart3Res = await query(
        `SELECT COUNT(*) as count FROM inspection_requests ${part3Base} ${notReforwardFlag}`,
        []
      );
      const pendingReforwardRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests ${part3Base} ${reforwardFlag}`,
        []
      );
      const activeOrdaqaRes = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE COALESCE(forwarded_to_ordaqa, false) = true
           AND status IN ('assigned', 'in_progress')`,
        []
      );
      const pendingPart5Res = await query(
        `SELECT COUNT(*) as count FROM inspection_requests
         WHERE COALESCE(forwarded_to_ordaqa, false) = true
           AND ordaqa_approver_id IS NULL
           AND COALESCE(TRIM(part3_data::jsonb ->> 'clearance_status'), '') <> ''`,
        []
      );
      actionItems = {
        pending_approval: parseInt(pendingPart3Res.rows[0]?.count || 0),
        pending_reforward: parseInt(pendingReforwardRes.rows[0]?.count || 0),
        needs_assignment: parseInt(pendingPart5Res.rows[0]?.count || 0),
        active_ordaqa: parseInt(activeOrdaqaRes.rows[0]?.count || 0),
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
