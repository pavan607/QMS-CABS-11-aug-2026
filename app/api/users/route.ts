import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { R_QA_DEPARTMENT } from '@/lib/rqa-users';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    /** Comma-separated roles, e.g. `inspector,qa_approver` (OR match). */
    const roles = searchParams.get('roles');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const designation = searchParams.get('designation');
    const department = searchParams.get('department');
    const reporting_to = searchParams.get('reporting_to');

    let sql = `
      SELECT u.id, u.employee_id, u.email, u.name, u.role, u.designation, u.scientist_rank,
             u.status, u.phone, u.department, u.contact_number, u.signature_path,
             u.reporting_to, u.last_active, u.created_at,
             mgr.name as reporting_to_name, mgr.employee_id as reporting_to_employee_id,
             (SELECT COUNT(*) FROM users r WHERE r.reporting_to = u.id) as direct_report_count
      FROM users u
      LEFT JOIN users mgr ON u.reporting_to = mgr.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (reporting_to === 'null') {
      sql += ` AND u.reporting_to IS NULL`;
    } else if (reporting_to) {
      sql += ` AND u.reporting_to = $${paramIndex}`;
      params.push(parseInt(reporting_to));
      paramIndex++;
    }

    if (roles) {
      const roleList = roles
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      if (roleList.length > 0) {
        sql += ` AND u.role = ANY($${paramIndex}::text[])`;
        params.push(roleList);
        paramIndex++;
      }
    } else if (role) {
      sql += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (designation) {
      sql += ` AND TRIM(COALESCE(u.designation, '')) = $${paramIndex}`;
      params.push(designation.trim());
      paramIndex++;
    }

    if (department) {
      const dept =
        department.trim().toUpperCase() === 'R&QA' || department.trim() === R_QA_DEPARTMENT
          ? R_QA_DEPARTMENT
          : department.trim();
      sql += ` AND TRIM(COALESCE(u.department, '')) = $${paramIndex}`;
      params.push(dept);
      paramIndex++;
    }

    if (status) {
      sql += ` AND u.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (u.name ILIKE $${paramIndex} OR u.employee_id ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ' ORDER BY u.designation ASC NULLS LAST, u.name ASC';

    const result = await query(sql, params);
    
    return NextResponse.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
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
    const { employee_id, email, name, password, role, designation, scientist_rank, department, reporting_to, status, contact_number } = body;

    if (!employee_id || !name || !password) {
      return NextResponse.json({ error: 'Employee ID, name, and password are required' }, { status: 400 });
    }

    const emailTrimmed = typeof email === 'string' ? email.trim() : '';
    const emailValue = emailTrimmed || null;

    const existingEmpId = await query('SELECT id FROM users WHERE employee_id = $1', [employee_id.toUpperCase()]);
    if (existingEmpId.rows.length > 0) {
      return NextResponse.json({ error: 'User with this Employee ID already exists' }, { status: 400 });
    }

    if (emailValue) {
      const existingEmail = await query('SELECT id FROM users WHERE email = $1', [emailValue]);
      if (existingEmail.rows.length > 0) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const departmentValue = designation === 'OS & Director' ? null : department || null;

    const result = await query(
      `INSERT INTO users (employee_id, email, name, password, role, designation, scientist_rank, department, reporting_to, status, contact_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, employee_id, email, name, role, designation, scientist_rank, department, reporting_to, status, contact_number, created_at`,
      [
        employee_id.toUpperCase(), emailValue, name, hashedPassword,
        role || 'initiator', designation || null, scientist_rank || null,
        departmentValue, reporting_to || null, status || 'active',
        contact_number || null,
      ]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [currentUser.rows[0].id, 'CREATE', 'user', result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    return NextResponse.json({ user: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
