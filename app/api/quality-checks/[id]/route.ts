import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET single quality check
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

    const result = await query(
      `SELECT 
        qc.*,
        u.name as inspector_name,
        qct.name as template_name,
        creator.name as created_by_name,
        ir.request_number as inspection_request_number,
        ir.title as inspection_request_title
       FROM quality_checks qc
       LEFT JOIN users u ON qc.inspector_id = u.id
       LEFT JOIN quality_check_templates qct ON qc.template_id = qct.id
       LEFT JOIN users creator ON qc.created_by = creator.id
       LEFT JOIN inspection_requests ir ON qc.inspection_request_id = ir.id
       WHERE qc.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Quality check not found' }, { status: 404 });
    }

    return NextResponse.json({ check: result.rows[0] });
  } catch (error) {
    console.error('Error fetching quality check:', error);
    return NextResponse.json({ error: 'Failed to fetch quality check' }, { status: 500 });
  }
}

// PUT update quality check
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

    const body = await request.json();
    const { name, template_id, inspector_id, check_date, score, result, notes, findings } = body;

    // Get user id
    const userResult = await query('SELECT id FROM users WHERE id = $1', [(session.user as any).id]);
    const userId = userResult.rows[0]?.id;

    // Get old values for audit
    const oldCheck = await query('SELECT * FROM quality_checks WHERE id = $1', [id]);
    
    if (oldCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Quality check not found' }, { status: 404 });
    }

    const dbResult = await query(
      `UPDATE quality_checks 
       SET name = COALESCE($1, name),
           template_id = COALESCE($2, template_id),
           inspector_id = COALESCE($3, inspector_id),
           check_date = COALESCE($4, check_date),
           score = COALESCE($5, score),
           result = COALESCE($6, result),
           notes = COALESCE($7, notes),
           findings = COALESCE($8, findings),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, template_id, inspector_id, check_date, score, result, notes, findings ? JSON.stringify(findings) : null, id]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'UPDATE', 'quality_check', id, JSON.stringify(oldCheck.rows[0]), JSON.stringify(dbResult.rows[0])]
    );

    return NextResponse.json({ check: dbResult.rows[0] });
  } catch (error) {
    console.error('Error updating quality check:', error);
    return NextResponse.json({ error: 'Failed to update quality check' }, { status: 500 });
  }
}

// DELETE quality check
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

    // Get user id
    const userResult = await query('SELECT id FROM users WHERE id = $1', [(session.user as any).id]);
    const userId = userResult.rows[0]?.id;

    // Get quality check for audit
    const check = await query('SELECT * FROM quality_checks WHERE id = $1', [id]);
    
    if (check.rows.length === 0) {
      return NextResponse.json({ error: 'Quality check not found' }, { status: 404 });
    }

    await query('DELETE FROM quality_checks WHERE id = $1', [id]);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'quality_check', id, JSON.stringify(check.rows[0])]
    );

    return NextResponse.json({ message: 'Quality check deleted successfully' });
  } catch (error) {
    console.error('Error deleting quality check:', error);
    return NextResponse.json({ error: 'Failed to delete quality check' }, { status: 500 });
  }
}

