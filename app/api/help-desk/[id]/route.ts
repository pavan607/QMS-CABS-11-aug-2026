import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { hasPermission, UserRole } from '@/lib/permissions';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const VALID_CATEGORIES = ['definition', 'guideline', 'procedure', 'reference'] as const;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function deleteStoredFile(publicPath: string | null) {
  if (!publicPath) return;
  const absolutePath = join(process.cwd(), 'public', publicPath);
  if (existsSync(absolutePath)) {
    try {
      await unlink(absolutePath);
    } catch (error) {
      console.error('Error deleting help desk file:', error);
    }
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    if (!hasPermission(userRole, 'help_desk', 'read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const result = await query(
      `SELECT h.*, u.name as uploaded_by_name
       FROM help_desk_resources h
       LEFT JOIN users u ON h.uploaded_by = u.id
       WHERE h.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ resource: result.rows[0] });
  } catch (error) {
    console.error('Error fetching help desk resource:', error);
    return NextResponse.json({ error: 'Failed to fetch help desk resource' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    const userId = parseInt((session.user as any).id);

    if (!hasPermission(userRole, 'help_desk', 'update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await query('SELECT * FROM help_desk_resources WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const current = existing.rows[0];
    const formData = await request.formData();
    const title = (formData.get('title') as string)?.trim() || current.title;
    const description = formData.has('description')
      ? ((formData.get('description') as string)?.trim() || null)
      : current.description;
    const content = formData.has('content')
      ? ((formData.get('content') as string)?.trim() || null)
      : current.content;
    const category = (formData.get('category') as string) || current.category;
    const status = (formData.get('status') as string) || current.status;
    const removeFile = formData.get('remove_file') === 'true';
    const file = formData.get('file') as File | null;

    if (!VALID_CATEGORIES.includes(category as any)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    let fileName = current.file_name;
    let filePath = current.file_path;
    let fileType = current.file_type;
    let fileSize = current.file_size;

    if (removeFile && !file) {
      await deleteStoredFile(current.file_path);
      fileName = null;
      filePath = null;
      fileType = null;
      fileSize = null;
    }

    if (file && file.size > 0) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
      }

      await deleteStoredFile(current.file_path);

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

    if (!content && !filePath) {
      return NextResponse.json(
        { error: 'Provide either definition/guideline text or upload a file' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE help_desk_resources
       SET title = $1,
           description = $2,
           content = $3,
           category = $4,
           file_name = $5,
           file_path = $6,
           file_type = $7,
           file_size = $8,
           status = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [title, description, content, category, fileName, filePath, fileType, fileSize, status, id]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'UPDATE', 'help_desk', id, JSON.stringify(current), JSON.stringify(result.rows[0])]
    );

    return NextResponse.json({ resource: result.rows[0] });
  } catch (error) {
    console.error('Error updating help desk resource:', error);
    return NextResponse.json({ error: 'Failed to update help desk resource' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role as UserRole;
    const userId = parseInt((session.user as any).id);

    if (!hasPermission(userRole, 'help_desk', 'delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await query('SELECT * FROM help_desk_resources WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const resource = existing.rows[0];
    await deleteStoredFile(resource.file_path);
    await query('DELETE FROM help_desk_resources WHERE id = $1', [id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'help_desk', id, JSON.stringify(resource)]
    );

    return NextResponse.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Error deleting help desk resource:', error);
    return NextResponse.json({ error: 'Failed to delete help desk resource' }, { status: 500 });
  }
}
