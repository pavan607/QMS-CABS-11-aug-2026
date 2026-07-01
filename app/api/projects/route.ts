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
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    let sql = `
      SELECT p.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM subsystems WHERE project_id = p.id) as subsystem_count,
        (SELECT COUNT(*) FROM lrus l JOIN subsystems s ON l.subsystem_id = s.id WHERE s.project_id = p.id) as lru_count,
        (SELECT COUNT(*) FROM srus sr JOIN lrus l2 ON sr.lru_id = l2.id JOIN subsystems s2 ON l2.subsystem_id = s2.id WHERE s2.project_id = p.id) as sru_count
      FROM projects p
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (p.name ILIKE $${paramIndex} OR p.code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status && status !== 'all') {
      sql += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    return NextResponse.json({ projects: result.rows });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
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
    const { name, code, description, status } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM projects WHERE code = $1', [code.toUpperCase()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'A project with this code already exists' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO projects (name, code, description, status, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, code.toUpperCase(), description || null, status || 'active', currentUser.rows[0].id]
    );

    return NextResponse.json({ project: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
