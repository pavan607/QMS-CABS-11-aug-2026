import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { getAllowedStatusTransitions } from '@/lib/permissions';
import { notifyInspectionCompleted } from '@/lib/notifications';

// PUT update inspection request status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const requestId = id;
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    // Get existing request
    const existingResult = await query(
      `SELECT * FROM inspection_requests WHERE id = $1`,
      [requestId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const existingRequest = existingResult.rows[0];
    const currentStatus = existingRequest.status;

    // Check if status transition is allowed
    const allowedTransitions = getAllowedStatusTransitions(userRole, currentStatus);

    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          error: `Cannot transition from ${currentStatus} to ${status}`,
          allowedTransitions,
        },
        { status: 403 }
      );
    }

    // Additional validation for inspectors
    if (userRole === 'inspector' && existingRequest.inspector_id !== userId) {
      return NextResponse.json(
        { error: 'You can only update requests assigned to you' },
        { status: 403 }
      );
    }

    // Validate quality checks when marking as completed
    if (status === 'completed') {
      const qualityChecksResult = await query(
        `SELECT COUNT(*) as total_checks,
         COUNT(CASE WHEN result IN ('passed', 'failed') THEN 1 END) as completed_checks
         FROM quality_checks 
         WHERE inspection_request_id = $1`,
        [requestId]
      );

      const { completed_checks } = qualityChecksResult.rows[0];

      if (parseInt(completed_checks) === 0) {
        return NextResponse.json(
          { error: 'At least one quality check must be completed before marking the inspection as complete' },
          { status: 400 }
        );
      }
    }

    // Update the request
    const updateFields: any = {
      status,
      updated_at: 'CURRENT_TIMESTAMP',
    };

    if (status === 'completed') {
      updateFields.completed_date = 'CURRENT_TIMESTAMP';
    }

    const updateResult = await query(
      `UPDATE inspection_requests 
       SET status = $1,
           ${status === 'completed' ? 'completed_date = CURRENT_TIMESTAMP,' : ''}
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, requestId]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'UPDATE_STATUS',
        'inspection_request',
        requestId,
        JSON.stringify({ status: currentStatus }),
        JSON.stringify({ status }),
      ]
    );

    // Create activity
    await query(
      `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        requestId,
        'status_changed',
        `Status changed from ${currentStatus} to ${status}`,
        userId,
      ]
    );

    // Send notifications based on status
    if (status === 'completed') {
      await notifyInspectionCompleted(
        updateResult.rows[0].id,
        updateResult.rows[0].request_number,
        existingRequest.initiator_id,
        existingRequest.approver_id,
        existingRequest.nominated_team_head_id
      );
    }

    return NextResponse.json({ request: updateResult.rows[0] });
  } catch (error) {
    console.error('Error updating inspection request status:', error);
    return NextResponse.json({ error: 'Failed to update inspection request status' }, { status: 500 });
  }
}

