import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

// GET all checklists (optionally filter by inspection request)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const inspectionRequestId = searchParams.get('inspection_request_id');

    let sql = `
      SELECT 
        ic.*,
        ir.request_number,
        ir.title as inspection_title,
        (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = ic.id) as total_items,
        (SELECT COUNT(*) FROM checklist_items WHERE checklist_id = ic.id AND status != 'pending') as completed_items
      FROM inspection_checklists ic
      LEFT JOIN inspection_requests ir ON ic.inspection_request_id = ir.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (inspectionRequestId) {
      sql += ` AND ic.inspection_request_id = $${paramIndex}`;
      params.push(inspectionRequestId);
      paramIndex++;
    }

    sql += ' ORDER BY ic.created_at DESC';

    const result = await query(sql, params);

    return NextResponse.json({ checklists: result.rows });
  } catch (error) {
    console.error('Error fetching checklists:', error);
    return NextResponse.json({ error: 'Failed to fetch checklists' }, { status: 500 });
  }
}

// POST create new checklist
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    // Check permissions (inspectors and admins can create checklists)
    if (!hasPermission(userRole, 'checklist', 'create')) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { inspection_request_id, name, description, checklist_template, items } = body;

    if (!inspection_request_id || !name) {
      return NextResponse.json(
        { error: 'Inspection request ID and name are required' },
        { status: 400 }
      );
    }

    // Verify inspection request exists
    const requestResult = await query(
      `SELECT id, inspector_id FROM inspection_requests WHERE id = $1`,
      [inspection_request_id]
    );

    if (requestResult.rows.length === 0) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    // Verify inspector is assigned to the request (unless admin)
    if (userRole === 'inspector' && requestResult.rows[0].inspector_id !== userId) {
      return NextResponse.json(
        { error: 'You can only create checklists for requests assigned to you' },
        { status: 403 }
      );
    }

    // Create the checklist
    const checklistResult = await query(
      `INSERT INTO inspection_checklists (inspection_request_id, name, description, checklist_template)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [inspection_request_id, name, description || null, checklist_template ? JSON.stringify(checklist_template) : null]
    );

    const checklist = checklistResult.rows[0];

    // Create checklist items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await query(
          `INSERT INTO checklist_items (checklist_id, item_number, description, category)
           VALUES ($1, $2, $3, $4)`,
          [checklist.id, i + 1, item.description, item.category || null]
        );
      }
    }

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'CREATE', 'inspection_checklist', checklist.id, JSON.stringify(checklist)]
    );

    // Create activity
    await query(
      `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id)
       VALUES ($1, $2, $3, $4)`,
      [inspection_request_id, 'checklist_created', `Checklist "${name}" created`, userId]
    );

    return NextResponse.json({ checklist }, { status: 201 });
  } catch (error) {
    console.error('Error creating checklist:', error);
    return NextResponse.json({ error: 'Failed to create checklist' }, { status: 500 });
  }
}

