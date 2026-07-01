import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

// POST create checklist item
export async function POST(
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
    if (!hasPermission(userRole, 'checklist_item', 'create')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { description, category } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    // Verify checklist exists and get inspector
    const checklistResult = await query(
      `SELECT ic.*, ir.inspector_id, ir.id as inspection_request_id
       FROM inspection_checklists ic
       LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
       WHERE ic.id = $1`,
      [checklistId]
    );

    if (checklistResult.rows.length === 0) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const checklist = checklistResult.rows[0];

    // Verify inspector ownership (unless admin)
    if (userRole === 'inspector' && checklist.inspector_id !== userId) {
      return NextResponse.json(
        { error: 'You can only add items to checklists for requests assigned to you' },
        { status: 403 }
      );
    }

    // Get next item number
    const countResult = await query(
      `SELECT COALESCE(MAX(item_number), 0) + 1 as next_number FROM checklist_items WHERE checklist_id = $1`,
      [checklistId]
    );
    const itemNumber = countResult.rows[0].next_number;

    // Create item
    const itemResult = await query(
      `INSERT INTO checklist_items (checklist_id, item_number, description, category)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [checklistId, itemNumber, description, category || null]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'CREATE', 'checklist_item', itemResult.rows[0].id, JSON.stringify(itemResult.rows[0])]
    );

    return NextResponse.json({ item: itemResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating checklist item:', error);
    return NextResponse.json({ error: 'Failed to create checklist item' }, { status: 500 });
  }
}

