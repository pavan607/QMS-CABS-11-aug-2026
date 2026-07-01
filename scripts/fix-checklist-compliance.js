/**
 * Script to fix checklist item compliance status
 * Run this to update existing checklist items with correct is_compliant values
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixChecklistCompliance() {
  const client = await pool.connect();
  
  try {
    console.log('Starting checklist compliance fix...\n');

    // Check current state
    const beforeResult = await client.query(`
      SELECT 
        status,
        is_compliant,
        COUNT(*) as count
      FROM checklist_items
      GROUP BY status, is_compliant
      ORDER BY status, is_compliant
    `);

    console.log('Current state:');
    console.table(beforeResult.rows);

    // Fix passed items with incorrect compliance
    const passedResult = await client.query(`
      UPDATE checklist_items
      SET is_compliant = true,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'passed' 
        AND (is_compliant IS NULL OR is_compliant = false)
      RETURNING id, item_number, status, is_compliant
    `);

    console.log(`\nFixed ${passedResult.rowCount} passed items to is_compliant = true`);
    if (passedResult.rows.length > 0) {
      console.log('Sample fixed items:');
      console.table(passedResult.rows.slice(0, 5));
    }

    // Fix failed items with incorrect compliance
    const failedResult = await client.query(`
      UPDATE checklist_items
      SET is_compliant = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'failed' 
        AND (is_compliant IS NULL OR is_compliant = true)
      RETURNING id, item_number, status, is_compliant
    `);

    console.log(`\nFixed ${failedResult.rowCount} failed items to is_compliant = false`);
    if (failedResult.rows.length > 0) {
      console.log('Sample fixed items:');
      console.table(failedResult.rows.slice(0, 5));
    }

    // Reset pending/na items
    const resetResult = await client.query(`
      UPDATE checklist_items
      SET is_compliant = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE status IN ('pending', 'na') 
        AND is_compliant IS NOT NULL
      RETURNING id, item_number, status, is_compliant
    `);

    console.log(`\nReset ${resetResult.rowCount} pending/na items to is_compliant = NULL`);

    // Check final state
    const afterResult = await client.query(`
      SELECT 
        status,
        is_compliant,
        COUNT(*) as count
      FROM checklist_items
      GROUP BY status, is_compliant
      ORDER BY status, is_compliant
    `);

    console.log('\nFinal state:');
    console.table(afterResult.rows);

    console.log('\n✅ Checklist compliance fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing checklist compliance:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fix
fixChecklistCompliance().catch(error => {
  console.error('Failed to fix checklist compliance:', error);
  process.exit(1);
});

