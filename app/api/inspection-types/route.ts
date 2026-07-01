import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';

// GET all groups with their items (used by both admin page and inspection form dropdown)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active_only') === 'true';

    let groupSql = 'SELECT * FROM inspection_type_groups';
    if (activeOnly) groupSql += " WHERE status = 'active'";
    groupSql += ' ORDER BY sort_order, name';

    let itemSql = `
      SELECT i.*, g.name as group_name
      FROM inspection_type_items i
      JOIN inspection_type_groups g ON i.group_id = g.id
    `;
    if (activeOnly) itemSql += " WHERE i.status = 'active' AND g.status = 'active'";
    itemSql += ' ORDER BY g.sort_order, g.name, i.sort_order, i.name';

    const [groupsResult, itemsResult] = await Promise.all([
      query(groupSql),
      query(itemSql),
    ]);

    const groups = groupsResult.rows.map((group: any) => ({
      ...group,
      items: itemsResult.rows.filter((item: any) => item.group_id === group.id),
    }));

    return NextResponse.json({ groups, items: itemsResult.rows });
  } catch (error) {
    console.error('Error fetching inspection types:', error);
    return NextResponse.json({ error: 'Failed to fetch inspection types' }, { status: 500 });
  }
}
