import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

function slugCodeFromName(name: string): string {
  const base = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
  return base || 'item';
}

async function uniqueCodeForGroup(groupId: number, base: string): Promise<string> {
  let code = base.slice(0, 100);
  let n = 0;
  for (;;) {
    const existing = await query(
      'SELECT id FROM inspection_type_items WHERE group_id = $1 AND code = $2',
      [groupId, code]
    );
    if (existing.rows.length === 0) return code;
    n += 1;
    code = `${base}_${n}`.slice(0, 100);
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
    const { group_id, name, code, description, sort_order, status } = body;

    if (!group_id || !name || !String(name).trim()) {
      return NextResponse.json({ error: 'Group and name are required' }, { status: 400 });
    }

    const groupExists = await query('SELECT id FROM inspection_type_groups WHERE id = $1', [group_id]);
    if (groupExists.rows.length === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const codeRaw = typeof code === 'string' ? code.trim() : '';
    const resolvedCode = codeRaw
      ? codeRaw.toLowerCase()
      : await uniqueCodeForGroup(Number(group_id), slugCodeFromName(String(name)));

    const result = await query(
      `INSERT INTO inspection_type_items (group_id, name, code, description, sort_order, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        group_id,
        String(name).trim(),
        resolvedCode,
        description || null,
        sort_order || 0,
        status || 'active',
        currentUser.rows[0].id,
      ]
    );

    return NextResponse.json({ item: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating inspection type item:', error);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
