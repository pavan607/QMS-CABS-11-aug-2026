import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');

    let sql = `
      SELECT s.*, p.name as project_name, p.code as project_code,
        (SELECT COUNT(*) FROM lrus WHERE subsystem_id = s.id) as lru_count
      FROM subsystems s
      JOIN projects p ON s.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (projectId) {
      sql += ` AND s.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    sql += ' ORDER BY p.code, s.code';

    const result = await query(sql, params);
    return NextResponse.json({ subsystems: result.rows });
  } catch (error) {
    console.error('Error fetching subsystems:', error);
    return NextResponse.json({ error: 'Failed to fetch subsystems' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await query('SELECT id, role FROM users WHERE id = $1', [(session.user as any).id]);
    if (currentUser.rows[0]?.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { project_id, name, code, description, status } = body;

    if (!project_id || !name || !code) {
      return NextResponse.json({ error: 'Project, name, and code are required' }, { status: 400 });
    }

    const projectExists = await query('SELECT id FROM projects WHERE id = $1', [project_id]);
    if (projectExists.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const existing = await query(
      'SELECT id FROM subsystems WHERE project_id = $1 AND code = $2',
      [project_id, code.toUpperCase()]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'A subsystem with this code already exists in this project' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO subsystems (project_id, name, code, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [project_id, name, code.toUpperCase(), description || null, status || 'active', currentUser.rows[0].id]
    );

    return NextResponse.json({ subsystem: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating subsystem:', error);
    return NextResponse.json({ error: 'Failed to create subsystem' }, { status: 500 });
  }
}
