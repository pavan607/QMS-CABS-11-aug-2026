import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

// GET single checklist with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const checklistId = id;

    // Get checklist
    const checklistResult = await query(
      `SELECT 
        ic.*,
        ir.request_number,
        ir.title as inspection_title,
        ir.inspector_id
      FROM inspection_checklists ic
      LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
      WHERE ic.id = $1`,
      [checklistId]
    );

    if (checklistResult.rows.length === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const checklist = checklistResult.rows[0];

    // Get checklist items
    const itemsResult = await query(
      `SELECT 
        ci.*,
        u.name as checked_by_name,
        (SELECT COUNT(*) FROM attachments WHERE entity_type = 'checklist_item' AND entity_id = ci.id) as attachment_count
      FROM checklist_items ci
      LEFT JOIN users u ON ci.checked_by = u.id
      WHERE ci.checklist_id = $1
      ORDER BY ci.item_number`,
      [checklistId]
    );

    return NextResponse.json({
      checklist: {
        ...checklist,
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 });
  }
}

// PUT update checklist
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
    const checklistId = id;
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    // Check permissions
    if (!hasPermission(userRole, 'checklist', 'update')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, is_completed } = body;

    // Get existing checklist
    const existingResult = await query(
      `SELECT ic.*, ir.inspector_id 
       FROM inspection_checklists ic
       LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
       WHERE ic.id = $1`,
      [checklistId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const existingChecklist = existingResult.rows[0];

    // Verify inspector ownership (unless admin)
    if (userRole === 'inspector' && existingChecklist.inspector_id !== userId) {
      return NextResponse.json(
        { error: 'You can only update checklists for requests assigned to you' },
        { status: 403 }
      );
    }

    // Update checklist
    const updateResult = await query(
      `UPDATE inspection_checklists 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_completed = COALESCE($3, is_completed),
           completed_at = CASE WHEN $3 = true AND is_completed = false THEN CURRENT_TIMESTAMP 
                               WHEN $3 = false THEN NULL 
                               ELSE completed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, description, is_completed, checklistId]
    );

    // If marking as completed, update all pending checklist items to 'passed'
    if (is_completed === true && !existingChecklist.is_completed) {
      await query(
        `UPDATE checklist_items 
         SET status = 'passed',
             is_compliant = true,
             checked_at = CURRENT_TIMESTAMP,
             checked_by = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE checklist_id = $2 AND status = 'pending'`,
        [userId, checklistId]
      );
    }
    
    // If unmarking as completed (reopening), revert all auto-completed items back to 'pending'
    if (is_completed === false && existingChecklist.is_completed) {
      // Only revert items that were auto-completed (status='passed' but no manual check)
      // We'll revert items that were checked at the same time as checklist completion
      await query(
        `UPDATE checklist_items 
         SET status = 'pending',
             is_compliant = NULL,
             checked_at = NULL,
             checked_by = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE checklist_id = $1 AND status = 'passed'`,
        [checklistId]
      );
    }

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'UPDATE',
        'inspection_checklist',
        checklistId,
        JSON.stringify(existingChecklist),
        JSON.stringify(updateResult.rows[0]),
      ]
    );

    // Create activity if completed
    if (is_completed === true && !existingChecklist.is_completed) {
      await query(
        `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id)
         VALUES ($1, $2, $3, $4)`,
        [
          existingChecklist.inspection_request_id,
          'checklist_completed',
          `Checklist "${existingChecklist.name}" completed - all pending items marked as passed`,
          userId,
        ]
      );
    }
    
    // Create activity if reopened
    if (is_completed === false && existingChecklist.is_completed) {
      await query(
        `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id)
         VALUES ($1, $2, $3, $4)`,
        [
          existingChecklist.inspection_request_id,
          'checklist_reopened',
          `Checklist "${existingChecklist.name}" reopened - all items reverted to pending`,
          userId,
        ]
      );
    }

    return NextResponse.json({ checklist: updateResult.rows[0] });
  } catch (error) {
    console.error('Error updating checklist:', error);
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
  }
}

// DELETE checklist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const checklistId = id;
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    // Check permissions
    if (!hasPermission(userRole, 'checklist', 'delete')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    // Get existing checklist
    const existingResult = await query(
      `SELECT ic.*, ir.inspector_id 
       FROM inspection_checklists ic
       LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
       WHERE ic.id = $1`,
      [checklistId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const existingChecklist = existingResult.rows[0];

    // Verify inspector ownership (unless admin)
    if (userRole === 'inspector' && existingChecklist.inspector_id !== userId) {
      return NextResponse.json(
        { error: 'You can only delete checklists for requests assigned to you' },
        { status: 403 }
      );
    }

    // Delete checklist (cascade will handle items)
    await query(`DELETE FROM inspection_checklists WHERE id = $1`, [checklistId]);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'inspection_checklist', checklistId, JSON.stringify(existingChecklist)]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist:', error);
    return NextResponse.json({ error: 'Failed to delete checklist' }, { status: 500 });
  }
}

