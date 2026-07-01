/**
 * Set every user's password to the same new value (bcrypt hash, same as auth).
 * Use only in dev / recovery — everyone shares one password until they change it.
 *
 * Usage:
 *   npx tsx database/reset-all-passwords.ts --yes [NEW_PASSWORD]
 *   NEW_PASSWORD can be omitted; defaults to env RESET_PASSWORD or "admin123".
 *
 * Examples:
 *   RESET_PASSWORD='TempOnly!9' npx tsx database/reset-all-passwords.ts --yes
 *   npx tsx database/reset-all-passwords.ts --yes 'MySharedReset123'
 */
import 'dotenv/config';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

async function main() {
  const args = process.argv.slice(2);
  const yes = args.includes('--yes');
  const rest = args.filter((a) => a !== '--yes');
  const newPassword =
    rest[0] || process.env.RESET_PASSWORD || 'cabs123';

  if (!yes) {
    console.error(
      'Refusing to run without --yes (sets one password for ALL users).'
    );
    console.error(
      'Usage: npx tsx database/reset-all-passwords.ts --yes [NEW_PASSWORD]'
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or .env.local.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(newPassword, 10);

  const result = await pool.query(
    `UPDATE users
     SET password = $1, updated_at = CURRENT_TIMESTAMP`,
    [hash]
  );

  console.log(`Password updated for ${result.rowCount} user(s).`);
  console.log('Everyone must log in with the new password and change it if required.');
  if (newPassword === 'admin123') {
    console.warn('(Using default admin123 — not for production.)');
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
