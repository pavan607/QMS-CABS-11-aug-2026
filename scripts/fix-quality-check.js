const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixQualityCheck() {
  try {
    console.log('🔧 Fixing quality check result...\n');

    // Update quality check with ID 5 from 'failed' to 'passed'
    const result = await pool.query(
      `UPDATE quality_checks 
       SET result = 'passed' 
       WHERE id = 5 
       RETURNING id, name, result, score, check_date`
    );

    if (result.rows.length > 0) {
      console.log('✅ Quality check updated successfully:');
      console.table(result.rows);
      
      // Verify the update
      const verify = await pool.query(
        `SELECT 
          COUNT(*) as total_checks,
          COUNT(CASE WHEN result = 'passed' THEN 1 END) as passed_count,
          COUNT(CASE WHEN result = 'failed' THEN 1 END) as failed_count,
          COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending_count
        FROM quality_checks`
      );
      
      console.log('\n📊 Updated Quality Check Stats:');
      console.table(verify.rows);
    } else {
      console.log('⚠️  No quality check found with ID 5');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing quality check:', error);
    await pool.end();
    process.exit(1);
  }
}

fixQualityCheck();

