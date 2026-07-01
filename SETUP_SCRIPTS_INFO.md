# QMS Setup Scripts - Complete Package

This document provides an overview of all the setup and distribution tools created for the QMS project.

## 🎯 What Was Created

### Setup Scripts (3 versions for different platforms)

1. **`setup.js`** - Universal Node.js script
   - Works on Windows, Linux, and Mac
   - Run with: `npm run setup` or `node setup.js`
   - Most recommended option

2. **`setup.ps1`** - Windows PowerShell script
   - Native Windows experience
   - Run with: `.\setup.ps1`
   - May require: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

3. **`setup.sh`** - Unix/Linux/Mac Bash script
   - Native Unix/Linux/Mac experience
   - Run with: `./setup.sh`
   - May need: `chmod +x setup.sh`

### Distribution Script

4. **`package-project.js`** - Project packaging script
   - Creates distribution package
   - Run with: `npm run package`
   - Automatically excludes sensitive files
   - Creates ZIP archive

### Documentation Files

5. **`README_FIRST.txt`** - First file users should read
   - Plain text for universal compatibility
   - Quick start instructions
   - Essential information
   - Default credentials

6. **`QUICK_SETUP.md`** - Fast track installation
   - Minimal steps to get started
   - Quick reference
   - Common commands

7. **`INSTALLATION.md`** - Complete installation guide
   - Detailed step-by-step instructions
   - Manual setup option
   - Environment configuration
   - Troubleshooting

8. **`DEPLOYMENT_CHECKLIST.md`** - Verification checklist
   - Pre-deployment checks
   - Installation steps
   - Post-deployment verification
   - Security checklist

9. **`SHARING_GUIDE.md`** - Distribution guide
   - How to package the project
   - What to include/exclude
   - Sharing methods
   - Security considerations

10. **`SETUP_INSTRUCTIONS_SUMMARY.md`** - Overview document
    - Navigation guide for all documentation
    - Quick reference
    - Common commands
    - Troubleshooting quick fixes

11. **`SETUP_SCRIPTS_INFO.md`** - This file
    - Overview of all created files
    - Usage instructions
    - File relationships

### Helper Files

12. **`public/uploads/.gitkeep`** - Preserves upload directory structure in git

13. **Updated `package.json`** - Added new scripts:
    - `npm run setup` - Run setup script
    - `npm run package` - Create distribution package

## 📦 What Each Script Does

### Setup Scripts Features

All three setup scripts perform the same tasks:

1. ✅ **Check Prerequisites**
   - Verifies Node.js installation
   - Checks Node.js version (18+)

2. ✅ **Install Dependencies**
   - Runs `npm install`
   - Installs all required packages

3. ✅ **Create Environment File**
   - Copies `env.template` to `.env`
   - Preserves existing `.env` if present

4. ✅ **Create Directories**
   - Creates `public/uploads` directory
   - Creates subdirectories for different file types

5. ✅ **Initialize Database** (Optional)
   - Interactive prompt
   - Runs database schema
   - Creates default users
   - Displays credentials

6. ✅ **Display Next Steps**
   - Configuration instructions
   - How to start the application
   - Security reminders

### Package Script Features

The packaging script (`package-project.js`) performs:

1. ✅ **Verification**
   - Checks project structure
   - Identifies sensitive files

2. ✅ **Smart Copying**
   - Copies all necessary files
   - Excludes:
     - node_modules
     - .env
     - .next
     - .git
     - Log files
     - OS files

3. ✅ **Archive Creation**
   - Creates ZIP file
   - Names with date stamp
   - Calculates size

4. ✅ **Summary Report**
   - Lists included/excluded items
   - Shows file sizes
   - Provides next steps

## 🚀 How to Use

### For First-Time Setup (Recipients)

```bash
# Step 1: Extract/copy the project folder
# Step 2: Open terminal in project directory
# Step 3: Run setup
npm run setup

# Step 4: Edit .env file
# Update DATABASE_URL and NEXTAUTH_SECRET

# Step 5: Start application
npm run dev
```

### For Creating Distribution Package (Distributors)

```bash
# Run the packaging script
npm run package

# This creates:
# - qms-distribution-YYYYMMDD/ folder
# - qms-distribution-YYYYMMDD.zip archive

# Share the ZIP file with recipients
```

## 📁 File Organization

```
Project Root/
│
├── Setup Scripts (Choose one to run)
│   ├── setup.js          ← Cross-platform (recommended)
│   ├── setup.ps1         ← Windows PowerShell
│   └── setup.sh          ← Linux/Mac Bash
│
├── Distribution Tools
│   └── package-project.js ← Create distribution package
│
├── Quick Start Documentation
│   ├── README_FIRST.txt           ← Read this first!
│   ├── QUICK_SETUP.md             ← Fastest path
│   └── SETUP_INSTRUCTIONS_SUMMARY.md ← Overview
│
├── Detailed Documentation
│   ├── INSTALLATION.md            ← Complete guide
│   ├── DEPLOYMENT_CHECKLIST.md    ← Verification
│   ├── SHARING_GUIDE.md           ← Distribution
│   └── SETUP_SCRIPTS_INFO.md      ← This file
│
├── Configuration
│   ├── env.template               ← Environment template
│   ├── .env                       ← Created by setup
│   └── package.json               ← Contains npm scripts
│
└── Application Files
    ├── app/                       ← Next.js app
    ├── components/                ← React components
    ├── database/                  ← DB scripts
    ├── lib/                       ← Utilities
    └── public/                    ← Static files
```

## 🎮 Available Commands

### Setup & Distribution
```bash
npm run setup          # Initial setup
npm run package        # Create distribution
```

### Development
```bash
npm run dev            # Start dev server
npm run build          # Build for production
npm start              # Start production server
```

### Database
```bash
npm run db:init        # Initialize database
npm run db:test        # Test connection
npm run db:migrate     # Run migrations
npm run db:check-users # List users
```

## 📋 Documentation Reading Order

### For Recipients (First Time Setup)
1. **README_FIRST.txt** - Start here
2. **QUICK_SETUP.md** - Follow these steps
3. **INSTALLATION.md** - If you need more details
4. **DEPLOYMENT_CHECKLIST.md** - Verify your setup

### For Distributors (Sharing Project)
1. **SHARING_GUIDE.md** - How to package
2. **DEPLOYMENT_CHECKLIST.md** - What to verify
3. **SETUP_INSTRUCTIONS_SUMMARY.md** - Overview

### For Everyone
- **SETUP_SCRIPTS_INFO.md** - This file (overview)
- **SETUP_INSTRUCTIONS_SUMMARY.md** - Quick reference

## ⚡ Quick Command Reference

### Most Common Setup Path
```bash
npm run setup           # Run setup
npm run dev             # Start app
```

### Create Distribution Package
```bash
npm run package         # Create package
# Share the created ZIP file
```

### Verify Setup
```bash
npm run db:test         # Test database
npm run db:check-users  # Check users
npm run dev             # Start and test
```

## 🔐 Security Features

All scripts include security measures:

1. **Environment Protection**
   - Never copies .env to distribution
   - Provides env.template instead

2. **Sensitive Data Exclusion**
   - Excludes logs
   - Excludes user uploads
   - Excludes git history

3. **Password Reminders**
   - Warns about default passwords
   - Prompts to change passwords
   - Displays security notes

4. **Secret Generation**
   - Instructions for NEXTAUTH_SECRET
   - Recommends strong secrets
   - Environment-specific configs

## 🆘 Troubleshooting

### Setup Script Issues

**Problem:** "npm command not found"
```bash
# Install Node.js from nodejs.org
node --version  # Verify installation
```

**Problem:** "Permission denied" (Linux/Mac)
```bash
chmod +x setup.sh  # Make executable
./setup.sh         # Run again
```

**Problem:** "Cannot run script" (Windows)
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup.ps1
```

**Problem:** Database initialization fails
```bash
# Check PostgreSQL is running
# Verify DATABASE_URL in .env
npm run db:test  # Test connection
```

### Package Script Issues

**Problem:** ZIP creation fails
- The folder is still created
- Manually ZIP the folder
- Or install zip utility

**Problem:** Large package size
- Normal: 5-15 MB without node_modules
- If larger, check for:
  - Accidentally included node_modules
  - Large files in public/uploads
  - Log files

## 📊 Script Comparison

| Feature | setup.js | setup.ps1 | setup.sh |
|---------|----------|-----------|----------|
| Platform | All | Windows | Linux/Mac |
| Colors | ✅ | ✅ | ✅ |
| Interactive | ✅ | ✅ | ✅ |
| Prerequisite check | ✅ | ✅ | ✅ |
| Dependency install | ✅ | ✅ | ✅ |
| .env creation | ✅ | ✅ | ✅ |
| Directory setup | ✅ | ✅ | ✅ |
| DB initialization | ✅ | ✅ | ✅ |
| No extra tools needed | ✅ | PowerShell | Bash |

**Recommendation:** Use `setup.js` (via `npm run setup`) for best compatibility.

## 🎓 Learning Resources

### Understanding the Setup Process
1. Read `setup.js` - Well-commented code
2. Review `INSTALLATION.md` - Manual steps explained
3. Check `package.json` - See all available scripts

### Understanding Distribution
1. Read `SHARING_GUIDE.md` - Complete guide
2. Review `package-project.js` - Packaging logic
3. Check `.gitignore` - What's excluded

## ✅ Verification Checklist

After running setup scripts, verify:

- [ ] No errors displayed during setup
- [ ] .env file exists
- [ ] public/uploads directory exists
- [ ] Database tables created (if initialized)
- [ ] Can start app with `npm run dev`
- [ ] Can access http://localhost:3000
- [ ] Can login with default credentials

## 📞 Support

If you encounter issues:

1. Check **TROUBLESHOOTING.md**
2. Review **INSTALLATION.md** for manual steps
3. Verify prerequisites are met
4. Check relevant documentation

## 🎉 Success Indicators

You'll know setup was successful when:
- ✅ All scripts run without errors
- ✅ Application starts successfully
- ✅ You can access the login page
- ✅ You can login with default credentials
- ✅ Dashboard displays correctly

---

## Summary

You now have a complete setup and distribution system:

- **3 Setup scripts** for different platforms
- **1 Packaging script** for distribution
- **7 Documentation files** covering all scenarios
- **Updated package.json** with convenient commands
- **Security features** to protect sensitive data
- **Comprehensive guides** for every use case

**For setup:** Run `npm run setup`
**For distribution:** Run `npm run package`
**For help:** Read the documentation files

---

**Created:** October 22, 2025
**Version:** 1.0
**Purpose:** Complete QMS setup and distribution system

