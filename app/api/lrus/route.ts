import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

function slugCodeFromName(name: string): string {
  const base = String(name)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return base || 'LRU';
}

async function uniqueLruCodeForSubsystem(subsystemId: number, base: string): Promise<string> {
  let code = base.slice(0, 50);
  let n = 0;
  for (;;) {
    const existing = await query(
      'SELECT id FROM lrus WHERE subsystem_id = $1 AND code = $2',
      [subsystemId, code]
    );
    if (existing.rows.length === 0) return code;
    n += 1;
    code = `${base}-${n}`.slice(0, 50);
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const subsystemId = searchParams.get('subsystem_id');
    const projectId = searchParams.get('project_id');

    const srusTableExists = await query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'srus') as exists`
    );
    const hasSrus = srusTableExists.rows[0]?.exists;

    let sql = `
      SELECT l.*, s.name as subsystem_name, s.code as subsystem_code,
        p.name as project_name, p.code as project_code
        ${hasSrus ? ", (SELECT COUNT(*) FROM srus WHERE lru_id = l.id) as sru_count" : ", '0' as sru_count"}
      FROM lrus l
      JOIN subsystems s ON l.subsystem_id = s.id
      JOIN projects p ON s.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

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

    sql += ' ORDER BY p.code, s.code, l.code';

    const result = await query(sql, params);
    return NextResponse.json({ lrus: result.rows });
  } catch (error) {
    console.error('Error fetching LRUs:', error);
    return NextResponse.json({ error: 'Failed to fetch LRUs' }, { status: 500 });
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
    const { subsystem_id, name, code, part_number, description, status, serial_numbers } = body;

    if (!subsystem_id || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'Subsystem and name are required' }, { status: 400 });
    }

    const subsystemExists = await query('SELECT id FROM subsystems WHERE id = $1', [subsystem_id]);
    if (subsystemExists.rows.length === 0) {
      return NextResponse.json({ error: 'Subsystem not found' }, { status: 404 });
    }

    const codeRaw = typeof code === 'string' ? code.trim() : '';
    const resolvedCode = codeRaw
      ? codeRaw.toUpperCase()
      : await uniqueLruCodeForSubsystem(Number(subsystem_id), slugCodeFromName(String(name)));

    const existing = await query(
      'SELECT id FROM lrus WHERE subsystem_id = $1 AND code = $2',
      [subsystem_id, resolvedCode]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'An LRU with this code already exists in this subsystem' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO lrus (subsystem_id, name, code, part_number, description, status, created_by, serial_numbers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [subsystem_id, String(name).trim(), resolvedCode, part_number || null, description || null, status || 'active', currentUser.rows[0].id, JSON.stringify(serial_numbers || [])]
    );

    return NextResponse.json({ lru: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating LRU:', error);
    return NextResponse.json({ error: 'Failed to create LRU' }, { status: 500 });
  }
}
