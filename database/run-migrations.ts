import { query } from '../lib/db';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  try {
    console.log('Running database migrations...');

    // Read and run migration 001
    const migration001 = readFileSync(
      join(__dirname, 'migrations', '001_add_inspection_request_fields.sql'),
      'utf-8'
    );
    console.log('Running migration 001_add_inspection_request_fields.sql...');
    await query(migration001, []);
    console.log('✓ Migration 001 completed');

    // Read and run migration 002
    const migration002 = readFileSync(
      join(__dirname, 'migrations', '002_add_closure_feature.sql'),
      'utf-8'
    );
    console.log('Running migration 002_add_closure_feature.sql...');
    await query(migration002, []);
    console.log('✓ Migration 002 completed');

    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();

