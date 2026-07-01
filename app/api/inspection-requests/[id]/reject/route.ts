import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { notifyInspectionRejected } from '@/lib/notifications';

// PUT reject inspection request
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

    // Check permissions
    if (!hasPermission(userRole, 'inspection_request', 'reject')) {
      return NextResponse.json(
        { error: 'Forbidden - Only approvers (Request Approver / QA Approver) can reject requests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
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

    // Verify request is completed
    if (existingRequest.status !== 'completed') {
      return NextResponse.json(
        { error: 'Request must be completed before rejection' },
        { status: 400 }
      );
    }

    // Update the request
    const updateResult = await query(
      `UPDATE inspection_requests 
       SET status = 'rejected',
           rejection_reason = $1,
           approved_by = $2,
           approval_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [reason, userId, requestId]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'REJECT',
        'inspection_request',
        requestId,
        JSON.stringify(existingRequest),
        JSON.stringify(updateResult.rows[0]),
      ]
    );

    // Create activity
    await query(
      `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        requestId,
        'rejected',
        `Request rejected: ${reason}`,
        userId,
        JSON.stringify({ reason }),
      ]
    );

    // Send notifications
    await notifyInspectionRejected(
      updateResult.rows[0].id,
      updateResult.rows[0].request_number,
      existingRequest.initiator_id,
      existingRequest.inspector_id,
      reason
    );

    return NextResponse.json({ request: updateResult.rows[0] });
  } catch (error) {
    console.error('Error rejecting inspection request:', error);
    return NextResponse.json({ error: 'Failed to reject inspection request' }, { status: 500 });
  }
}

