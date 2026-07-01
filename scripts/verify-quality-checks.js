const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function verifyQualityChecks() {
  try {
    console.log('🔍 Verifying quality checks data...\n');

    // Check if inspector_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'quality_checks' 
      AND column_name IN ('inspector_id', 'inspection_request_id')
      ORDER BY column_name;
    `);
    
    console.log('✅ Column structure:');
    columnCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });
    console.log('');

    // Count quality checks without inspector
    const withoutInspector = await pool.query(`
      SELECT COUNT(*) as count
      FROM quality_checks
      WHERE inspector_id IS NULL;
    `);
    
    console.log(`📊 Quality checks without inspector: ${withoutInspector.rows[0].count}`);

    // Count quality checks without inspection request
    const withoutRequest = await pool.query(`
      SELECT COUNT(*) as count
      FROM quality_checks
      WHERE inspection_request_id IS NULL;
    `);
    
    console.log(`📊 Quality checks without inspection request: ${withoutRequest.rows[0].count}`);

    // Show sample data
    const sampleData = await pool.query(`
      SELECT 
        qc.id,
        qc.name,
        qc.inspector_id,
        qc.inspection_request_id,
        u.name as inspector_name,
        ir.request_number
      FROM quality_checks qc
      LEFT JOIN users u ON qc.inspector_id = u.id
      LEFT JOIN inspection_requests ir ON qc.inspection_request_id = ir.id
      ORDER BY qc.created_at DESC
      LIMIT 5;
    `);

    console.log('\n📋 Sample quality checks (latest 5):');
    if (sampleData.rows.length === 0) {
      console.log('   No quality checks found in database');
    } else {
      sampleData.rows.forEach(row => {
        console.log(`   - ID ${row.id}: ${row.name}`);
        console.log(`     Inspector: ${row.inspector_name || 'Unassigned'} (ID: ${row.inspector_id || 'NULL'})`);
        console.log(`     Request: ${row.request_number || 'Not linked'} (ID: ${row.inspection_request_id || 'NULL'})`);
        console.log('');
      });
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying quality checks:', error);
    await pool.end();
    process.exit(1);
  }
}

verifyQualityChecks();

