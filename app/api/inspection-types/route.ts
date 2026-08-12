import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import {
  filterInspectionTypeGroupsBySource,
  normalizeSourceValue,
} from '@/lib/inspection-display';

function parseApplicableSources(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const list = raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    return list.length ? list : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Postgres may return "{a,b}" as text in some drivers
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1);
      if (!inner) return null;
      const list = inner
        .split(',')
        .map((s) => s.replace(/^"|"$/g, '').trim().toLowerCase())
        .filter(Boolean);
      return list.length ? list : null;
    }
    return [trimmed.toLowerCase()];
  }
  return null;
}

// GET all groups with their items (used by both admin page and inspection form dropdown)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get('active_only') === 'true';
    const sourceFilter = normalizeSourceValue(searchParams.get('source') || '');

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
        g.applicable_sources,
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

    let groups = result.rows.map((row: { items: unknown; applicable_sources?: unknown }) => ({
      ...row,
      applicable_sources: parseApplicableSources(row.applicable_sources),
      items: Array.isArray(row.items) ? row.items : [],
    }));

    if (sourceFilter) {
      groups = filterInspectionTypeGroupsBySource(groups, sourceFilter);
    }

    const items = groups.flatMap((g: { items: unknown[] }) => g.items);

    return NextResponse.json({ groups, items });
  } catch (error) {
    console.error('Error fetching inspection types:', error);
    const msg = error instanceof Error ? error.message : '';
    if (/applicable_sources/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'Inspection type source mapping is not installed. Run database migrations (024_source_applicable_inspection_stages).',
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: 'Failed to fetch inspection types' }, { status: 500 });
  }
}
