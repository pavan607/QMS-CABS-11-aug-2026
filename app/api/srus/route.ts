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
    const lruId = searchParams.get('lru_id');
    const subsystemId = searchParams.get('subsystem_id');
    const projectId = searchParams.get('project_id');

    let sql = `
      SELECT sr.*, l.name as lru_name, l.code as lru_code,
        s.name as subsystem_name, s.code as subsystem_code,
        p.name as project_name, p.code as project_code
      FROM srus sr
      JOIN lrus l ON sr.lru_id = l.id
      JOIN subsystems s ON l.subsystem_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (lruId) {
      sql += ` AND sr.lru_id = $${paramIndex}`;
      params.push(lruId);
      paramIndex++;
    }

    if (subsystemId) {
      sql += ` AND l.subsystem_id = $${paramIndex}`;
      params.push(subsystemId);
      paramIndex++;
    }

    if (projectId) {
      sql += ` AND s.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    sql += ' ORDER BY p.code, s.code, l.code, sr.code';

    const result = await query(sql, params);
    return NextResponse.json({ srus: result.rows });
  } catch (error) {
    console.error('Error fetching SRUs:', error);
    return NextResponse.json({ error: 'Failed to fetch SRUs' }, { status: 500 });
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
    const { lru_id, name, code, part_number, description, status, serial_numbers } = body;

    if (!lru_id || !name || !code) {
      return NextResponse.json({ error: 'LRU, name, and code are required' }, { status: 400 });
    }

    const lruExists = await query('SELECT id FROM lrus WHERE id = $1', [lru_id]);
    if (lruExists.rows.length === 0) {
      return NextResponse.json({ error: 'LRU not found' }, { status: 404 });
    }

    const existing = await query(
      'SELECT id FROM srus WHERE lru_id = $1 AND code = $2',
      [lru_id, code.toUpperCase()]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An SRU with this code already exists in this LRU' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO srus (lru_id, name, code, part_number, description, status, created_by, serial_numbers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [lru_id, name, code.toUpperCase(), part_number || null, description || null, status || 'active', currentUser.rows[0].id, JSON.stringify(serial_numbers || [])]
    );

    return NextResponse.json({ sru: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating SRU:', error);
    return NextResponse.json({ error: 'Failed to create SRU' }, { status: 500 });
  }
}
