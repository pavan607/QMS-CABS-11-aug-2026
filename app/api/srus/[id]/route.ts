import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

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

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const current = await query('SELECT lru_id FROM srus WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'SRU not found' }, { status: 404 });
    }

    const duplicate = await query(
      'SELECT id FROM srus WHERE lru_id = $1 AND code = $2 AND id != $3',
      [current.rows[0].lru_id, code.toUpperCase(), id]
    );
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'An SRU with this code already exists in this LRU' }, { status: 400 });
    }

    const result = await query(
      `UPDATE srus SET name = $1, code = $2, part_number = $3, description = $4, status = $5, serial_numbers = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [name, code.toUpperCase(), part_number || null, description || null, status || 'active', JSON.stringify(serial_numbers || []), id]
    );

    return NextResponse.json({ sru: result.rows[0] });
  } catch (error) {
    console.error('Error updating SRU:', error);
    return NextResponse.json({ error: 'Failed to update SRU' }, { status: 500 });
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

    const result = await query('DELETE FROM srus WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'SRU not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'SRU deleted successfully' });
  } catch (error) {
    console.error('Error deleting SRU:', error);
    return NextResponse.json({ error: 'Failed to delete SRU' }, { status: 500 });
  }
}
