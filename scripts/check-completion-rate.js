const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkCompletionRate() {
  try {
    console.log('📊 Completion Rate Analysis\n');
    console.log('═══════════════════════════════════════\n');

    // Get all inspections
    const allInspections = await pool.query(`
      SELECT 
        id, 
        request_number, 
        title, 
        status, 
        created_at,
        completed_date,
        approval_date
      FROM inspection_requests 
      ORDER BY created_at DESC
    `);

    console.log('All Inspections in Database:');
    console.log('─────────────────────────────────────');
    allInspections.rows.forEach(r => {
      console.log(`${r.request_number} - ${r.title}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Created: ${new Date(r.created_at).toLocaleDateString()}`);
      if (r.completed_date) {
        console.log(`  Completed: ${new Date(r.completed_date).toLocaleDateString()}`);
      }
      if (r.approval_date) {
        console.log(`  Approved: ${new Date(r.approval_date).toLocaleDateString()}`);
      }
      console.log('');
    });

    // Get this month's start date
    const thisMonthStart = await pool.query(`SELECT DATE_TRUNC('month', CURRENT_DATE) as month_start`);
    const monthStart = new Date(thisMonthStart.rows[0].month_start);
    
    console.log('This Month Calculation:');
    console.log('─────────────────────────────────────');
    console.log(`Month Start: ${monthStart.toLocaleDateString()}`);
    console.log('');

    // Current calculation (completed + approved + closed)
    const currentCalc = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('completed', 'approved', 'closed')) as completed,
        COUNT(*) as total
      FROM inspection_requests
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);

    const completed = parseInt(currentCalc.rows[0].completed || 0);
    const total = parseInt(currentCalc.rows[0].total || 0);
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    console.log('Current API Calculation (completed + approved + closed):');
    console.log(`  Completed: ${completed}`);
    console.log(`  Total: ${total}`);
    console.log(`  Percentage: ${percentage}%`);
    console.log('');

    // Show which inspections are counted
    const thisMonthInspections = await pool.query(`
      SELECT 
        request_number,
        title,
        status,
        created_at,
        CASE 
          WHEN status IN ('completed', 'approved', 'closed') THEN true
          ELSE false
        END as counted_as_completed
      FROM inspection_requests
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
      ORDER BY created_at DESC
    `);

    console.log('Inspections Created This Month:');
    console.log('─────────────────────────────────────');
    if (thisMonthInspections.rows.length > 0) {
      thisMonthInspections.rows.forEach(r => {
        const countedSymbol = r.counted_as_completed ? '✅' : '❌';
        console.log(`${countedSymbol} ${r.request_number} - ${r.title}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Counted as completed: ${r.counted_as_completed ? 'Yes' : 'No'}`);
        console.log('');
      });
    } else {
      console.log('No inspections created this month.');
    }

    console.log('\n═══════════════════════════════════════');
    console.log('Summary:');
    console.log('═══════════════════════════════════════');
    console.log(`Dashboard shows: ${percentage}% (${completed}/${total})`);
    console.log(`Status counted as "completed": completed, approved, closed`);
    console.log(`Status NOT counted: rejected, pending, assigned, in_progress`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkCompletionRate();

