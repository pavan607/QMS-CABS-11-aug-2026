import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);

    const result = await query(
      `SELECT u.id, u.employee_id, u.email, u.name, u.role, u.designation, u.scientist_rank,
              u.status, u.phone, u.department, u.position, u.contact_number, u.signature_path,
              u.reporting_to,
              u.last_active, u.created_at, u.updated_at,
              mgr.name as reporting_to_name, mgr.employee_id as reporting_to_employee_id
       FROM users u
       LEFT JOIN users mgr ON u.reporting_to = mgr.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);
    const body = await request.json();
    const { name, phone, department, position } = body;

    const existingResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateResult = await query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           department = COALESCE($3, department),
           position = COALESCE($4, position),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, employee_id, email, name, role, designation, scientist_rank, status, phone, department, position, last_active, created_at, updated_at`,
      [name, phone, department, position, userId]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'UPDATE', 'user_profile', userId, JSON.stringify(existingResult.rows[0]), JSON.stringify(updateResult.rows[0])]
    );

    return NextResponse.json({ user: updateResult.rows[0] });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ error: 'Failed to update user profile' }, { status: 500 });
  }
}
