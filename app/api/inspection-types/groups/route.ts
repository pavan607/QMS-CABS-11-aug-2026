import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

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
    const { name, description, sort_order, status, applicable_sources } = body;

    if (!name) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    const sources =
      Array.isArray(applicable_sources) && applicable_sources.length > 0
        ? applicable_sources.map((s: unknown) => String(s).trim().toLowerCase()).filter(Boolean)
        : null;

    const result = await query(
      `INSERT INTO inspection_type_groups (name, description, sort_order, status, applicable_sources, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description || null, sort_order || 0, status || 'active', sources, currentUser.rows[0].id]
    );

    return NextResponse.json({ group: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating inspection type group:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
