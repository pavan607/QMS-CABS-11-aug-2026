import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';
import { notifyInspectionRequestAssigned } from '@/lib/notifications';

// PUT assign inspector to inspection request
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

    // Only administrators and approvers can assign inspectors
    if (userRole !== 'administrator' && userRole !== 'qa_approver' && userRole !== 'request_approver') {
      return NextResponse.json(
        { error: 'Forbidden - Only administrators and approvers can assign inspectors' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { inspector_id, approver_id } = body;

    if (!inspector_id) {
      return NextResponse.json({ error: 'Inspector ID is required' }, { status: 400 });
    }

    // Verify inspector exists and has inspector role
    const inspectorResult = await query(
      `SELECT id, role FROM users WHERE id = $1 AND status = 'active'`,
      [inspector_id]
    );

    if (inspectorResult.rows.length === 0) {
      return NextResponse.json({ error: 'Inspector not found or inactive' }, { status: 404 });
    }

    if (inspectorResult.rows[0].role !== 'inspector') {
      return NextResponse.json({ error: 'User is not an inspector' }, { status: 400 });
    }

    // Verify approver if provided
    if (approver_id) {
      const approverResult = await query(
        `SELECT id, role FROM users WHERE id = $1 AND status = 'active'`,
        [approver_id]
      );

      if (approverResult.rows.length === 0) {
        return NextResponse.json({ error: 'Approver not found or inactive' }, { status: 404 });
      }

      if (approverResult.rows[0].role !== 'qa_approver' && approverResult.rows[0].role !== 'request_approver' && approverResult.rows[0].role !== 'administrator') {
        return NextResponse.json({ error: 'User is not an approver' }, { status: 400 });
      }
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

    // Update the request
    const updateResult = await query(
      `UPDATE inspection_requests 
       SET inspector_id = $1,
           inspector_ids = $2,
           approver_id = $3,
           status = 'assigned',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [inspector_id, JSON.stringify([Number(inspector_id)]), approver_id || null, requestId]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'ASSIGN',
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
        'assigned',
        `Request assigned to inspector`,
        userId,
      ]
    );

    // Send notifications
    await notifyInspectionRequestAssigned(
      updateResult.rows[0].id,
      updateResult.rows[0].request_number,
      inspector_id,
      existingRequest.initiator_id
    );

    return NextResponse.json({ request: updateResult.rows[0] });
  } catch (error) {
    console.error('Error assigning inspection request:', error);
    return NextResponse.json({ error: 'Failed to assign inspection request' }, { status: 500 });
  }
}

