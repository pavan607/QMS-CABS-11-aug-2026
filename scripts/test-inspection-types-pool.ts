/**
 * Verifies inspection-type dropdown data + Postgres pool safety.
 * Run: npm run test:inspection-types-pool
 *
 * Does not modify application data. Does not print secrets.
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { encode } from 'next-auth/jwt';

const BASE = process.env.NEXTAUTH_URL || 'http://127.0.0.1:3000';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Must match `auth.config.ts` cookie name for http:// (non-secure) sessions. */
function sessionCookieName() {
  const url = process.env.AUTH_URL || process.env.NEXTAUTH_URL || '';
  if (url.startsWith('https://') || process.env.AUTH_COOKIE_SECURE === 'true') {
    return '__Secure-next-auth.session-token';
  }
  return 'next-auth.session-token';
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function connStats(client: pg.Pool | pg.PoolClient) {
  const r = await client.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE state = 'idle')::int AS idle,
      count(*) FILTER (WHERE state = 'active')::int AS active,
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn
    FROM pg_stat_activity
    WHERE datname = current_database()
  `);
  return r.rows[0] as { total: number; idle: number; active: number; max_conn: number };
}

/** Same queries the IR form API uses (`/api/inspection-types?active_only=true`). */
async function fetchActiveInspectionTypeGroups(client: pg.Pool) {
  const groupSql = `
    SELECT * FROM inspection_type_groups
    WHERE status = 'active'
    ORDER BY sort_order, name
  `;
  const itemSql = `
    SELECT i.*, g.name as group_name
    FROM inspection_type_items i
    JOIN inspection_type_groups g ON i.group_id = g.id
    WHERE i.status = 'active' AND g.status = 'active'
    ORDER BY g.sort_order, g.name, i.sort_order, i.name
  `;
  const [groupsResult, itemsResult] = await Promise.all([
    client.query(groupSql),
    client.query(itemSql),
  ]);
  return groupsResult.rows.map((group: { id: number }) => ({
    ...group,
    items: itemsResult.rows.filter((item: { group_id: number }) => item.group_id === group.id),
  }));
}

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 5000,
    allowExitOnIdle: true,
  });
  pool.on('error', (err) => console.error('[test pool]', err.message));

  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const pass = (name: string, detail?: string) => {
    results.push({ name, ok: true, detail });
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const fail = (name: string, err: unknown) => {
    results.push({ name, ok: false, detail: String(err) });
    console.error(`  ✗ ${name}: ${err}`);
  };

  console.log('\n=== Inspection Types + Pool Safety ===\n');

  try {
    // 1) Master data for IR points 12/14
    try {
      const groups = await fetchActiveInspectionTypeGroups(pool);
      const withItems = groups.filter((g) => g.items.length > 0);
      assert(withItems.length > 0, 'No active inspection type groups with items');
      const totalItems = withItems.reduce((n, g) => n + g.items.length, 0);
      pass('Active inspection types exist', `${withItems.length} groups, ${totalItems} items`);
    } catch (e) {
      fail('Active inspection types exist', e);
    }

    // 2) API-equivalent query path under concurrency (what the dropdown loads)
    try {
      const before = await connStats(pool);
      const runs = await Promise.all(
        Array.from({ length: 20 }, () => fetchActiveInspectionTypeGroups(pool)),
      );
      assert(runs.every((g) => g.length > 0), 'Some concurrent fetches returned empty groups');
      const after = await connStats(pool);
      assert(after.total < after.max_conn, `Connections at limit: ${after.total}/${after.max_conn}`);
      assert(
        after.total <= before.total + 6,
        `Pool leaked connections: before=${before.total} after=${after.total}`,
      );
      pass(
        'API-equivalent query under concurrent load',
        `20 runs, groups=${runs[0].length}, conns ${before.total}→${after.total}`,
      );
    } catch (e) {
      fail('API-equivalent query under concurrent load', e);
    }

    // 3) lib/db safeguards still present (prior changes preserved)
    try {
      const src = await fs.readFile(path.join(ROOT, 'lib/db.ts'), 'utf8');
      assert(src.includes('__qmsPgPool'), 'missing global singleton');
      assert(/max:\s*Number\(process\.env\.PG_POOL_MAX/.test(src), 'missing pool max cap');
      assert(src.includes('allowExitOnIdle'), 'missing allowExitOnIdle');
      assert(src.includes('isTransientPgError'), 'missing transient retry helper');
      assert(src.includes('53300'), 'missing too-many-clients retry');
      assert(src.includes('application_name'), 'missing application_name');
      assert(/attempts\s*=\s*5/.test(src), 'query retry attempts should be 5');
      pass('lib/db.ts pool + retry safeguards present');
    } catch (e) {
      fail('lib/db.ts pool + retry safeguards present', e);
    }

    // 4) IR form retry UI still present (prior changes preserved)
    try {
      const page = await fs.readFile(
        path.join(ROOT, 'app/dashboard/inspections/new/page.tsx'),
        'utf8',
      );
      assert(page.includes('fetchInspectionTypes'), 'missing fetchInspectionTypes');
      assert(page.includes('inspectionTypesError'), 'missing inspectionTypesError');
      assert(page.includes('maxAttempts'), 'missing retry attempts');
      assert(page.includes('Retry'), 'missing Retry button');
      assert(page.includes('InspectionStageSelect'), 'missing InspectionStageSelect');
      assert(page.includes('previous_stage_cleared'), 'missing field 12 wiring');
      assert(page.includes('inspection_stage'), 'missing field 14 wiring');
      pass('IR form fields 12/14 + retry UI intact');
    } catch (e) {
      fail('IR form fields 12/14 + retry UI intact', e);
    }

    // 5) Live HTTP against running app (mint session JWT + dropdown API)
    // Avoids depending on default passwords in this DB.
    try {
      const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
      assert(secret, 'AUTH_SECRET / NEXTAUTH_SECRET is not set');

      const userRes = await pool.query(`
        SELECT id, email, name, role, employee_id, designation
        FROM users
        WHERE status = 'active'
        ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, id
        LIMIT 1
      `);
      assert(userRes.rows.length === 1, 'No active user for session mint');
      const user = userRes.rows[0];
      const cookieName = sessionCookieName();
      const sessionToken = await encode({
        token: {
          id: String(user.id),
          sub: String(user.id),
          email: user.email || '',
          name: user.name,
          role: user.role,
          employee_id: user.employee_id,
          designation: user.designation,
        },
        secret,
        salt: cookieName,
        maxAge: 30 * 60,
      });

      const cookieHeader = `${cookieName}=${sessionToken}`;
      const sessionRes = await fetch(`${BASE}/api/auth/session`, {
        headers: { Cookie: cookieHeader },
      });
      const session = (await sessionRes.json()) as { user?: { id?: string } };
      assert(session?.user?.id, 'Minted session not accepted by /api/auth/session');
      pass('HTTP session accepted by app');

      // Server-wide headroom (pgAdmin connections count against max_connections too)
      const headroom = await pool.query(`
        SELECT
          (SELECT count(*)::int FROM pg_stat_activity) AS total_backends,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
          (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%pgAdmin%') AS pgadmin_backends
      `);
      const hr = headroom.rows[0] as {
        total_backends: number;
        max_conn: number;
        pgadmin_backends: number;
      };
      const free = hr.max_conn - hr.total_backends;
      if (free < 5) {
        console.warn(
          `  ! Low Postgres headroom: ${hr.total_backends}/${hr.max_conn} used` +
            ` (pgAdmin=${hr.pgadmin_backends}). Close unused pgAdmin tabs to prevent 53300.`,
        );
      }
      pass(
        'Postgres connection headroom checked',
        `${hr.total_backends}/${hr.max_conn} used, pgAdmin=${hr.pgadmin_backends}, free≈${free}`,
      );

      // Realistic IR form load: sequential fetches with a couple of parallel ones
      const statuses: number[] = [];
      const groupCounts: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${BASE}/api/inspection-types?active_only=true`, {
          headers: { Cookie: cookieHeader },
        });
        statuses.push(res.status);
        if (res.ok) {
          const data = await res.json();
          groupCounts.push((data.groups || []).length);
        } else {
          const body = await res.text();
          console.warn(`  ! API status ${res.status}: ${body.slice(0, 120)}`);
        }
      }
      const parallel = await Promise.all(
        [1, 2].map(() =>
          fetch(`${BASE}/api/inspection-types?active_only=true`, {
            headers: { Cookie: cookieHeader },
          }),
        ),
      );
      for (const res of parallel) {
        statuses.push(res.status);
        if (res.ok) {
          const data = await res.json();
          groupCounts.push((data.groups || []).length);
        }
      }

      assert(statuses.every((s) => s === 200), `Non-200 statuses: ${statuses.join(',')}`);
      assert(
        groupCounts.every((n) => n > 0),
        `Empty groups in API responses: ${groupCounts.join(',')}`,
      );
      pass(
        'API /api/inspection-types under realistic load',
        `${statuses.length}/${statuses.length} OK, groups=${groupCounts[0]}`,
      );
    } catch (e) {
      fail('HTTP session + inspection-types API', e);
    }
  } finally {
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${results.length - failed.length}/${results.length} passed ===\n`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
