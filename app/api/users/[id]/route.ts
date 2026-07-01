import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const result = await query(
      `      SELECT u.id, u.employee_id, u.email, u.name, u.role, u.designation, u.scientist_rank,
              u.status, u.phone, u.department, u.contact_number, u.signature_path,
              u.reporting_to, u.last_active, u.created_at,
              mgr.name as reporting_to_name, mgr.employee_id as reporting_to_employee_id
       FROM users u
       LEFT JOIN users mgr ON u.reporting_to = mgr.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
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

    const { id } = await params;

    const currentUser = await query('SELECT id, role FROM users WHERE id = $1', [(session.user as any).id]);
    const currentUserId = currentUser.rows[0]?.id;
    const isAdmin = currentUser.rows[0]?.role === 'administrator';
    
    if (!isAdmin && currentUserId !== parseInt(id)) {
      return NextResponse.json({ error: 'Forbidden - Can only update own profile' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, employee_id, role, designation, scientist_rank, department, reporting_to, status, password, contact_number } = body;

    const oldUser = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (oldUser.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!isAdmin && (role || status || designation || reporting_to !== undefined)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required to change role, designation, or status' }, { status: 403 });
    }

    if (employee_id && employee_id !== oldUser.rows[0].employee_id) {
      const dup = await query('SELECT id FROM users WHERE employee_id = $1 AND id != $2', [employee_id.toUpperCase(), id]);
      if (dup.rows.length > 0) {
        return NextResponse.json({ error: 'Employee ID already in use' }, { status: 400 });
      }
    }

    if (email !== undefined) {
      const emailTrimmed = typeof email === 'string' ? email.trim() : '';
      const emailValue = emailTrimmed || null;
      if (emailValue && emailValue !== oldUser.rows[0].email) {
        const dup = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [emailValue, id]);
        if (dup.rows.length > 0) {
          return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
        }
      }
    }

    let sql = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    const params_arr: any[] = [];
    let paramIndex = 1;

    const addField = (field: string, value: any) => {
      sql += `, ${field} = $${paramIndex}`;
      params_arr.push(value);
      paramIndex++;
    };

    const mergedDesignation =
      designation !== undefined && isAdmin ? designation : oldUser.rows[0].designation;
    const isOsDirector = mergedDesignation === 'OS & Director';

    if (name) addField('name', name);
    if (email !== undefined) {
      const emailTrimmed = typeof email === 'string' ? email.trim() : '';
      addField('email', emailTrimmed || null);
    }
    if (employee_id && isAdmin) addField('employee_id', employee_id.toUpperCase());
    if (role && isAdmin) addField('role', role);
    if (designation !== undefined && isAdmin) addField('designation', designation || null);
    const canEditScientistRank = isAdmin || currentUserId === parseInt(id);
    if (scientist_rank !== undefined && canEditScientistRank) addField('scientist_rank', scientist_rank || null);
    if (isOsDirector) {
      addField('department', null);
    } else if (department !== undefined) {
      addField('department', department || null);
    }
    if (reporting_to !== undefined && isAdmin) addField('reporting_to', reporting_to || null);
    if (status && isAdmin) addField('status', status);

    if (contact_number !== undefined) addField('contact_number', contact_number || null);

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      addField('password', hashedPassword);
    }

    sql += ` WHERE id = $${paramIndex} RETURNING id, employee_id, email, name, role, designation, scientist_rank, department, reporting_to, status, contact_number, signature_path, created_at`;
    params_arr.push(id);

    const result = await query(sql, params_arr);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [currentUserId, 'UPDATE', 'user', id, JSON.stringify(oldUser.rows[0]), JSON.stringify(result.rows[0])]
    );

    return NextResponse.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
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

    const { id } = await params;

    const currentUser = await query('SELECT id, role FROM users WHERE id = $1', [(session.user as any).id]);
    if (currentUser.rows[0]?.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    if (currentUser.rows[0].id === parseInt(id)) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const user = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (user.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [currentUser.rows[0].id, 'DELETE', 'user', id, JSON.stringify(user.rows[0])]
    );

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
