# QMS Installation Guide

This guide will help you set up the Quality Management System on a new system.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (version 18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **PostgreSQL** (version 12 or higher)
   - Download from: https://www.postgresql.org/download/
   - Ensure PostgreSQL service is running
   - Create a new database for QMS (e.g., `qms_db`)

3. **Git** (optional, for version control)
   - Download from: https://git-scm.com/

## Quick Setup (Recommended)

### Option 1: Using the Setup Script (Cross-Platform)

1. **Extract/Copy the project folder** to your desired location

2. **Open a terminal/command prompt** in the project directory

3. **Run the setup script:**

   ```bash
   npm run setup
   ```

   Or directly:
   ```bash
   node setup.js
   ```

4. **Follow the interactive prompts:**
   - The script will install dependencies
   - Create .env file from template
   - Create necessary directories
   - Optionally initialize the database

5. **Done!** Follow the next steps displayed by the script

### Option 2: Platform-Specific Scripts

#### Windows (PowerShell)

```powershell
# You may need to enable script execution first:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Run the setup script
.\setup.ps1
```

#### Linux/Mac (Bash)

```bash
# Make the script executable
chmod +x setup.sh

# Run the setup script
./setup.sh
```

## Manual Setup (Alternative)

If you prefer to set up manually or the scripts don't work:

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Create Environment File

Copy `env.template` to `.env`:

```bash
# Windows (PowerShell)
Copy-Item env.template .env

# Linux/Mac
cp env.template .env
```

Edit `.env` and configure:

```env
# Update with your PostgreSQL connection details
DATABASE_URL=postgresql://username:password@localhost:5432/qms_db

# Generate a secure secret (use: openssl rand -base64 32)
NEXTAUTH_SECRET=your-generated-secret-here

# Your application URL
NEXTAUTH_URL=http://localhost:3000

# Trust host
AUTH_TRUST_HOST=true
```

### Step 3: Create Upload Directories

```bash
# Windows (PowerShell)
New-Item -ItemType Directory -Path "public\uploads\inspection_request" -Force
New-Item -ItemType Directory -Path "public\uploads\quality_check" -Force
New-Item -ItemType Directory -Path "public\uploads\document" -Force

# Linux/Mac
mkdir -p public/uploads/inspection_request
mkdir -p public/uploads/quality_check
mkdir -p public/uploads/document
```

### Step 4: Initialize Database

```bash
npm run db:init
```

This will:
- Create all database tables
- Run migrations
- Create default user accounts

## Default User Accounts

After database initialization, you can login with these accounts:

| Role | Email | Password | Department |
|------|-------|----------|------------|
| Administrator | admin@qms.com | admin123 | IT |
| Inspector | inspector@qms.com | admin123 | Quality Control |
| Approver | approver@qms.com | admin123 | Quality Assurance |
| Initiator | initiator@qms.com | admin123 | Production |

**⚠️ SECURITY WARNING:** Change these passwords immediately after first login!

## Starting the Application

### Development Mode

```bash
npm run dev
```

The application will be available at: http://localhost:3000

### Production Mode

```bash
# Build the application
npm run build

# Start the production server
npm start
```

## Verifying Installation

After setup, verify everything is working:

1. **Test Database Connection:**
   ```bash
   npm run db:test
   ```

2. **Check Users:**
   ```bash
   npm run db:check-users
   ```

3. **Test Login:**
   ```bash
   npm run db:test-login
   ```

4. **Access the Application:**
   - Open browser: http://localhost:3000
   - Login with admin@qms.com / admin123
   - Change the default password

## Common Issues & Solutions

### Issue: "Cannot connect to database"

**Solution:**
- Ensure PostgreSQL is running
- Verify DATABASE_URL in .env is correct
- Check if the database exists
- Verify database user has proper permissions

### Issue: "NEXTAUTH_SECRET is not set"

**Solution:**
- Generate a secret: `openssl rand -base64 32`
- Add it to .env file: `NEXTAUTH_SECRET=your-generated-secret`

### Issue: "Port 3000 is already in use"

**Solution:**
- Stop any application using port 3000
- Or change the port: `npm run dev -- -p 3001`

### Issue: "Cannot find module" errors

**Solution:**
- Delete node_modules: `rm -rf node_modules`
- Delete package-lock.json: `rm package-lock.json`
- Reinstall: `npm install`

### Issue: File upload not working

**Solution:**
- Ensure public/uploads directory exists with proper permissions
- Check if subdirectories are created (inspection_request, quality_check, document)

## Database Management Commands

```bash
# Initialize database (creates schema + default users)
npm run db:init

# Run migrations only
npm run db:migrate

# Test database connection
npm run db:test

# Check existing users
npm run db:check-users

# Test login functionality
npm run db:test-login

# Verify quality checks
npm run db:verify-qc
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://user:pass@localhost:5432/qms_db |
| NEXTAUTH_SECRET | Secret for NextAuth.js (min 32 chars) | Generate with: openssl rand -base64 32 |
| NEXTAUTH_URL | Base URL of your application | http://localhost:3000 |
| AUTH_TRUST_HOST | Trust host header (needed for some deployments) | true |
| CRON_SECRET | Secret for cron job endpoints (optional) | your-secret-here |
| EMAIL_FROM | From email address (optional) | noreply@yourcompany.com |
| SENDGRID_API_KEY | SendGrid API key (optional) | your-api-key |

## Folder Structure for Deployment

When sharing the project to another system, include:

```
qms/
├── app/                    # Next.js application
├── components/             # React components
├── database/              # Database scripts and migrations
├── lib/                   # Utility libraries
├── public/                # Static files (exclude uploads content)
├── scripts/               # Helper scripts
├── .gitignore            # Git ignore rules
├── env.template          # Environment template
├── package.json          # Dependencies
├── setup.js              # Setup script (Node.js)
├── setup.ps1             # Setup script (PowerShell)
├── setup.sh              # Setup script (Bash)
├── README.md             # Project documentation
└── INSTALLATION.md       # This file
```

**Exclude from sharing:**
- `node_modules/` - Will be installed by setup script
- `.env` - Contains sensitive data, use env.template instead
- `.next/` - Build artifacts
- `public/uploads/*` - User uploaded files (unless needed)

## Next Steps

1. **Change Default Passwords**
   - Login with each default account
   - Go to Settings → Change Password

2. **Configure Email (Optional)**
   - Set up SendGrid account
   - Add SENDGRID_API_KEY to .env
   - Configure EMAIL_FROM address

3. **Set Up Cron Jobs (Optional)**
   - Configure CRON_SECRET in .env
   - Set up automated alerts checking

4. **Customize Settings**
   - Configure company information
   - Set up departments and positions
   - Define quality standards

5. **User Training**
   - Review the USER_GUIDE.md
   - Train users on their respective roles
   - Establish quality processes

## Support & Documentation

- **Project README:** README.md
- **User Guide:** docs/USER_GUIDE.md
- **Quick Reference:** QUICK_REFERENCE.md
- **Troubleshooting:** TROUBLESHOOTING.md

## Security Checklist

Before going to production:

- [ ] Change all default passwords
- [ ] Generate strong NEXTAUTH_SECRET
- [ ] Use environment-specific .env files
- [ ] Enable HTTPS in production
- [ ] Set up regular database backups
- [ ] Configure firewall rules
- [ ] Review user permissions
- [ ] Enable audit logging
- [ ] Set up monitoring and alerts

---

**Need Help?** Check TROUBLESHOOTING.md or review the project documentation.

