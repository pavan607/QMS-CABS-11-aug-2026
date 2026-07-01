# QMS Setup Instructions - Complete Summary

This document provides a complete overview of all setup and deployment resources available for the QMS project.

## 📚 Documentation Structure

| Document | Purpose | Audience |
|----------|---------|----------|
| `README_FIRST.txt` | Quick start guide | Everyone (first file to read) |
| `QUICK_SETUP.md` | Fastest setup path | Users who want quick installation |
| `INSTALLATION.md` | Detailed installation guide | System administrators |
| `DEPLOYMENT_CHECKLIST.md` | Verification checklist | Deployment teams |
| `SHARING_GUIDE.md` | How to package and share | Project distributors |
| `OFFLINE_MODE.md` | Complete offline guide | Offline/air-gapped deployments |
| `OFFLINE_DEPLOYMENT_GUIDE.md` | Quick offline deployment | Offline systems |
| `OFFLINE_QUICK_REFERENCE.md` | Offline mode cheat sheet | Quick reference |
| `SETUP_INSTRUCTIONS_SUMMARY.md` | This file - overview | Everyone |

## 🚀 For Recipients: Getting Started

If you received this project and want to set it up:

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 12+ ([Download](https://www.postgresql.org/))
- A PostgreSQL database created

### Quick Start (3 Commands)

```bash
# 1. Run the setup script
npm run setup

# 2. Edit .env file with your configuration
# (Open .env and update DATABASE_URL and NEXTAUTH_SECRET)

# 3. Start the application
npm run dev
```

**That's it!** Open http://localhost:3000 and login with `admin@qms.com` / `admin123`

### Detailed Instructions

For step-by-step instructions, see:
1. **QUICK_SETUP.md** - Simple, visual guide
2. **INSTALLATION.md** - Complete reference with troubleshooting

## 📦 For Distributors: Sharing the Project

If you want to share this project with others:

### Quick Package Creation

```bash
# Run the packaging script
npm run package
```

This creates a distribution package excluding:
- node_modules
- .env (sensitive data)
- Build artifacts
- Log files

### Manual Packaging

1. Delete `node_modules` folder
2. Delete `.env` file
3. Delete `.next` folder
4. Create ZIP archive of remaining files

### What to Share

Share the following with recipients:
- The ZIP file or project folder
- `README_FIRST.txt` - Point them here first
- Link to this documentation

For detailed instructions, see **SHARING_GUIDE.md**

## 🛠️ Setup Scripts Available

### Cross-Platform (Recommended)
```bash
npm run setup
# or
node setup.js
```

Works on Windows, Linux, and Mac.

### Windows PowerShell
```powershell
.\setup.ps1
```

### Linux/Mac Bash
```bash
chmod +x setup.sh
./setup.sh
```

### What Setup Scripts Do

1. ✓ Check Node.js installation
2. ✓ Install dependencies (npm install)
3. ✓ Create .env from template
4. ✓ Create upload directories
5. ✓ Initialize database (optional)
6. ✓ Display next steps

## 🔧 Available npm Scripts

### Setup & Deployment
```bash
npm run setup          # Run initial setup
npm run setup:offline  # Configure for offline mode
npm run package        # Create distribution package
```

### Development
```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
```

### Database
```bash
npm run db:init           # Initialize database (schema + users)
npm run db:test           # Test database connection
npm run db:migrate        # Run migrations
npm run db:check-users    # List users
npm run db:test-login     # Test login functionality
npm run db:verify-qc      # Verify quality checks
```

## 📋 Setup Checklist

Use this quick checklist to verify your setup:

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 12+ installed and running
- [ ] Database created for QMS
- [ ] Project files extracted/copied
- [ ] Setup script executed (`npm run setup`)
- [ ] .env file configured
- [ ] Database initialized
- [ ] Application starts (`npm run dev`)
- [ ] Can access http://localhost:3000
- [ ] Can login with admin@qms.com
- [ ] Default passwords changed

For detailed checklist, see **DEPLOYMENT_CHECKLIST.md**

## 🔐 Security Notes

### Critical Security Steps

1. **Generate NEXTAUTH_SECRET**
   ```bash
   openssl rand -base64 32
   ```
   Add output to `.env` file

2. **Change Default Passwords**
   Login and change passwords for:
   - admin@qms.com
   - inspector@qms.com
   - approver@qms.com
   - initiator@qms.com

3. **Protect .env File**
   - Never commit to version control
   - Keep backups secure
   - Use different secrets per environment

4. **Review Permissions**
   - Verify file upload directories
   - Check database user permissions
   - Review user roles in application

## 📁 Project Structure

```
qms/
├── app/                          # Next.js application
│   ├── api/                      # API routes
│   ├── dashboard/                # Dashboard pages
│   └── login/                    # Login page
├── components/                   # React components
│   └── ui/                       # UI components
├── database/                     # Database management
│   ├── schema.sql               # Database schema
│   ├── migrations/              # Database migrations
│   └── init.ts                  # Initialization script
├── lib/                          # Utilities
│   ├── db.ts                    # Database connection
│   ├── permissions.ts           # Permission management
│   └── utils.ts                 # Helper functions
├── public/                       # Static files
│   └── uploads/                 # File uploads
├── scripts/                      # Helper scripts
├── docs/                         # Documentation
│   └── USER_GUIDE.md            # User guide
├── .gitignore                    # Git ignore rules
├── env.template                  # Environment template
├── package.json                  # Dependencies
├── setup.js                      # Setup script (Node.js)
├── setup.ps1                     # Setup script (PowerShell)
├── setup.sh                      # Setup script (Bash)
├── package-project.js           # Packaging script
└── README.md                     # Project overview
```

## 🌐 Environment Configuration

### Required Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/qms_db
NEXTAUTH_SECRET=your-generated-secret-here
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

### Optional Variables

```env
EMAIL_FROM=noreply@yourcompany.com
SENDGRID_API_KEY=your-sendgrid-api-key
CRON_SECRET=your-cron-secret
```

## 🔍 Default User Accounts

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Administrator | admin@qms.com | admin123 | System administration |
| Inspector | inspector@qms.com | admin123 | Perform inspections |
| Approver | approver@qms.com | admin123 | Approve requests |
| Initiator | initiator@qms.com | admin123 | Create requests |

**⚠️ Change all passwords immediately after first login!**

## 🐛 Troubleshooting

### Common Issues

**Issue:** "Cannot connect to database"
- Ensure PostgreSQL is running
- Verify DATABASE_URL in .env
- Check if database exists
- Test: `npm run db:test`

**Issue:** "Port 3000 already in use"
- Stop other applications on port 3000
- Or use different port: `npm run dev -- -p 3001`

**Issue:** "Module not found"
- Delete node_modules and package-lock.json
- Run: `npm install`

**Issue:** Authentication errors
- Generate NEXTAUTH_SECRET: `openssl rand -base64 32`
- Ensure NEXTAUTH_URL matches your domain
- Check AUTH_TRUST_HOST=true

For more solutions, see **TROUBLESHOOTING.md**

## 📞 Getting Help

### Documentation Resources

1. **Setup Issues** → INSTALLATION.md, QUICK_SETUP.md
2. **Deployment** → DEPLOYMENT_CHECKLIST.md
3. **Sharing/Packaging** → SHARING_GUIDE.md
4. **Usage** → docs/USER_GUIDE.md
5. **Project Info** → README.md

### Verification Commands

```bash
# Verify Node.js
node --version

# Verify PostgreSQL
psql --version

# Test database connection
npm run db:test

# Check installed users
npm run db:check-users
```

## 🎯 Next Steps After Setup

1. **Immediate (Security)**
   - [ ] Change all default passwords
   - [ ] Generate unique NEXTAUTH_SECRET
   - [ ] Review .env configuration

2. **Configuration**
   - [ ] Add company information
   - [ ] Set up departments
   - [ ] Define positions
   - [ ] Configure user roles

3. **Training**
   - [ ] Review user guide
   - [ ] Train administrators
   - [ ] Train users by role
   - [ ] Establish processes

4. **Production (if applicable)**
   - [ ] Set up HTTPS
   - [ ] Configure backups
   - [ ] Set up monitoring
   - [ ] Review security settings

## 📊 System Requirements

### Minimum Requirements
- **CPU:** 2 cores
- **RAM:** 4 GB
- **Disk:** 1 GB free
- **Node.js:** 18.0.0+
- **PostgreSQL:** 12.0+

### Recommended Requirements
- **CPU:** 4+ cores
- **RAM:** 8+ GB
- **Disk:** 10+ GB free
- **Node.js:** 20.0.0+
- **PostgreSQL:** 15.0+

## 📝 Quick Reference

### Most Common Commands

```bash
# Setup (first time)
npm run setup

# Start development
npm run dev

# Build for production
npm run build
npm start

# Database management
npm run db:init
npm run db:test

# Create distribution package
npm run package
```

### Important Files

- `.env` - Your configuration (don't commit!)
- `env.template` - Template for .env
- `package.json` - Project dependencies
- `database/schema.sql` - Database structure

### Important URLs

- **Local Development:** http://localhost:3000
- **Login Page:** http://localhost:3000/login
- **Dashboard:** http://localhost:3000/dashboard

## ✅ Verification Steps

After setup, verify everything works:

```bash
# 1. Test database
npm run db:test

# 2. Check users exist
npm run db:check-users

# 3. Start application
npm run dev

# 4. Open browser
# Visit: http://localhost:3000

# 5. Test login
# Use: admin@qms.com / admin123
```

## 🔄 Update & Migration

### Updating the Application

1. Backup your .env file
2. Backup your database
3. Copy new files
4. Run: `npm install`
5. Run: `npm run db:migrate` (if there are new migrations)
6. Restart application

### Database Migrations

```bash
npm run db:migrate
```

Migrations are located in `database/migrations/`

## 📜 License & Support

Review the LICENSE file for terms and conditions.

For support:
- Check documentation files
- Review TROUBLESHOOTING.md
- Contact your system administrator

---

## Quick Start Flow Chart

```
START
  ↓
Have Node.js & PostgreSQL? → No → Install prerequisites
  ↓ Yes
Extract/Copy project files
  ↓
Run: npm run setup
  ↓
Edit .env file
  ↓
Run: npm run dev
  ↓
Open http://localhost:3000
  ↓
Login: admin@qms.com / admin123
  ↓
Change passwords
  ↓
START USING QMS!
```

---

**Ready to start?** 
- **First time?** → Read README_FIRST.txt
- **Quick setup?** → See QUICK_SETUP.md
- **Detailed setup?** → See INSTALLATION.md
- **Deploying?** → See DEPLOYMENT_CHECKLIST.md

**Questions?** Check the relevant documentation file above or TROUBLESHOOTING.md

