/**
 * Reset a user's password by employee_id (bcrypt hash, same as auth).
 *
 * Usage:
 *   npx tsx database/reset-password.ts <EMPLOYEE_ID> [NEW_PASSWORD]
 *   NEW_PASSWORD can be omitted; defaults to env RESET_PASSWORD or "admin123".
 *
 * Examples:
 *   npx tsx database/reset-password.ts ORDI001
 *   npx tsx database/reset-password.ts ORDI001 'MySecurePass!9'
 */
import 'dotenv/config';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const employeeId = (process.argv[2] || '').trim().toUpperCase();
  const fromEnv = process.env.RESET_PASSWORD;
  const newPassword =
    process.argv[3] || fromEnv || 'admin123';

  if (!employeeId) {
    console.error('Usage: npx tsx database/reset-password.ts <EMPLOYEE_ID> [NEW_PASSWORD]');
    console.error('   Or set RESET_PASSWORD in the environment when omitting the second argument.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or .env.local.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const result = await pool.query(
    `UPDATE users
     SET password = $1, updated_at = CURRENT_TIMESTAMP
     WHERE UPPER(TRIM(employee_id)) = $2
     RETURNING id, employee_id, email, name, role`,
    [hash, employeeId]
  );

  if (result.rowCount === 0) {
    console.error(`No user found with employee_id matching "${employeeId}".`);
    await pool.end();
    process.exit(1);
  }

  const u = result.rows[0];
  console.log('Password updated successfully.');
  console.log(`  id: ${u.id}`);
  console.log(`  employee_id: ${u.employee_id}`);
  console.log(`  email: ${u.email}`);
  console.log(`  name: ${u.name}`);
  console.log(`  role: ${u.role}`);
  console.log('');
  console.log('Log in with the email above and the new password you set.');
  if (newPassword === 'admin123') {
    console.log('(Using default admin123 — change it after login in production.)');
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
