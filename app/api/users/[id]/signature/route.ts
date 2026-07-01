import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const currentUser = await query('SELECT id, role FROM users WHERE id = $1', [(session.user as any).id]);
    const isAdmin = currentUser.rows[0]?.role === 'administrator';
    const isSelf = currentUser.rows[0]?.id === parseInt(id);

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('signature') as File;

    if (!file) {
      return NextResponse.json({ error: 'Signature file is required' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG and JPEG images are allowed for signatures' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Signature file must be under 2MB' }, { status: 400 });
    }

    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'signatures');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `sig_${id}_${Date.now()}.${ext}`;
    const filePath = join(uploadsDir, fileName);
    const publicPath = `/uploads/signatures/${fileName}`;

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    await query('UPDATE users SET signature_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [publicPath, id]);

    return NextResponse.json({ signature_path: publicPath });
  } catch (error) {
    console.error('Error uploading signature:', error);
    return NextResponse.json({ error: 'Failed to upload signature' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const currentUser = await query('SELECT id, role FROM users WHERE id = $1', [(session.user as any).id]);
    const isAdmin = currentUser.rows[0]?.role === 'administrator';
    const isSelf = currentUser.rows[0]?.id === parseInt(id);

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await query('UPDATE users SET signature_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Signature removed' });
  } catch (error) {
    console.error('Error removing signature:', error);
    return NextResponse.json({ error: 'Failed to remove signature' }, { status: 500 });
  }
}
