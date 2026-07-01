# Troubleshooting Guide

## Login Issues: "Invalid email or password"

If you're getting "Invalid email or password" when trying to log in, follow these steps:

### ✅ Quick Fix (Most Common)

**Restart the development server:**
```bash
# Press Ctrl+C to stop the server, then:
npm run dev
```

### 🔍 Step-by-Step Diagnosis

#### 1. Verify Database Connection
```bash
npm run db:test
```
Expected: ✅ Successfully connected to PostgreSQL

#### 2. Check Users in Database
```bash
npm run db:check-users
```
Expected: Should show 4 users with working passwords

#### 3. Test Login Authentication
```bash
npm run db:test-login
```
Expected: ✅ Password verification successful

#### 4. Verify Environment Variables
Check that `.env.local` contains:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/qms_db
NEXTAUTH_SECRET=<your-secret-here>
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

#### 5. Valid Credentials

**Default accounts:**
- **Administrator:** `admin@qms.com` / `admin123`
- **Inspector:** `inspector@qms.com` / `admin123`
- **Approver:** `approver@qms.com` / `admin123`
- **Initiator:** `initiator@qms.com` / `admin123`

**⚠️ Important:**
- Email is case-sensitive
- No spaces before or after the email/password
- Make sure Caps Lock is OFF

### 🔧 Common Solutions

#### Solution 1: Clear Browser Cache
1. Press `Ctrl+Shift+Delete`
2. Clear cached images and files
3. Restart browser
4. Try logging in again

#### Solution 2: Try Incognito/Private Mode
1. Open a new incognito/private window
2. Go to `http://localhost:3000/login`
3. Try logging in

#### Solution 3: Check Browser Console
1. Press `F12` to open Developer Tools
2. Go to the "Console" tab
3. Look for any red error messages
4. If you see errors related to authentication, copy them

#### Solution 4: Reset Database (Nuclear Option)
```bash
# This will delete all data and start fresh
npm run db:init
```

### 🐛 Still Not Working?

1. **Check if PostgreSQL is running:**
   ```bash
   npm run db:test
   ```

2. **Check server logs:**
   - Look at the terminal where `npm run dev` is running
   - Check for any error messages in red

3. **Verify the dev server is running:**
   - Should show "Ready" in the terminal
   - Should be accessible at `http://localhost:3000`

4. **Check browser console (F12):**
   - Look for JavaScript errors
   - Look for failed network requests

### 📝 Additional Debug Commands

```bash
# Test database connection
npm run db:test

# Check existing users
npm run db:check-users

# Test login authentication flow
npm run db:test-login

# Reinitialize database (CAUTION: Deletes all data)
npm run db:init
```

### 🆘 Error Messages Explained

| Error | Cause | Solution |
|-------|-------|----------|
| "Invalid email or password" | Wrong credentials or auth issue | Verify credentials, restart server |
| "Connection refused" | PostgreSQL not running | Start PostgreSQL service |
| "Database does not exist" | Database not created | Run `createdb qms_db` |
| Network error | Dev server not running | Run `npm run dev` |
| Session error | Environment variables missing | Check `.env.local` |

### ✨ After Successful Login

Once logged in:
1. **Change your password immediately** (Security Settings)
2. Create additional users as needed
3. Start using the QMS platform

### 🔒 Security Notes

- Default passwords are for initial setup only
- Change all default passwords in production
- Use strong, unique passwords for each user
- Enable 2FA if available in your environment

---

**Need more help?** Check the full documentation in `SETUP.md` and `README.md`


