import 'dotenv/config';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

async function checkUsers() {
  console.log('🔍 Checking users in database...\n');
  
  try {
    // Get all users
    const result = await pool.query('SELECT id, email, name, role, password FROM users ORDER BY id');
    
    if (result.rows.length === 0) {
      console.log('⚠️  No users found in database');
      console.log('   Run: npm run db:init to create default users\n');
      return;
    }
    
    console.log(`📋 Found ${result.rows.length} user(s):\n`);
    
    for (const user of result.rows) {
      console.log(`${user.id}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Password Hash: ${user.password.substring(0, 20)}...`);
      
      // Test if default password works
      const testPassword = 'admin123';
      const isMatch = await bcrypt.compare(testPassword, user.password);
      console.log(`   Default Password (admin123): ${isMatch ? '✅ WORKS' : '❌ Does not work'}`);
      console.log('');
    }
    
    console.log('💡 Login Instructions:');
    console.log('   1. Go to http://localhost:3000/login');
    console.log('   2. Use one of the emails above');
    console.log('   3. Default password for all users: admin123\n');
    
  } catch (error: any) {
    console.error('❌ Error checking users:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default checkUsers;


