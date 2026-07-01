import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET attachments (filter by entity)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    let sql = `
      SELECT 
        a.*,
        u.name as uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (entityType) {
      sql += ` AND a.entity_type = $${paramIndex}`;
      params.push(entityType);
      paramIndex++;
    }

    if (entityId) {
      sql += ` AND a.entity_id = $${paramIndex}`;
      params.push(entityId);
      paramIndex++;
    }

    sql += ' ORDER BY a.created_at DESC';

    const result = await query(sql, params);

    return NextResponse.json({ attachments: result.rows });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
  }
}

// POST upload attachment
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const entityType = formData.get('entity_type') as string;
    const entityId = formData.get('entity_id') as string;
    const description = formData.get('description') as string;

    if (!file || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'File, entity type, and entity ID are required' },
        { status: 400 }
      );
    }

    if (entityType === 'inspection_request') {
      const userRole = (session.user as any).role;
      const irResult = await query(
        `SELECT initiator_id, inspector_id, ordaqa_inspector_id, status FROM inspection_requests WHERE id = $1`,
        [parseInt(entityId)]
      );
      if (irResult.rows.length === 0) {
        return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
      }
      const ir = irResult.rows[0];
      if (['completed', 'closed'].includes(ir.status)) {
        return NextResponse.json({ error: 'Cannot upload attachments to a completed IR' }, { status: 403 });
      }
      const isInitiator = ir.initiator_id === userId;
      const isAssignedInspector = ir.inspector_id === userId || ir.ordaqa_inspector_id === userId;
      if (userRole === 'inspector' && !isAssignedInspector) {
        return NextResponse.json({ error: 'Only an assigned inspector can upload attachments' }, { status: 403 });
      }
      if (!['inspector', 'administrator', 'qa_approver', 'qa_head'].includes(userRole) && !isInitiator) {
        return NextResponse.json({ error: 'You do not have permission to upload attachments to this IR' }, { status: 403 });
      }
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', entityType);
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;
    const filePath = join(uploadsDir, fileName);
    const publicPath = `/uploads/${entityType}/${fileName}`;

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Save to database
    const result = await query(
      `INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_type, file_size, description, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        entityType,
        parseInt(entityId),
        file.name,
        publicPath,
        file.type,
        file.size,
        description || null,
        userId,
      ]
    );

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'UPLOAD', 'attachment', result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    // Create activity if it's for an inspection request
    if (entityType === 'inspection_request') {
      await query(
        `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          entityId,
          'photo_uploaded',
          `File "${file.name}" uploaded`,
          userId,
          JSON.stringify({ attachment_id: result.rows[0].id, file_name: file.name }),
        ]
      );
    } else if (entityType === 'checklist_item') {
      // Get the inspection request id from the checklist item
      const itemResult = await query(
        `SELECT ic.inspection_request_id 
         FROM checklist_items ci
         LEFT JOIN inspection_checklists ic ON ci.checklist_id = ic.id
         WHERE ci.id = $1`,
        [entityId]
      );

      if (itemResult.rows.length > 0) {
        await query(
          `INSERT INTO inspection_activities (inspection_request_id, activity_type, description, user_id, data)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            itemResult.rows[0].inspection_request_id,
            'photo_uploaded',
            `Evidence "${file.name}" uploaded for checklist item`,
            userId,
            JSON.stringify({ attachment_id: result.rows[0].id, file_name: file.name }),
          ]
        );
      }
    }

    return NextResponse.json({ attachment: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: 'Failed to upload attachment' }, { status: 500 });
  }
}

