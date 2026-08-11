import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission, UserRole } from '@/lib/permissions';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const VALID_CATEGORIES = ['definition', 'guideline', 'procedure', 'reference'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    if (!hasPermission(userRole, 'help_desk', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const status = searchParams.get('status') || 'active';

    let sql = `
      SELECT
        h.*,
        u.name as uploaded_by_name
      FROM help_desk_resources h
      LEFT JOIN users u ON h.uploaded_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (h.title ILIKE $${paramIndex} OR h.description ILIKE $${paramIndex} OR h.content ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category && VALID_CATEGORIES.includes(category as any)) {
      sql += ` AND h.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status && status !== 'all') {
      sql += ` AND h.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ' ORDER BY h.category ASC, h.title ASC';

    const result = await query(sql, params);
    return NextResponse.json({ resources: result.rows });
  } catch (error) {
    console.error('Error fetching help desk resources:', error);
    return NextResponse.json({ error: 'Failed to fetch help desk resources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    const userId = parseInt((session.user as any).id);

    if (!hasPermission(userRole, 'help_desk', 'create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const title = (formData.get('title') as string)?.trim();
    const description = (formData.get('description') as string)?.trim() || null;
    const content = (formData.get('content') as string)?.trim() || null;
    const category = (formData.get('category') as string) || 'guideline';
    const status = (formData.get('status') as string) || 'active';
    const file = formData.get('file') as File | null;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!VALID_CATEGORIES.includes(category as any)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    if (!content && !file) {
      return NextResponse.json(
        { error: 'Provide either definition/guideline text or upload a file' },
        { status: 400 }
      );
    }

    let fileName: string | null = null;
    let filePath: string | null = null;
    let fileType: string | null = null;
    let fileSize: number | null = null;

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
      }

      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'help_desk');
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storedName = `${timestamp}_${sanitizedFileName}`;
      const absolutePath = join(uploadsDir, storedName);
      const publicPath = `/uploads/help_desk/${storedName}`;

      const bytes = await file.arrayBuffer();
      await writeFile(absolutePath, Buffer.from(bytes));

      fileName = file.name;
      filePath = publicPath;
      fileType = file.type || 'application/octet-stream';
      fileSize = file.size;
    }

    const result = await query(
      `INSERT INTO help_desk_resources
         (title, description, content, category, file_name, file_path, file_type, file_size, status, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, description, content, category, fileName, filePath, fileType, fileSize, status, userId]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'CREATE', 'help_desk', result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    return NextResponse.json({ resource: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating help desk resource:', error);
    return NextResponse.json({ error: 'Failed to create help desk resource' }, { status: 500 });
  }
}
