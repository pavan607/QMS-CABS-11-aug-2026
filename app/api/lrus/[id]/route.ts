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

async function uniqueLruCodeForSubsystem(subsystemId: number, base: string, excludeId: number): Promise<string> {
  let code = base.slice(0, 50);
  let n = 0;
  for (;;) {
    const existing = await query(
      'SELECT id FROM lrus WHERE subsystem_id = $1 AND code = $2 AND id != $3',
      [subsystemId, code, excludeId]
    );
    if (existing.rows.length === 0) return code;
    n += 1;
    code = `${base}-${n}`.slice(0, 50);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await query('SELECT id, role FROM users WHERE id = $1', [(session.user as any).id]);
    if (currentUser.rows[0]?.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, code, part_number, description, status, serial_numbers } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const current = await query('SELECT subsystem_id, code FROM lrus WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'LRU not found' }, { status: 404 });
    }

    const subsystemId = current.rows[0].subsystem_id;
    const codeRaw = typeof code === 'string' ? code.trim() : '';
    const resolvedCode = codeRaw
      ? codeRaw.toUpperCase()
      : current.rows[0].code ||
        (await uniqueLruCodeForSubsystem(subsystemId, slugCodeFromName(String(name)), Number(id)));

    const duplicate = await query(
      'SELECT id FROM lrus WHERE subsystem_id = $1 AND code = $2 AND id != $3',
      [subsystemId, resolvedCode, id]
    );
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'An LRU with this code already exists in this subsystem' }, { status: 400 });
    }

    const result = await query(
      `UPDATE lrus SET name = $1, code = $2, part_number = $3, description = $4, status = $5, serial_numbers = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [String(name).trim(), resolvedCode, part_number || null, description || null, status || 'active', JSON.stringify(serial_numbers || []), id]
    );

    return NextResponse.json({ lru: result.rows[0] });
  } catch (error) {
    console.error('Error updating LRU:', error);
    return NextResponse.json({ error: 'Failed to update LRU' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const currentUser = await query('SELECT id, role FROM users WHERE id = $1', [(session.user as any).id]);
    if (currentUser.rows[0]?.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    const result = await query('DELETE FROM lrus WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'LRU not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'LRU deleted successfully' });
  } catch (error) {
    console.error('Error deleting LRU:', error);
    return NextResponse.json({ error: 'Failed to delete LRU' }, { status: 500 });
  }
}
