import 'dotenv/config';
import { Pool } from 'pg';
import { resolveDatabaseUrl } from '@/lib/database-url';

declare global {
  // Persist across Next.js HMR so we don't leak a new Pool on every reload.
  // eslint-disable-next-line no-var
  var __qmsPgPool: Pool | undefined;
}

function createPool() {
  const isDev = process.env.NODE_ENV !== 'production';
  // Dev/HMR can spawn multiple module graphs; keep the pool tiny so we stay
  // under Postgres max_connections (error 53300: too many clients already).
  // Other tools (esp. pgAdmin) often consume most of the server-wide limit.
  const defaultMax = isDev ? 3 : 10;
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(),
    max: Number(process.env.PG_POOL_MAX || defaultMax),
    idleTimeoutMillis: isDev ? 5_000 : 30_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: isDev,
    application_name: process.env.PG_APP_NAME || 'qms-app',
  });

  // Prevent idle-client errors from crashing the process; they are expected
  // when Postgres closes connections under pressure.
  pool.on('error', (err) => {
    console.error('[pg pool] unexpected idle client error:', err.message);
  });

  return pool;
}

const pool = globalThis.__qmsPgPool ?? createPool();
globalThis.__qmsPgPool = pool;

function isTransientPgError(err: unknown): boolean {
  const e = err as { code?: string; message?: string; errno?: number };
  const code = String(e?.code || '');
  const msg = String(e?.message || '').toLowerCase();
  return (
    code === '53300' || // too many clients
    code === '57P01' || // admin shutdown
    code === '57P03' || // cannot connect now
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    msg.includes('too many clients') ||
    msg.includes('connection terminated') ||
    msg.includes('server closed the connection')
  );
}

function retryDelayMs(err: unknown, attempt: number): number {
  const code = String((err as { code?: string })?.code || '');
  // Connection exhaustion needs longer backoff so other clients can free slots.
  if (code === '53300' || String((err as Error)?.message || '').includes('too many clients')) {
    return attempt * 750;
  }
  return attempt * 250;
}

// Convenience function for queries — retries transient connection failures so
// IR dropdowns (and other callers) recover instead of staying empty.
export async function query(text: string, params?: any[], attempts = 5) {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      lastError = err;
      if (!isTransientPgError(err) || i === attempts) throw err;
      const delayMs = retryDelayMs(err, i);
      console.warn(
        `[pg query] transient error (attempt ${i}/${attempts}), retrying in ${delayMs}ms:`,
        (err as Error)?.message || err,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

export default pool;
