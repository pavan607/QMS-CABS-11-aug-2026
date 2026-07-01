require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // Show users
  const users = await pool.query("SELECT id, name, role, department, employee_id, designation FROM users WHERE status='active' ORDER BY role, id");
  console.log('=== ACTIVE USERS ===');
  users.rows.forEach(u => console.log(`  [${u.id}] ${u.name} | role: ${u.role} | dept: ${u.department} | emp: ${u.employee_id} | desg: ${u.designation}`));

  // Delete all IRs and related data
  console.log('\n=== DELETING ALL IRs ===');
  await pool.query('DELETE FROM inspection_activities');
  await pool.query('DELETE FROM checklist_items');
  await pool.query('DELETE FROM inspection_checklists');
  await pool.query('DELETE FROM attachments WHERE entity_type = $1', ['inspection_request']);
  await pool.query('DELETE FROM notifications WHERE entity_type = $1', ['inspection_request']);
  const del = await pool.query('DELETE FROM inspection_requests RETURNING id');
  console.log(`Deleted ${del.rowCount} inspection requests and all related data`);

  // Verify
  const remaining = await pool.query('SELECT COUNT(*) as cnt FROM inspection_requests');
  console.log(`Remaining IRs: ${remaining.rows[0].cnt}`);

  pool.end();
}

run().catch(e => { console.error(e); pool.end(); });
