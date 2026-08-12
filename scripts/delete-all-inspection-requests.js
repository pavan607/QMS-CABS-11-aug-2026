/**
 * Delete ALL inspection request data (IRs + related child rows / attachments / notifications).
 * Usage: node scripts/delete-all-inspection-requests.js
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function tableExists(client, name) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [name]
  );
  return !!r.rows[0]?.exists;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const before = await client.query('SELECT COUNT(*)::int AS n FROM inspection_requests');
    console.log(`Inspection requests before delete: ${before.rows[0].n}`);

    // Observation chats linked to IRs
    if (await tableExists(client, 'observation_threads')) {
      if (await tableExists(client, 'observation_messages')) {
        const m = await client.query(
          `DELETE FROM observation_messages
           WHERE thread_id IN (
             SELECT id FROM observation_threads WHERE inspection_request_id IS NOT NULL
           )`
        );
        console.log(`Deleted observation_messages: ${m.rowCount}`);
      }
      if (await tableExists(client, 'observation_thread_reads')) {
        const r = await client.query(
          `DELETE FROM observation_thread_reads
           WHERE thread_id IN (
             SELECT id FROM observation_threads WHERE inspection_request_id IS NOT NULL
           )`
        );
        console.log(`Deleted observation_thread_reads: ${r.rowCount}`);
      }
      const t = await client.query(
        `DELETE FROM observation_threads WHERE inspection_request_id IS NOT NULL`
      );
      console.log(`Deleted observation_threads: ${t.rowCount}`);
    }

    // Polymorphic children (no FK cascade)
    if (await tableExists(client, 'attachments')) {
      const a = await client.query(
        `DELETE FROM attachments WHERE entity_type = 'inspection_request'`
      );
      console.log(`Deleted attachments: ${a.rowCount}`);
    }
    if (await tableExists(client, 'notifications')) {
      const n = await client.query(
        `DELETE FROM notifications
         WHERE entity_type IN ('inspection_request', 'observation_thread')`
      );
      console.log(`Deleted notifications: ${n.rowCount}`);
    }
    if (await tableExists(client, 'audit_logs')) {
      const al = await client.query(
        `DELETE FROM audit_logs WHERE entity_type = 'inspection_request'`
      );
      console.log(`Deleted audit_logs: ${al.rowCount}`);
    }
    if (await tableExists(client, 'reports')) {
      // Only if reports are tied to IRs via metadata/columns — skip if no link column
      const cols = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'reports' AND column_name IN ('inspection_request_id', 'entity_id')`
      );
      const names = cols.rows.map((r) => r.column_name);
      if (names.includes('inspection_request_id')) {
        const r = await client.query(`DELETE FROM reports WHERE inspection_request_id IS NOT NULL`);
        console.log(`Deleted reports: ${r.rowCount}`);
      }
    }

    // Parent table — cascades checklist/items/activities where ON DELETE CASCADE is set
    const ir = await client.query(`DELETE FROM inspection_requests`);
    console.log(`Deleted inspection_requests: ${ir.rowCount}`);

    // Reset request-number sequence if present
    try {
      await client.query(`ALTER SEQUENCE inspection_requests_id_seq RESTART WITH 1`);
      console.log('Reset inspection_requests_id_seq to 1');
    } catch (e) {
      console.log('Sequence reset skipped:', e.message);
    }

    await client.query('COMMIT');

    const after = await client.query('SELECT COUNT(*)::int AS n FROM inspection_requests');
    console.log(`Inspection requests after delete: ${after.rows[0].n}`);
    console.log('Done.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
