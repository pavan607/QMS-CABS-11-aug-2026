import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET all report types
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await query('SELECT * FROM report_types ORDER BY name');
    
    return NextResponse.json({ types: result.rows });
  } catch (error) {
    console.error('Error fetching report types:', error);
    return NextResponse.json({ error: 'Failed to fetch report types' }, { status: 500 });
  }
}

