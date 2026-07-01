import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query(
      `SELECT DISTINCT u.id, u.name, u.designation
       FROM users u
       INNER JOIN inspection_requests ir ON ir.initiator_id = u.id
       WHERE u.status = 'active'
       ORDER BY u.name`,
      []
    );

    return NextResponse.json({ initiators: result.rows });
  } catch (error) {
    console.error('Error fetching initiators:', error);
    return NextResponse.json({ error: 'Failed to fetch initiators' }, { status: 500 });
  }
}
