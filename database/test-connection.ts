import 'dotenv/config';
import pool from '@/lib/db';

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL is not set in environment variables');
    console.log('\n📝 To fix this:');
    console.log('1. Create a .env.local file in the project root');
    console.log('2. Add: DATABASE_URL=postgresql://username:password@localhost:5432/qms_db');
    console.log('3. Replace with your actual PostgreSQL credentials\n');
    process.exit(1);
  }

  console.log('✅ DATABASE_URL is set');
  console.log(`   Connection string: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);

  try {
    // Test basic connection
    console.log('🔌 Attempting to connect to database...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL!\n');

    // Test database version
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:');
    console.log(`   ${versionResult.rows[0].version.split(',')[0]}\n`);

    // Test current database
    const dbResult = await client.query('SELECT current_database()');
    console.log('💾 Current Database:');
    console.log(`   ${dbResult.rows[0].current_database}\n`);

    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);

    if (tablesResult.rows.length > 0) {
      console.log('📋 Existing Tables:');
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.tablename}`);
      });
      console.log('');
    } else {
      console.log('⚠️  No tables found in the database');
      console.log('   Run: npm run db:init to initialize the database\n');
    }

    // Check user count if users table exists
    const hasUsersTable = tablesResult.rows.some(row => row.tablename === 'users');
    if (hasUsersTable) {
      const userCountResult = await client.query('SELECT COUNT(*) FROM users');
      console.log('👥 Users in Database:');
      console.log(`   ${userCountResult.rows[0].count} user(s)\n`);
    }

    client.release();
    
    console.log('✅ Database connection test completed successfully!\n');
    
  } catch (error: any) {
    console.error('❌ Database connection failed!\n');
    console.error('Error details:');
    console.error(`   ${error.message}\n`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Troubleshooting steps:');
      console.log('1. Make sure PostgreSQL is running:');
      console.log('   - Windows: Check Services for "postgresql"');
      console.log('   - Mac: brew services list | grep postgresql');
      console.log('   - Linux: sudo systemctl status postgresql\n');
      console.log('2. Verify PostgreSQL is listening on the correct port (default: 5432)\n');
    } else if (error.code === '3D000') {
      console.log('💡 Database does not exist. Create it with:');
      console.log('   createdb qms_db');
      console.log('   OR:');
      console.log('   psql -U postgres -c "CREATE DATABASE qms_db;"\n');
    } else if (error.code === '28P01') {
      console.log('💡 Authentication failed. Check your DATABASE_URL credentials\n');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  testConnection()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default testConnection;


