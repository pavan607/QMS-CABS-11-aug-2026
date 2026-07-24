/**
 * Frees idle pgAdmin backends only (does not touch active queries or qms-app).
 * Run: npx tsx scripts/free-idle-pgadmin-connections.ts
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  application_name: 'qms-free-idle-pgadmin',
});

async function main() {
  const before = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM pg_stat_activity) AS total,
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
      (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%pgAdmin%') AS pgadmin
  `);
  console.log('before', before.rows[0]);

  const killed = await pool.query(`
    SELECT pg_terminate_backend(pid) AS terminated, pid, application_name, state
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
      AND application_name ILIKE '%pgAdmin%'
      AND state = 'idle'
  `);
  console.log(`terminated_idle_pgadmin=${killed.rowCount}`);

  const after = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM pg_stat_activity) AS total,
      (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
      (SELECT count(*)::int FROM pg_stat_activity WHERE application_name ILIKE '%pgAdmin%') AS pgadmin
  `);
  console.log('after', after.rows[0]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
