const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`🔄 Running ${files.length} database migration(s)...\n`);

    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      console.log(`Running: ${file}`);
      await pool.query(sql);
      console.log(`✅ ${file} completed\n`);
    }

    console.log('✅ All migrations completed successfully!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
