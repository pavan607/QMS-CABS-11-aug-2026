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

    // Single round-trip: uses one pooled connection instead of two concurrent ones
    // (important when Postgres is near max_connections due to pgAdmin / other tools).
    const result = await query(
      `
      SELECT
        g.id,
        g.name,
        g.description,
        g.sort_order,
        g.status,
        g.created_by,
        g.created_at,
        g.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'group_id', i.group_id,
              'name', i.name,
              'code', i.code,
              'description', i.description,
              'sort_order', i.sort_order,
              'status', i.status,
              'created_by', i.created_by,
              'created_at', i.created_at,
              'updated_at', i.updated_at,
              'group_name', g.name
            )
            ORDER BY i.sort_order, i.name
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM inspection_type_groups g
      LEFT JOIN inspection_type_items i
        ON i.group_id = g.id
        ${activeOnly ? "AND i.status = 'active'" : ''}
      ${activeOnly ? "WHERE g.status = 'active'" : ''}
      GROUP BY g.id
      ORDER BY g.sort_order, g.name
      `,
    );

    const groups = result.rows.map((row: { items: unknown }) => ({
      ...row,
      items: Array.isArray(row.items) ? row.items : [],
    }));
    const items = groups.flatMap((g: { items: unknown[] }) => g.items);

    return NextResponse.json({ groups, items });
  } catch (error) {
    console.error('Error fetching inspection types:', error);
    return NextResponse.json({ error: 'Failed to fetch inspection types' }, { status: 500 });
  }
}
