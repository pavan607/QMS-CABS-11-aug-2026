import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET quality check statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereClause += ` AND check_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND check_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_checks,
        COUNT(CASE WHEN result = 'passed' THEN 1 END) as passed_count,
        COUNT(CASE WHEN result = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending_count,
        AVG(CASE WHEN score IS NOT NULL THEN score END) as average_score
       FROM quality_checks ${whereClause}`,
      params
    );

    return NextResponse.json({ stats: statsResult.rows[0] });
  } catch (error) {
    console.error('Error fetching quality check stats:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}

