# Quick Setup Guide - QMS

Get your QMS system up and running in minutes!

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 12+ ([Download](https://www.postgresql.org/download/))
- A PostgreSQL database created (e.g., `qms_db`)

## One-Command Setup

```bash
npm run setup
```

That's it! The script will:
- ✓ Install all dependencies
- ✓ Create .env file from template
- ✓ Set up directory structure
- ✓ Initialize database with sample data

## Platform-Specific Scripts

### Windows PowerShell
```powershell
.\setup.ps1
```

### Linux/Mac
```bash
chmod +x setup.sh
./setup.sh
```

## After Setup

1. **Edit .env** - Update your database connection and secrets
2. **Start the app** - Run `npm run dev`
3. **Open browser** - Go to http://localhost:3000
4. **Login** - Use admin@qms.com / admin123
5. **Change password** - Do this immediately!

## Default Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@qms.com | admin123 | Administrator |
| inspector@qms.com | admin123 | Inspector |
| approver@qms.com | admin123 | Approver |
| initiator@qms.com | admin123 | Initiator |

**⚠️ Change these passwords after first login!**

## Generate Secure Secret

```bash
openssl rand -base64 32
```

Add the output to `.env` as `NEXTAUTH_SECRET`

## Troubleshooting

### Can't connect to database?
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

### Port 3000 in use?
```bash
npm run dev -- -p 3001
```

### Need to reinstall?
```bash
rm -rf node_modules package-lock.json
npm install
```

## Important Files

- **`.env`** - Your configuration (DON'T COMMIT THIS!)
- **`env.template`** - Template for .env
- **`package.json`** - Dependencies and scripts
- **`database/init.ts`** - Database initialization

## Next Steps

For detailed information, see:
- [INSTALLATION.md](INSTALLATION.md) - Complete installation guide
- [README.md](README.md) - Project overview
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) - User documentation

---

**Need help?** Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

