import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET user's notifications
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);
    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    // TIMESTAMP WITHOUT TIME ZONE is stored in the DB session timezone
    // (often not IST). Re-interpret as that zone so JSON gets a correct UTC instant
    // and the UI "Xm ago" is not skewed (e.g. ~12.5h for America/Los_Angeles vs IST).
    let sql = `
      SELECT
        id,
        user_id,
        title,
        message,
        type,
        entity_type,
        entity_id,
        is_read,
        sent_via_email,
        email_sent_at AT TIME ZONE current_setting('TimeZone') AS email_sent_at,
        read_at AT TIME ZONE current_setting('TimeZone') AS read_at,
        created_at AT TIME ZONE current_setting('TimeZone') AS created_at
      FROM notifications
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (unreadOnly) {
      sql += ` AND is_read = false`;
    }

    sql += ` ORDER BY created_at DESC LIMIT $2`;
    params.push(limit);

    const result = await query(sql, params);

    // Get unread count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return NextResponse.json({
      notifications: result.rows,
      unreadCount: parseInt(countResult.rows[0]?.count || 0),
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST mark notifications as read
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);
    const body = await request.json();
    const { notification_ids, mark_all } = body;

    if (mark_all) {
      // Mark all notifications as read
      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND is_read = false`,
        [userId]
      );
    } else if (notification_ids && Array.isArray(notification_ids)) {
      // Mark specific notifications as read
      await query(
        `UPDATE notifications 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND id = ANY($2::int[]) AND is_read = false`,
        [userId, notification_ids]
      );
    } else {
      return NextResponse.json(
        { error: 'Either notification_ids or mark_all must be provided' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
  }
}

// DELETE all notifications for the current user
export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);

    await query(`DELETE FROM notifications WHERE user_id = $1`, [userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json({ error: 'Failed to delete notifications' }, { status: 500 });
  }
}

