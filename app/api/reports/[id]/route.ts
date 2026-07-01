import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET single report
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
        r.*,
        rt.name as type_name,
        rt.description as type_description,
        u.name as generated_by_name
       FROM reports r
       LEFT JOIN report_types rt ON r.type_id = rt.id
       LEFT JOIN users u ON r.generated_by = u.id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ report: result.rows[0] });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

// PUT update report
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
    const { name, description, status, data } = body;

    // Get user id
    const userResult = await query('SELECT id FROM users WHERE id = $1', [(session.user as any).id]);
    const userId = userResult.rows[0]?.id;

    // Get old values for audit
    const oldReport = await query('SELECT * FROM reports WHERE id = $1', [id]);
    
    if (oldReport.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const result = await query(
      `UPDATE reports 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           data = COALESCE($4, data),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, description, status, data ? JSON.stringify(data) : null, id]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'UPDATE', 'report', id, JSON.stringify(oldReport.rows[0]), JSON.stringify(result.rows[0])]
    );

    return NextResponse.json({ report: result.rows[0] });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
  }
}

// DELETE report
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

    // Get report for audit
    const report = await query('SELECT * FROM reports WHERE id = $1', [id]);
    
    if (report.rows.length === 0) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    await query('DELETE FROM reports WHERE id = $1', [id]);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'report', id, JSON.stringify(report.rows[0])]
    );

    return NextResponse.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 });
  }
}

