import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { checkOverdueInspections } from '@/lib/notifications';
import { createNotification } from '@/lib/notifications';

/**
 * Cron job endpoint to check for alerts
 * This should be called periodically (e.g., every hour or daily)
 * Can be triggered by external cron services like Vercel Cron or cron-job.org
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from a cron job (optional: add authorization header check)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      overdueInspections: 0,
      pendingApprovals: 0,
      upcomingDueDates: 0,
    };

    // Check for overdue inspections
    await checkOverdueInspections();
    const overdueResult = await query(
      `SELECT COUNT(*) as count
       FROM inspection_requests
       WHERE status IN ('pending', 'assigned', 'in_progress')
       AND due_date < CURRENT_DATE`
    );
    results.overdueInspections = parseInt(overdueResult.rows[0]?.count || 0);

    // Check for pending approvals (completed inspections waiting for approval)
    const pendingApprovalResult = await query(
      `SELECT 
        ir.id,
        ir.request_number,
        ir.initiator_id,
        ir.inspector_id,
        ir.approver_id,
        ir.nominated_team_head_id,
        ir.completed_date
      FROM inspection_requests ir
      WHERE ir.status = 'completed'
      AND ir.completed_date < CURRENT_TIMESTAMP - INTERVAL '24 hours'
      AND ir.id NOT IN (
        SELECT DISTINCT entity_id 
        FROM notifications 
        WHERE entity_type = 'inspection_request' 
        AND type = 'overdue_alert'
        AND message LIKE '%pending approval%'
        AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
      )`
    );

    results.pendingApprovals = pendingApprovalResult.rows.length;

    // Send alerts for pending approvals
    for (const request of pendingApprovalResult.rows) {
      const daysPending = Math.floor(
        (Date.now() - new Date(request.completed_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      const teamHeadId =
        request.nominated_team_head_id != null && Number(request.nominated_team_head_id) > 0
          ? Number(request.nominated_team_head_id)
          : null;

      if (teamHeadId) {
        await createNotification({
          userId: teamHeadId,
          title: 'Pending Approval Alert',
          message: `Inspection ${request.request_number} has been pending approval for ${daysPending} days.`,
          type: 'overdue_alert',
          entityType: 'inspection_request',
          entityId: request.id,
          sendEmail: true,
        });
      } else if (request.approver_id) {
        await createNotification({
          userId: request.approver_id,
          title: 'Pending Approval Alert',
          message: `Inspection ${request.request_number} has been pending approval for ${daysPending} days.`,
          type: 'overdue_alert',
          entityType: 'inspection_request',
          entityId: request.id,
          sendEmail: true,
        });
      } else {
        const qaHeadResult = await query(
          `SELECT id FROM users WHERE role = 'qa_head' AND COALESCE(status, 'active') = 'active'`
        );
        for (const qaHead of qaHeadResult.rows) {
          await createNotification({
            userId: qaHead.id,
            title: 'Pending Approval Alert',
            message: `Inspection ${request.request_number} has been pending approval for ${daysPending} days.`,
            type: 'overdue_alert',
            entityType: 'inspection_request',
            entityId: request.id,
            sendEmail: true,
          });
        }
      }

      // Also notify administrator
      const adminResult = await query(
        `SELECT id FROM users WHERE role = 'administrator' AND status = 'active'`
      );
      for (const admin of adminResult.rows) {
        await createNotification({
          userId: admin.id,
          title: 'Pending Approval Alert',
          message: `Inspection ${request.request_number} has been pending approval for ${daysPending} days.`,
          type: 'overdue_alert',
          entityType: 'inspection_request',
          entityId: request.id,
        });
      }
    }

    // Check for upcoming due dates (inspections due in 3 days)
    const upcomingResult = await query(
      `SELECT 
        ir.id,
        ir.request_number,
        ir.initiator_id,
        ir.inspector_id,
        ir.due_date
      FROM inspection_requests ir
      WHERE ir.status IN ('pending', 'assigned', 'in_progress')
      AND ir.due_date = CURRENT_DATE + INTERVAL '3 days'
      AND ir.id NOT IN (
        SELECT DISTINCT entity_id 
        FROM notifications 
        WHERE entity_type = 'inspection_request' 
        AND type = 'warning'
        AND message LIKE '%due in 3 days%'
        AND created_at > CURRENT_DATE
      )`
    );

    results.upcomingDueDates = upcomingResult.rows.length;

    // Send reminders for upcoming due dates
    for (const request of upcomingResult.rows) {
      // Notify initiator
      await createNotification({
        userId: request.initiator_id,
        title: 'Inspection Due Soon',
        message: `Inspection ${request.request_number} is due in 3 days (${new Date(request.due_date).toLocaleDateString()}).`,
        type: 'warning',
        entityType: 'inspection_request',
        entityId: request.id,
      });

      // Notify inspector if assigned
      if (request.inspector_id) {
        await createNotification({
          userId: request.inspector_id,
          title: 'Inspection Due Soon',
          message: `Inspection ${request.request_number} is due in 3 days (${new Date(request.due_date).toLocaleDateString()}).`,
          type: 'warning',
          entityType: 'inspection_request',
          entityId: request.id,
          sendEmail: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Alerts checked successfully',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking alerts:', error);
    return NextResponse.json({ error: 'Failed to check alerts' }, { status: 500 });
  }
}

