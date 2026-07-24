import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createNotification } from '@/lib/notifications';
import {
  getObservationThreadById,
  sendObservationMessage,
  fetchInspectionForChatAccess,
  canAccessObservationChat,
  canReplyObservationChat,
  collectObservationStakeholderIds,
  type ObservationMessageAttachment,
} from '@/lib/observation-chats';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function saveChatAttachment(file: File): Promise<ObservationMessageAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('File size exceeds 10MB limit');
  }

  const uploadsDir = join(process.cwd(), 'public', 'uploads', 'observation_chat');
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${timestamp}_${sanitizedFileName}`;
  const filePath = join(uploadsDir, fileName);
  const publicPath = `/uploads/observation_chat/${fileName}`;

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  return {
    file_name: file.name,
    file_path: publicPath,
    file_type: file.type || 'application/octet-stream',
    file_size: file.size,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as { id?: string }).id || '0', 10);
    const userRole = (session.user as { role?: string }).role || 'initiator';
    const employeeId = (session.user as { employee_id?: string }).employee_id;
    const senderName = (session.user as { name?: string }).name || 'User';
    const { threadId: threadIdParam } = await params;
    const threadId = parseInt(threadIdParam, 10);

    const contentType = request.headers.get('content-type') || '';
    let message = '';
    let attachment: ObservationMessageAttachment | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      message = String(formData.get('message') || '');
      const file = formData.get('file');
      if (file instanceof File && file.size > 0) {
        attachment = await saveChatAttachment(file);
      }
    } else {
      const body = await request.json();
      message = String(body.message || '');
    }

    if (!message.trim() && !attachment) {
      return NextResponse.json({ error: 'Message or attachment is required' }, { status: 400 });
    }

    const thread = await getObservationThreadById(threadId);
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const ir = await fetchInspectionForChatAccess(thread.inspection_request_id);
    if (!ir) {
      return NextResponse.json({ error: 'Inspection request not found' }, { status: 404 });
    }

    const allowed = await canAccessObservationChat(userId, userRole, ir, employeeId);
    if (!allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const canReply = await canReplyObservationChat(userId, userRole, thread.part, ir);
    if (!canReply) {
      return NextResponse.json(
        { error: 'Only the initiator and assigned inspectors can reply to this observation' },
        { status: 403 }
      );
    }

    const newMessage = await sendObservationMessage(threadId, userId, message, attachment);

    const preview = (thread.observation_preview || 'Observation').slice(0, 80);
    const notifyTitle = `Observation chat — ${ir.request_number || 'IR'}`;
    const notifyBody = attachment
      ? `${senderName}: ${message.trim() || `sent a file (${attachment.file_name})`}`.slice(0, 120)
      : `${senderName}: ${message.trim().slice(0, 120)}`;

    const recipientIds = new Set(collectObservationStakeholderIds(ir, userId));

    await Promise.all(
      [...recipientIds].map((recipientId) =>
        createNotification({
          userId: recipientId,
          title: notifyTitle,
          message: `${preview} — ${notifyBody}`,
          type: 'info',
          entityType: 'observation_thread',
          entityId: threadId,
        }).catch(() => {})
      )
    );

    return NextResponse.json({ message: newMessage });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send message';
    console.error('Error sending observation message:', error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
