import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

/** Latest Part I draft for the current user (for resume on /inspections/new). */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as { id?: string }).id || '0', 10);
    if (!userId) {
      return NextResponse.json({ request: null });
    }

    const result = await query(
      `SELECT id, request_number, status, updated_at
       FROM inspection_requests
       WHERE initiator_id = $1 AND status = 'draft'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    );

    return NextResponse.json({ request: result.rows[0] || null });
  } catch (error) {
    console.error('Error fetching inspection draft:', error);
    return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
  }
}
