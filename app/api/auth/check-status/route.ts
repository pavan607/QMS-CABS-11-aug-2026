import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { normalizeEmployeeId } from '@/lib/employee-id';

export async function POST(request: NextRequest) {
  try {
    const { employee_id } = await request.json();

    if (!employee_id) {
      return NextResponse.json({ inactive: false });
    }

    const id = normalizeEmployeeId(String(employee_id));
    if (!id) {
      return NextResponse.json({ inactive: false });
    }

    const result = await query(
      `SELECT status FROM users WHERE UPPER(TRIM(COALESCE(employee_id, ''))) = $1`,
      [id]
    );

    const isInactive = result.rows.length > 0 && result.rows[0].status !== 'active';

    return NextResponse.json({ inactive: isInactive });
  } catch (error) {
    console.error('Error checking user status:', error);
    return NextResponse.json({ inactive: false });
  }
}
