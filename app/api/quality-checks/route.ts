import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET all quality checks
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const inspector = searchParams.get('inspector');
    const result = searchParams.get('result');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let sql = `
      SELECT 
        qc.*,
        u.name as inspector_name,
        qct.name as template_name,
        creator.name as created_by_name,
        ir.request_number as inspection_request_number,
        ir.title as inspection_request_title,
        ir.status as inspection_request_status
      FROM quality_checks qc
      LEFT JOIN users u ON qc.inspector_id = u.id
      LEFT JOIN quality_check_templates qct ON qc.template_id = qct.id
      LEFT JOIN users creator ON qc.created_by = creator.id
      LEFT JOIN inspection_requests ir ON qc.inspection_request_id = ir.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (inspector) {
      sql += ` AND qc.inspector_id = $${paramIndex}`;
      params.push(inspector);
      paramIndex++;
    }

    if (result) {
      sql += ` AND qc.result = $${paramIndex}`;
      params.push(result);
      paramIndex++;
    }

    if (startDate) {
      sql += ` AND qc.check_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND qc.check_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    sql += ' ORDER BY qc.check_date DESC, qc.created_at DESC';

    const dbResult = await query(sql, params);
    
    // Fetch attachments for each quality check
    const checksWithAttachments = await Promise.all(
      dbResult.rows.map(async (check) => {
        const attachmentsResult = await query(
          `SELECT 
            a.*,
            u.name as uploaded_by_name
          FROM attachments a
          LEFT JOIN users u ON a.uploaded_by = u.id
          WHERE a.entity_type = 'quality_check' AND a.entity_id = $1
          ORDER BY a.created_at DESC`,
          [check.id]
        );
        return {
          ...check,
          attachments: attachmentsResult.rows
        };
      })
    );
    
    return NextResponse.json({ checks: checksWithAttachments });
  } catch (error) {
    console.error('Error fetching quality checks:', error);
    return NextResponse.json({ error: 'Failed to fetch quality checks' }, { status: 500 });
  }
}

// POST create new quality check
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, template_id, inspector_id, inspection_request_id, check_date, score, result, notes, findings } = body;

    if (!name || !check_date || !inspection_request_id) {
      return NextResponse.json({ error: 'Name, check date, and inspection request are required' }, { status: 400 });
    }

    // Get user id
    const userResult = await query('SELECT id FROM users WHERE id = $1', [(session.user as any).id]);
    const userId = userResult.rows[0]?.id;

    // Validate that the inspection request exists
    const inspectionRequestResult = await query(
      'SELECT id FROM inspection_requests WHERE id = $1',
      [inspection_request_id]
    );
    
    if (inspectionRequestResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid inspection request' }, { status: 400 });
    }

    // Determine result based on score if not provided
    let finalResult = result;
    if (!finalResult && score !== null && score !== undefined) {
      const passingScoreResult = await query(
        `SELECT value FROM settings WHERE key = 'default_passing_score'`
      );
      const passingScore = parseInt(passingScoreResult.rows[0]?.value || '70');
      finalResult = score >= passingScore ? 'passed' : 'failed';
    }

    const dbResult = await query(
      `INSERT INTO quality_checks (name, template_id, inspector_id, inspection_request_id, check_date, score, result, notes, findings, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, template_id || null, inspector_id || null, inspection_request_id, check_date, score || null, finalResult || 'pending', notes || null, findings ? JSON.stringify(findings) : null, userId]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'CREATE', 'quality_check', dbResult.rows[0].id, JSON.stringify(dbResult.rows[0])]
    );

    return NextResponse.json({ check: dbResult.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating quality check:', error);
    return NextResponse.json({ error: 'Failed to create quality check' }, { status: 500 });
  }
}

