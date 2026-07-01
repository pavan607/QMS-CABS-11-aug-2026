import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

// PUT update checklist item
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
    const itemId = id;
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    // Check permissions
    if (!hasPermission(userRole, 'checklist_item', 'update')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      description,
      category,
      is_compliant,
      status,
      findings,
      corrective_action,
      inspector_notes,
    } = body;

    // Get existing item and verify ownership
    const existingResult = await query(
      `SELECT ci.*, ic.inspection_request_id, ir.inspector_id
       FROM checklist_items ci
       LEFT JOIN inspection_checklists ic ON ci.checklist_id = ic.id
       LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
       WHERE ci.id = $1`,
      [itemId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    const existingItem = existingResult.rows[0];

    // Verify inspector ownership (unless admin)
    if (userRole === 'inspector' && existingItem.inspector_id !== userId) {
      return NextResponse.json(
        { error: 'You can only update items for requests assigned to you' },
        { status: 403 }
      );
    }

    // Build update fields dynamically to handle NULL values properly
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description);
    }

    if (category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(category);
    }

    if (is_compliant !== undefined) {
      updates.push(`is_compliant = $${paramIndex++}`);
      values.push(is_compliant);
    }

    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      
      // Update checked_at if status is being set to non-pending for the first time
      if (status !== 'pending' && existingItem.checked_at === null) {
        updates.push(`checked_at = CURRENT_TIMESTAMP`);
      }
      
      // Update checked_by if status is being set to non-pending for the first time
      if (status !== 'pending' && existingItem.checked_by === null) {
        updates.push(`checked_by = $${paramIndex++}`);
        values.push(userId);
      }
    }

    if (findings !== undefined) {
      updates.push(`findings = $${paramIndex++}`);
      values.push(findings);
    }

    if (corrective_action !== undefined) {
      updates.push(`corrective_action = $${paramIndex++}`);
      values.push(corrective_action);
    }

    if (inspector_notes !== undefined) {
      updates.push(`inspector_notes = $${paramIndex++}`);
      values.push(inspector_notes);
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add the WHERE clause parameter
    values.push(itemId);

    // Build and execute the update query
    const updateQuery = `
      UPDATE checklist_items 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await query(updateQuery, values);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'UPDATE',
        'checklist_item',
        itemId,
        JSON.stringify(existingItem),
        JSON.stringify(updateResult.rows[0]),
      ]
    );

    // Create activity if status changed
    if (status && status !== existingItem.status && status !== 'pending') {
      await query(
        `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          existingItem.inspection_request_id,
          'item_checked',
          `Checklist item #${existingItem.item_number} marked as ${status}`,
          userId,
          JSON.stringify({ item_id: itemId, status, findings }),
        ]
      );
    }

    return NextResponse.json({ item: updateResult.rows[0] });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 });
  }
}

// DELETE checklist item
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
    const itemId = id;
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    // Check permissions
    if (!hasPermission(userRole, 'checklist_item', 'delete')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    // Get existing item
    const existingResult = await query(
      `SELECT ci.*, ic.inspection_request_id, ir.inspector_id
       FROM checklist_items ci
       LEFT JOIN inspection_checklists ic ON ci.checklist_id = ic.id
       LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
       WHERE ci.id = $1`,
      [itemId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    const existingItem = existingResult.rows[0];

    // Verify inspector ownership (unless admin)
    if (userRole === 'inspector' && existingItem.inspector_id !== userId) {
      return NextResponse.json(
        { error: 'You can only delete items for requests assigned to you' },
        { status: 403 }
      );
    }

    // Delete item
    await query(`DELETE FROM checklist_items WHERE id = $1`, [itemId]);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'checklist_item', itemId, JSON.stringify(existingItem)]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return NextResponse.json({ error: 'Failed to delete checklist item' }, { status: 500 });
  }
}

