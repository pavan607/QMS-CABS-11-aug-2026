import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET dashboard statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get counts
    const documentsCount = await query('SELECT COUNT(*) as count FROM documents');
    const checksCount = await query('SELECT COUNT(*) as count FROM quality_checks');
    const usersCount = await query('SELECT COUNT(*) as count FROM users WHERE status = $1', ['active']);
    const reportsCount = await query('SELECT COUNT(*) as count FROM reports');

    // Get recent documents
    const recentDocuments = await query(
      `SELECT d.*, dc.name as category_name, u.name as uploaded_by_name
       FROM documents d
       LEFT JOIN document_categories dc ON d.category_id = dc.id
       LEFT JOIN users u ON d.uploaded_by = u.id
       ORDER BY d.created_at DESC
       LIMIT 5`
    );

    // Get recent quality checks
    const recentChecks = await query(
      `SELECT qc.*, u.name as inspector_name
       FROM quality_checks qc
       LEFT JOIN users u ON qc.inspector_id = u.id
       ORDER BY qc.created_at DESC
       LIMIT 5`
    );

    return NextResponse.json({
      stats: {
        documents: parseInt(documentsCount.rows[0].count),
        quality_checks: parseInt(checksCount.rows[0].count),
        users: parseInt(usersCount.rows[0].count),
        reports: parseInt(reportsCount.rows[0].count),
      },
      recent: {
        documents: recentDocuments.rows,
        checks: recentChecks.rows,
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard statistics' }, { status: 500 });
  }
}

