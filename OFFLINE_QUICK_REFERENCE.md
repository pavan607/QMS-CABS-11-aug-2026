# QMS Offline Mode - Quick Reference Card

## 🔌 Offline Capability Status

✅ **100% Offline Compatible** (with minor config change)

## Current External Dependencies

| Component | Status | Solution |
|-----------|--------|----------|
| npm packages | ✅ Local | Already in node_modules |
| Database | ✅ Local | PostgreSQL localhost |
| Authentication | ✅ Local | NextAuth (no OAuth) |
| File uploads | ✅ Local | public/uploads folder |
| UI Components | ✅ Local | shadcn/ui bundled |
| Icons | ✅ Local | Lucide React package |
| API Routes | ✅ Local | Next.js internal |
| Google Fonts | ⚠️ Internet | **Replace with system fonts** |
| Email | ⚠️ Optional | Already graceful fallback |

## 📦 Package for Offline Deployment

### With Internet (Preparation)
```bash
# Install dependencies
npm install

# Configure for offline
npm run setup:offline

# Create complete package
tar -czf qms-complete.tar.gz .
# or Windows: Compress-Archive -Path * -DestinationPath qms-complete.zip
```

### Without Internet (Deployment)
```bash
# Extract
tar -xzf qms-complete.tar.gz

# Setup
cp env.template .env
# Edit .env with local settings

# Initialize
npm run db:init

# Run
npm run dev
```

## 🚀 Enable Full Offline Mode (1 Command)

```bash
npm run setup:offline
```

This removes Google Fonts and uses system fonts instead.

## ✅ Test Offline Mode

1. Start PostgreSQL: `pg_ctl start` (or service postgresql start)
2. Start QMS: `npm run dev`
3. **Disconnect internet**
4. Access: http://localhost:3000
5. Test all features

## 🎯 Offline Mode Commands

```bash
# Configure for offline mode
npm run setup:offline

# Normal setup (online)
npm run setup

# Package project
npm run package

# Database operations (all offline)
npm run db:init
npm run db:test
npm run db:check-users
```

## 📋 Minimum .env for Offline

```env
DATABASE_URL=postgresql://localhost:5432/qms_db
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
```

## 🔒 Offline Security Benefits

- ✅ No external data leakage
- ✅ No cloud dependencies
- ✅ Complete data sovereignty
- ✅ Network-isolated operation
- ✅ Air-gap compatible

## 📊 Feature Availability

| Feature | Offline | Notes |
|---------|---------|-------|
| Login/Auth | ✅ Yes | Local only |
| Dashboard | ✅ Yes | Full functionality |
| Inspections | ✅ Yes | All operations |
| Quality Checks | ✅ Yes | All operations |
| File Uploads | ✅ Yes | Local storage |
| Reports | ✅ Yes | PDF/CSV/JSON |
| Users | ✅ Yes | Full management |
| Documents | ✅ Yes | All operations |
| Notifications | ✅ Yes | In-app only |
| Email | ❌ No | Requires internet |

## 🛠️ Prerequisites for Offline System

- Node.js 18+
- PostgreSQL 12+
- Complete project with node_modules

## 📖 Full Documentation

- **Complete Guide**: `OFFLINE_MODE.md`
- **Quick Deployment**: `OFFLINE_DEPLOYMENT_GUIDE.md`
- **Setup Guide**: `INSTALLATION.md`

## ⚡ One-Line Offline Test

```bash
npm run setup:offline && npm run dev
# Disconnect internet, test at http://localhost:3000
```

## 🔧 Common Issues

**Fonts not loading?**
```bash
npm run setup:offline
```

**Database connection error?**
```bash
# Check PostgreSQL is running
pg_ctl status

# Check .env DATABASE_URL
cat .env | grep DATABASE_URL
```

**Module not found?**
```bash
# Ensure node_modules exists
# If missing, need internet to run: npm install
```

## 📞 Quick Help

| Issue | Command |
|-------|---------|
| Configure offline | `npm run setup:offline` |
| Test database | `npm run db:test` |
| Check users | `npm run db:check-users` |
| Start app | `npm run dev` |

---

**Bottom Line:** QMS works 100% offline after running `npm run setup:offline` 🔌

