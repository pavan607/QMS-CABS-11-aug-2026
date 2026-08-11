import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  listObservationThreadsForUser,
  ensureObservationChatTables,
} from '@/lib/observation-chats';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as { id?: string }).id || '0', 10);
    const userRole = (session.user as { role?: string }).role || 'initiator';
    const designation = (session.user as { designation?: string }).designation;
    const excludeClosed = request.nextUrl.searchParams.get('exclude_closed') === 'true';

    await ensureObservationChatTables();
    const threads = await listObservationThreadsForUser(userId, userRole, {
      excludeClosed,
      designation,
    });

    const openCount = threads.filter((t) => !t.is_closed).length;
    const unreadCount = threads.reduce((sum, t) => sum + (Number(t.unread_count) || 0), 0);

    return NextResponse.json({ threads, openCount, unreadCount });
  } catch (error) {
    console.error('Error listing observation chats:', error);
    return NextResponse.json({ error: 'Failed to fetch observation chats' }, { status: 500 });
  }
}
