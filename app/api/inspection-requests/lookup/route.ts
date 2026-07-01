import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { query } from '@/lib/db';
import { normalizeInspectionDateTimeFields } from '@/lib/inspection-display';

/**
 * GET /api/inspection-requests/lookup?lru_id=&serial_number=&exclude_id=
 * Returns the most recent non-draft inspection request for the given LRU/SRU + serial number
 * so Part I fields can be auto-filled on a new request.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const lruId = searchParams.get('lru_id');
    const serialNumber = (searchParams.get('serial_number') || '').trim();
    const excludeId = searchParams.get('exclude_id');

    if (!lruId || !serialNumber) {
      return NextResponse.json(
        { error: 'lru_id and serial_number are required' },
        { status: 400 }
      );
    }

    const params: (string | number)[] = [lruId, serialNumber];
    let paramIndex = 3;

    let excludeClause = '';
    if (excludeId) {
      excludeClause = ` AND ir.id <> $${paramIndex}`;
      params.push(excludeId);
      paramIndex++;
    }

    const result = await query(
      `SELECT ir.*
       FROM inspection_requests ir
       WHERE ir.lru_id = $1
         AND ir.status <> 'draft'
         ${excludeClause}
         AND EXISTS (
           SELECT 1
           FROM unnest(string_to_array(COALESCE(ir.serial_number, ''), ',')) AS s(sn)
           WHERE TRIM(s.sn) = $2
         )
       ORDER BY ir.updated_at DESC NULLS LAST, ir.created_at DESC
       LIMIT 1`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ request: null });
    }

    const inspectionRequest = normalizeInspectionDateTimeFields(result.rows[0]);
    return NextResponse.json({ request: inspectionRequest });
  } catch (error) {
    console.error('Error looking up inspection request:', error);
    return NextResponse.json({ error: 'Failed to lookup inspection request' }, { status: 500 });
  }
}
