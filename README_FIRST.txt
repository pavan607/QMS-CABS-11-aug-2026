================================================================================
                  QMS - Quality Management System
                        Distribution Package
================================================================================

Thank you for using QMS!

QUICK START (3 Steps):
================================================================================

1. ENSURE PREREQUISITES:
   - Node.js 18+ installed (https://nodejs.org/)
   - PostgreSQL 12+ installed (https://www.postgresql.org/)
   - A PostgreSQL database created for QMS

2. RUN SETUP SCRIPT:
   Open terminal/command prompt in this folder and run:
   
   → npm run setup
   
   Alternative methods:
   - Node.js (any platform): node setup.js
   - Windows PowerShell: .\setup.ps1
   - Linux/Mac: ./setup.sh

3. START THE APPLICATION:
   → npm run dev
   → Open browser: http://localhost:3000
   → Login with: admin@qms.com / admin123

THAT'S IT! You're ready to use QMS.

================================================================================
DOCUMENTATION
================================================================================

Quick Start:        QUICK_SETUP.md
Installation Guide: INSTALLATION.md
Deployment Checks:  DEPLOYMENT_CHECKLIST.md
Sharing Guide:      SHARING_GUIDE.md
Offline Mode:       OFFLINE_MODE.md (Run without internet!)
Project Overview:   README.md
User Guide:         docs/USER_GUIDE.md

================================================================================
DEFAULT LOGIN CREDENTIALS
================================================================================

⚠️  IMPORTANT: Change these passwords immediately after first login!

Administrator:  admin@qms.com      / admin123
Inspector:      inspector@qms.com  / admin123
Approver:       approver@qms.com   / admin123
Initiator:      initiator@qms.com  / admin123

================================================================================
IMPORTANT NOTES
================================================================================

1. SECURITY:
   - Generate a strong NEXTAUTH_SECRET (see INSTALLATION.md)
   - Change all default passwords immediately
   - Never commit .env file to version control
   - Review .env configuration carefully

2. DATABASE:
   - Ensure PostgreSQL is running
   - Create a database before setup
   - Update DATABASE_URL in .env file

3. CONFIGURATION:
   - Edit .env file after setup script creates it
   - Set correct DATABASE_URL connection string
   - Generate and set NEXTAUTH_SECRET
   - Set NEXTAUTH_URL to your domain

================================================================================
SYSTEM REQUIREMENTS
================================================================================

Software:
- Node.js: Version 18 or higher
- PostgreSQL: Version 12 or higher
- Operating System: Windows, Linux, or macOS

Hardware (Minimum):
- CPU: 2 cores
- RAM: 4 GB
- Disk Space: 1 GB free

Hardware (Recommended):
- CPU: 4+ cores
- RAM: 8+ GB
- Disk Space: 10+ GB free

================================================================================
TROUBLESHOOTING
================================================================================

Can't connect to database?
→ Check PostgreSQL is running
→ Verify DATABASE_URL in .env
→ Ensure database exists

Setup script fails?
→ Check Node.js version: node --version
→ Ensure internet connection (for npm install)
→ Try manual installation (see INSTALLATION.md)

Port 3000 already in use?
→ npm run dev -- -p 3001

Need to reinstall?
→ Delete node_modules and package-lock.json
→ Run: npm install

================================================================================
NEXT STEPS AFTER SETUP
================================================================================

1. Login and change all default passwords
2. Configure company settings
3. Add users and assign roles
4. Review user guide (docs/USER_GUIDE.md)
5. Set up departments and positions
6. Begin using the system

================================================================================
SUPPORT & CONTACT
================================================================================

For issues, questions, or support:
- Check TROUBLESHOOTING.md
- Review documentation files
- Check README.md for project information

================================================================================
PROJECT STRUCTURE
================================================================================

Key folders:
- app/          - Next.js application code
- components/   - React UI components
- database/     - Database schema and migrations
- lib/          - Utility libraries
- public/       - Static files and uploads
- scripts/      - Helper scripts
- docs/         - Documentation

Key files:
- package.json  - Project dependencies
- .env          - Configuration (create during setup)
- env.template  - Environment template

================================================================================
LICENSE & COPYRIGHT
================================================================================

QMS - Quality Management System
Copyright (c) 2025

Review LICENSE file for terms and conditions.

================================================================================

Ready to start? Run: npm run setup

Questions? Check INSTALLATION.md or QUICK_SETUP.md

================================================================================

