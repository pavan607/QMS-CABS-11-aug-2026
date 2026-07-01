import 'dotenv/config';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

async function testLogin() {
  console.log('🔐 Testing login authentication flow...\n');
  
  const testEmail = 'admin@qms.com';
  const testPassword = 'admin123';
  
  try {
    console.log(`Attempting to login with:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);
    
    // Step 1: Check if user exists
    console.log('Step 1: Fetching user from database...');
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [testEmail]);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found in database');
      return;
    }
    
    const user = result.rows[0];
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email: ${user.email}`);
    console.log('');
    
    // Step 2: Check password
    console.log('Step 2: Verifying password...');
    console.log(`   Stored hash: ${user.password.substring(0, 30)}...`);
    
    const passwordsMatch = await bcrypt.compare(testPassword, user.password);
    
    if (passwordsMatch) {
      console.log('✅ Password verification successful!\n');
      
      console.log('🎉 Login should work with these credentials:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}\n`);
      
      console.log('📝 If you\'re still getting "Invalid email or password":');
      console.log('   1. Make sure you\'re typing the email and password exactly as shown');
      console.log('   2. Check browser console (F12) for any JavaScript errors');
      console.log('   3. Restart the dev server: Ctrl+C then npm run dev');
      console.log('   4. Clear browser cache and try again');
      console.log('   5. Try in an incognito/private window\n');
      
    } else {
      console.log('❌ Password verification FAILED');
      console.log('   The password in the database does not match "admin123"\n');
      console.log('💡 Fix: Run npm run db:init to reset the database\n');
    }
    
  } catch (error: any) {
    console.error('❌ Error during test:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testLogin()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default testLogin;


