import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { notifyInspectionClosed } from '@/lib/notifications';

// PUT close inspection request
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

    // Check permissions - only approvers and administrators can close
    if (!hasPermission(userRole, 'inspection_request', 'close')) {
      return NextResponse.json(
        { error: 'Forbidden - Only approvers (Request Approver / QA Approver) and administrators can close inspections' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { notes } = body;

    // Get existing request
    const existingResult = await query(
      `SELECT * FROM inspection_requests WHERE id = $1`,
      [requestId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const existingRequest = existingResult.rows[0];

    // Verify request is approved
    if (existingRequest.status !== 'approved') {
      return NextResponse.json(
        { error: 'Request must be approved before closure. Current status: ' + existingRequest.status },
        { status: 400 }
      );
    }

    // Update the request to closed
    const updateResult = await query(
      `UPDATE inspection_requests 
       SET status = 'closed',
           closed_by = $1,
           closed_date = CURRENT_TIMESTAMP,
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
        'CLOSE',
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
        'closed',
        notes ? `Inspection closed - ${notes}` : 'Inspection officially closed',
        userId,
      ]
    );

    // Send notifications
    await notifyInspectionClosed(
      updateResult.rows[0].id,
      updateResult.rows[0].request_number,
      existingRequest.initiator_id,
      existingRequest.inspector_id,
      existingRequest.approver_id
    );

    return NextResponse.json({ request: updateResult.rows[0] });
  } catch (error) {
    console.error('Error closing inspection request:', error);
    return NextResponse.json({ error: 'Failed to close inspection request' }, { status: 500 });
  }
}


