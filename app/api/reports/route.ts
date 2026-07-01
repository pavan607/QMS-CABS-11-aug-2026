import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET all reports
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');

    let sql = `
      SELECT 
        r.*,
        rt.name as type_name,
        u.name as generated_by_name
      FROM reports r
      LEFT JOIN report_types rt ON r.type_id = rt.id
      LEFT JOIN users u ON r.generated_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (type) {
      sql += ` AND rt.name = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status) {
      sql += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY r.created_at DESC';

    const result = await query(sql, params);
    
    return NextResponse.json({ reports: result.rows });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}

// POST create/generate new report
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type_id, description, period_start, period_end, status, data } = body;

    if (!name || !type_id) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
    }

    // Get user id
    const userResult = await query('SELECT id FROM users WHERE id = $1', [(session.user as any).id]);
    const userId = userResult.rows[0]?.id;

    const result = await query(
      `INSERT INTO reports (name, type_id, description, period_start, period_end, status, data, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, type_id, description || null, period_start || null, period_end || null, status || 'draft', data ? JSON.stringify(data) : null, userId]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'CREATE', 'report', result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    return NextResponse.json({ report: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating report:', error);
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}

