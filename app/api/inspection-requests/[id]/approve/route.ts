import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { notifyInspectionApproved } from '@/lib/notifications';

// PUT approve inspection request
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
    if (!hasPermission(userRole, 'inspection_request', 'approve')) {
      return NextResponse.json(
        { error: 'Forbidden - Only approvers (Request Approver / QA Approver) can approve requests' },
        { status: 403 }
      );
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
        { error: 'Request must be completed before approval' },
        { status: 400 }
      );
    }

    // Update the request
    const updateResult = await query(
      `UPDATE inspection_requests 
       SET status = 'approved',
           approved_by = $1,
           approval_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [userId, requestId]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'APPROVE',
        'inspection_request',
        requestId,
        JSON.stringify(existingRequest),
        JSON.stringify(updateResult.rows[0]),
      ]
    );

    // Create activity
    await query(
      `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        requestId,
        'approved',
        `Request approved`,
        userId,
      ]
    );

    // Send notifications
    await notifyInspectionApproved(
      updateResult.rows[0].id,
      updateResult.rows[0].request_number,
      existingRequest.initiator_id,
      existingRequest.inspector_id
    );

    return NextResponse.json({ request: updateResult.rows[0] });
  } catch (error) {
    console.error('Error approving inspection request:', error);
    return NextResponse.json({ error: 'Failed to approve inspection request' }, { status: 500 });
  }
}

