const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDashboardCounts() {
  try {
    console.log('🔍 Checking Dashboard Counts...\n');

    // Total inspections by status
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM inspection_requests
      GROUP BY status
      ORDER BY status
    `);

    console.log('📊 Inspections by Status:');
    console.log('═══════════════════════════════');
    let totalCount = 0;
    statusResult.rows.forEach(row => {
      console.log(`${row.status.padEnd(15)} : ${row.count}`);
      totalCount += parseInt(row.count);
    });
    console.log('─────────────────────────────');
    console.log(`Total             : ${totalCount}\n`);

    // Inspections by priority
    const priorityResult = await pool.query(`
      SELECT priority, COUNT(*) as count
      FROM inspection_requests
      GROUP BY priority
      ORDER BY 
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `);

    console.log('🎯 Inspections by Priority:');
    console.log('═══════════════════════════════');
    priorityResult.rows.forEach(row => {
      console.log(`${row.priority.padEnd(15)} : ${row.count}`);
    });
    console.log('');

    // Overdue inspections
    const overdueResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM inspection_requests
      WHERE due_date < CURRENT_DATE 
      AND status IN ('pending', 'assigned', 'in_progress')
    `);

    console.log('⚠️  Overdue Inspections:');
    console.log('═══════════════════════════════');
    console.log(`Count             : ${overdueResult.rows[0].count}\n`);

    // Upcoming (next 7 days)
    const upcomingResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM inspection_requests
      WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      AND status IN ('pending', 'assigned', 'in_progress')
    `);

    console.log('📅 Upcoming (Next 7 Days):');
    console.log('═══════════════════════════════');
    console.log(`Count             : ${upcomingResult.rows[0].count}\n`);

    // Completion rate (this month)
    const completionResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('completed', 'approved', 'closed')) as completed,
        COUNT(*) as total
      FROM inspection_requests
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);

    const completed = parseInt(completionResult.rows[0].completed || 0);
    const total = parseInt(completionResult.rows[0].total || 0);
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    console.log('✅ Completion Rate (This Month):');
    console.log('═══════════════════════════════');
    console.log(`Completed         : ${completed}`);
    console.log(`Total             : ${total}`);
    console.log(`Percentage        : ${percentage}%\n`);

    // Quality checks stats
    const qcResult = await pool.query(`
      SELECT 
        COUNT(*) as total_checks,
        COUNT(CASE WHEN result = 'passed' THEN 1 END) as passed_count,
        COUNT(CASE WHEN result = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN result = 'pending' THEN 1 END) as pending_count
      FROM quality_checks
    `);

    console.log('🛡️  Quality Checks:');
    console.log('═══════════════════════════════');
    console.log(`Total             : ${qcResult.rows[0].total_checks}`);
    console.log(`Passed            : ${qcResult.rows[0].passed_count}`);
    console.log(`Failed            : ${qcResult.rows[0].failed_count}`);
    console.log(`Pending           : ${qcResult.rows[0].pending_count}\n`);

    // Recent inspection requests
    const recentResult = await pool.query(`
      SELECT 
        request_number,
        title,
        status,
        priority,
        created_at
      FROM inspection_requests
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('📋 Recent Inspections (Last 5):');
    console.log('═══════════════════════════════');
    if (recentResult.rows.length > 0) {
      recentResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.request_number} - ${row.title}`);
        console.log(`   Status: ${row.status} | Priority: ${row.priority}`);
        console.log(`   Created: ${new Date(row.created_at).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('No inspection requests found.\n');
    }

    console.log('✅ Dashboard counts check completed!');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking dashboard counts:', error);
    await pool.end();
    process.exit(1);
  }
}

checkDashboardCounts();

