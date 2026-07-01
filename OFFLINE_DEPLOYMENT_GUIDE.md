# QMS Offline Deployment - Quick Guide

For deploying QMS on systems without internet access.

## 🎯 Quick Start

### On System WITH Internet (Preparation)

```bash
# 1. Install all dependencies
npm install

# 2. Configure for offline mode
npm run setup:offline

# 3. Create complete package (includes node_modules)
# Windows PowerShell:
Compress-Archive -Path * -DestinationPath qms-offline-complete.zip

# Linux/Mac:
tar -czf qms-offline-complete.tar.gz .
```

### On System WITHOUT Internet (Deployment)

```bash
# 1. Extract the package
# Windows: Right-click > Extract All
# Linux/Mac: tar -xzf qms-offline-complete.tar.gz

# 2. Navigate to folder
cd qms

# 3. Configure environment
cp env.template .env
# Edit .env:
#   DATABASE_URL=postgresql://user:password@localhost:5432/qms_db
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   NEXTAUTH_URL=http://localhost:3000

# 4. Initialize database (requires PostgreSQL installed)
npm run db:init

# 5. Start application
npm run dev

# For production:
npm run build
npm start
```

## 📋 Prerequisites on Offline System

- ✅ Node.js 18+ installed
- ✅ PostgreSQL 12+ installed and running
- ✅ Project package with node_modules

## ✅ Verification

Test offline mode:
1. Disconnect internet
2. Access http://localhost:3000
3. Login with admin@qms.com / admin123
4. Test all features

## 📖 Full Documentation

See `OFFLINE_MODE.md` for complete details.

## 🔧 Troubleshooting

**"Module not found"**
- Ensure node_modules was included in the package

**"Cannot connect to database"**
- Check PostgreSQL is running: `pg_ctl status`
- Verify DATABASE_URL in .env

**"Fonts not loading"**
- Run: `npm run setup:offline`

---

**Your QMS runs 100% offline!** 🔌

