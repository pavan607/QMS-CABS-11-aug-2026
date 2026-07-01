# How to Share QMS Project to Another System

This guide explains how to package and share the QMS project for deployment on another system.

## Quick Method: Using npm pack (Recommended for Node Projects)

### 1. Clean Your Project

First, remove unnecessary files:

```bash
# Remove node_modules
rm -rf node_modules

# Remove build artifacts
rm -rf .next

# Remove logs
rm -rf *.log

# Remove .env (important - contains sensitive data)
rm .env
```

### 2. Create Distribution Package

**Method A: Create a ZIP archive**

Windows (PowerShell):
```powershell
Compress-Archive -Path * -DestinationPath qms-distribution.zip
```

Linux/Mac:
```bash
zip -r qms-distribution.zip . -x "node_modules/*" ".next/*" "*.log" ".env"
```

**Method B: Use Git (if version controlled)**

```bash
# Clone repository (clean copy without history)
git clone --depth 1 <repository-url> qms-distribution

# Remove .git folder (optional)
rm -rf qms-distribution/.git
```

## Files to Include

### Essential Files ✓

```
qms/
├── app/                          # Application code
├── components/                   # React components
├── database/                     # Database scripts
│   ├── schema.sql
│   ├── migrations/
│   └── init.ts
├── lib/                          # Utilities
├── public/                       # Static files
│   ├── uploads/.gitkeep         # Directory structure
│   └── [other static files]
├── scripts/                      # Helper scripts
├── .gitignore                    # Git ignore rules
├── components.json               # Component config
├── env.template                  # Environment template
├── middleware.ts                 # Next.js middleware
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies
├── postcss.config.mjs           # PostCSS config
├── tailwind.config.ts           # Tailwind config
├── tsconfig.json                # TypeScript config
├── setup.js                     # Setup script (Node.js)
├── setup.ps1                    # Setup script (PowerShell)
├── setup.sh                     # Setup script (Bash)
├── README.md                    # Project overview
├── INSTALLATION.md              # Installation guide
├── QUICK_SETUP.md               # Quick start guide
├── DEPLOYMENT_CHECKLIST.md      # Deployment checklist
└── SHARING_GUIDE.md             # This file
```

### Files to EXCLUDE ✗

```
❌ node_modules/           # Will be installed during setup
❌ .next/                  # Build artifacts
❌ .env                    # Contains sensitive secrets
❌ *.log                   # Log files
❌ .DS_Store              # Mac OS files
❌ Thumbs.db              # Windows files
❌ public/uploads/*       # User uploaded files (optional)
❌ *.swp, *.swo          # Editor swap files
❌ .vscode/               # IDE settings
❌ .idea/                 # IDE settings
```

## Sharing Methods

### 1. Cloud Storage (Recommended)

**Best for:** Teams, large files

Upload the ZIP file to:
- Google Drive
- Dropbox
- OneDrive
- AWS S3
- Your company's file server

Share the download link with recipients.

### 2. Git Repository

**Best for:** Version control, teams, continuous deployment

```bash
# Initialize git (if not already)
git init

# Add files (uses .gitignore automatically)
git add .

# Commit
git commit -m "Initial commit"

# Push to remote
git remote add origin <repository-url>
git push -u origin main
```

Recipients can then clone:
```bash
git clone <repository-url>
```

### 3. USB/Network Drive

**Best for:** Local network, air-gapped systems

Simply copy the project folder to:
- USB drive
- Network share
- External hard drive

### 4. FTP/SFTP

**Best for:** Direct server deployment

```bash
# Using rsync (Linux/Mac)
rsync -avz --exclude 'node_modules' --exclude '.next' \
  /local/qms/ user@server:/remote/qms/

# Using scp
scp -r qms-distribution.zip user@server:/destination/
```

## What Recipients Need to Do

### Step 1: Extract/Copy Project

Extract the ZIP or copy the folder to their system.

### Step 2: Verify Prerequisites

Ensure they have:
- Node.js 18+ installed
- PostgreSQL 12+ installed
- A database created

### Step 3: Run Setup

Navigate to the project folder and run:

```bash
npm run setup
```

Or use platform-specific scripts:
- Windows: `.\setup.ps1`
- Linux/Mac: `./setup.sh`

### Step 4: Configure

Edit `.env` file with their specific configuration:
- Database connection string
- Generate new NEXTAUTH_SECRET
- Set appropriate NEXTAUTH_URL

### Step 5: Start Application

```bash
npm run dev
```

## Transfer Package Size Estimates

Typical package sizes (without node_modules):

- **Minimal (code only):** ~5-10 MB
- **With documentation:** ~10-15 MB
- **With sample uploads:** ~20-50 MB (depending on files)

After `npm install`, node_modules adds ~300-500 MB.

## Security Checklist Before Sharing

- [ ] Remove .env file
- [ ] Remove any API keys or secrets
- [ ] Remove sensitive data from code
- [ ] Review and clean uploads folder
- [ ] Remove development logs
- [ ] Clean git history (if applicable)
- [ ] Verify env.template has no secrets
- [ ] Remove any personal information
- [ ] Check for hardcoded credentials
- [ ] Review database scripts for sensitive data

## Automated Packaging Script

Create a script to automate packaging:

```bash
# package.sh
#!/bin/bash

echo "Creating QMS distribution package..."

# Create temporary directory
mkdir -p qms-dist
cp -r . qms-dist/

# Clean up
cd qms-dist
rm -rf node_modules .next .env *.log
rm -rf .git .DS_Store Thumbs.db
rm -rf public/uploads/*
touch public/uploads/.gitkeep

# Create archive
cd ..
zip -r qms-distribution-$(date +%Y%m%d).zip qms-dist/

# Cleanup
rm -rf qms-dist

echo "Package created: qms-distribution-$(date +%Y%m%d).zip"
```

Make it executable:
```bash
chmod +x package.sh
./package.sh
```

## Distribution Documentation

Include these documents in your package:

1. **INSTALLATION.md** - Complete installation guide
2. **QUICK_SETUP.md** - Quick start guide
3. **README.md** - Project overview
4. **DEPLOYMENT_CHECKLIST.md** - Deployment checklist
5. **env.template** - Environment configuration template

## Support Information for Recipients

Include a README_FIRST.txt with:

```
QMS - Quality Management System
Distribution Package

GETTING STARTED:
1. Ensure Node.js 18+ and PostgreSQL 12+ are installed
2. Extract this package to your desired location
3. Open terminal/command prompt in the extracted folder
4. Run: npm run setup
5. Follow the on-screen instructions

DOCUMENTATION:
- QUICK_SETUP.md - Quick start guide
- INSTALLATION.md - Detailed installation instructions
- README.md - Project overview
- DEPLOYMENT_CHECKLIST.md - Deployment verification

SUPPORT:
- Email: your-support@email.com
- Documentation: Link to online docs
- Issues: Link to issue tracker

DEFAULT CREDENTIALS (Change immediately!):
- Admin: admin@qms.com / admin123

IMPORTANT SECURITY NOTES:
1. Generate a new NEXTAUTH_SECRET (see INSTALLATION.md)
2. Change all default passwords immediately
3. Configure .env with your specific settings
4. Never commit .env to version control
```

## Version Information

When sharing, include version information:

Create `VERSION.txt`:
```
QMS Version: 1.0.0
Distribution Date: October 22, 2025
Node.js: 18+ required
PostgreSQL: 12+ required
Next.js: 15.5.6

Changes in this version:
- Initial release
- Complete inspection workflow
- Quality check management
- Report generation
- User management
```

## Testing Your Package

Before sharing, test your package:

1. **Create package** following steps above
2. **Extract to new location** (test folder)
3. **Run setup script** in test folder
4. **Verify everything works** correctly
5. **Delete test folder** after verification

## Troubleshooting for Recipients

Common issues and solutions:

### "Cannot find package.json"
- Ensure you're in the correct directory
- Check if extraction was successful

### "npm not found"
- Node.js not installed or not in PATH
- Install from nodejs.org

### "Setup script fails"
- Check internet connection (for npm install)
- Verify Node.js version (18+)
- Try manual setup (see INSTALLATION.md)

---

**Questions?** Include your support contact information here.

