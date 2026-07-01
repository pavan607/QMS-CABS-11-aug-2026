import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
        COUNT(CASE WHEN role = 'administrator' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'request_approver' THEN 1 END) as request_approver_count,
        COUNT(CASE WHEN role = 'qa_approver' THEN 1 END) as qa_approver_count,
        COUNT(CASE WHEN role = 'inspector' THEN 1 END) as inspector_count,
        COUNT(CASE WHEN role = 'initiator' THEN 1 END) as initiator_count,
        COUNT(CASE WHEN designation = 'GD' THEN 1 END) as gd_count,
        COUNT(CASE WHEN designation = 'DGD' THEN 1 END) as dgd_count,
        COUNT(CASE WHEN designation = 'DH' THEN 1 END) as dh_count,
        COUNT(CASE WHEN designation = 'TH' THEN 1 END) as th_count,
        COUNT(CASE WHEN designation = 'Designer' THEN 1 END) as designer_count
       FROM users`
    );

    return NextResponse.json({ stats: statsResult.rows[0] });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
