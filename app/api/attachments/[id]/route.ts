import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { canDeleteOwn } from '@/lib/permissions';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// DELETE attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: attachmentId } = await params;
    const userRole = (session.user as any).role;
    const userId = parseInt((session.user as any).id);

    // Get existing attachment
    const existingResult = await query(
      `SELECT * FROM attachments WHERE id = $1`,
      [attachmentId]
    );

    if (existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const attachment = existingResult.rows[0];

    // For inspection request attachments: block if IR is completed/closed
    if (attachment.entity_type === 'inspection_request') {
      const irResult = await query(
        `SELECT inspector_id, ordaqa_inspector_id, status FROM inspection_requests WHERE id = $1`,
        [attachment.entity_id]
      );
      if (irResult.rows.length > 0) {
        const ir = irResult.rows[0];
        if (['completed', 'closed'].includes(ir.status)) {
          return NextResponse.json({ error: 'Cannot delete attachments from a completed IR' }, { status: 403 });
        }
        if (userRole === 'inspector' && ir.inspector_id !== userId && ir.ordaqa_inspector_id !== userId) {
          return NextResponse.json({ error: 'Only an assigned inspector can delete attachments' }, { status: 403 });
        }
      }
    }

    // Check permissions - only owner or admin can delete
    if (!canDeleteOwn(userRole, userId, attachment.uploaded_by)) {
      return NextResponse.json(
        { error: 'Forbidden - You can only delete your own attachments' },
        { status: 403 }
      );
    }

    // Delete file from filesystem
    const filePath = join(process.cwd(), 'public', attachment.file_path);
    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
        // Continue even if file deletion fails
      }
    }

    // Delete from database
    await query(`DELETE FROM attachments WHERE id = $1`, [attachmentId]);

    // Log the action
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'DELETE', 'attachment', attachmentId, JSON.stringify(attachment)]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 });
  }
}

