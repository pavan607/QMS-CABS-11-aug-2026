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
    const { name, code, description, sort_order, status } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const current = await query('SELECT group_id, code FROM inspection_type_items WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    const groupId = current.rows[0].group_id as number;
    const codeRaw = typeof code === 'string' ? code.trim() : '';
    const resolvedCode = codeRaw ? codeRaw.toLowerCase() : String(current.rows[0].code);

    if (codeRaw) {
      const duplicate = await query(
        'SELECT id FROM inspection_type_items WHERE group_id = $1 AND code = $2 AND id != $3',
        [groupId, resolvedCode, id]
      );
      if (duplicate.rows.length > 0) {
        return NextResponse.json({ error: 'An item with this code already exists in this group' }, { status: 400 });
      }
    }

    const result = await query(
      `UPDATE inspection_type_items
       SET name = $1, code = $2, description = $3, sort_order = $4, status = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [String(name).trim(), resolvedCode, description || null, sort_order || 0, status || 'active', id]
    );

    return NextResponse.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Error updating inspection type item:', error);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
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

    const result = await query('DELETE FROM inspection_type_items WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inspection type item:', error);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
