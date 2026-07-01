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
    const { name, code, description, status } = body;

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and code are required' }, { status: 400 });
    }

    const current = await query('SELECT project_id FROM subsystems WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'Subsystem not found' }, { status: 404 });
    }

    const duplicate = await query(
      'SELECT id FROM subsystems WHERE project_id = $1 AND code = $2 AND id != $3',
      [current.rows[0].project_id, code.toUpperCase(), id]
    );
    if (duplicate.rows.length > 0) {
      return NextResponse.json({ error: 'A subsystem with this code already exists in this project' }, { status: 400 });
    }

    const result = await query(
      `UPDATE subsystems SET name = $1, code = $2, description = $3, status = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [name, code.toUpperCase(), description || null, status || 'active', id]
    );

    return NextResponse.json({ subsystem: result.rows[0] });
  } catch (error) {
    console.error('Error updating subsystem:', error);
    return NextResponse.json({ error: 'Failed to update subsystem' }, { status: 500 });
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

    const result = await query('DELETE FROM subsystems WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Subsystem not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Subsystem deleted successfully' });
  } catch (error) {
    console.error('Error deleting subsystem:', error);
    return NextResponse.json({ error: 'Failed to delete subsystem' }, { status: 500 });
  }
}
