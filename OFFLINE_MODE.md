# QMS Offline Mode Configuration

This guide explains how to run QMS completely offline without internet connectivity.

## 🔌 Current Offline Status

### ✅ Already Offline-Compatible
- ✅ **All npm dependencies** - Installed locally in node_modules
- ✅ **Database** - Local PostgreSQL (no cloud required)
- ✅ **UI Components** - All components are local (shadcn/ui)
- ✅ **Icons** - Lucide React (local package)
- ✅ **API Routes** - All internal Next.js routes
- ✅ **File uploads** - Stored locally in public/uploads
- ✅ **Authentication** - Local NextAuth (no OAuth)
- ✅ **Styling** - Tailwind CSS (compiled locally)

### ⚠️ Internet Required For (Optional)
- ⚠️ **Google Fonts** - Can be replaced with local fonts
- ⚠️ **Email notifications** - Optional feature (already falls back gracefully)
- ⚠️ **npm install** - Only needed during initial setup

## 🚀 Complete Offline Setup

### Option 1: Quick Offline Mode (Recommended)

The application is **already 99% offline-compatible**. To make it 100% offline:

1. **Use Local Fonts** (removes Google Fonts dependency)
2. **Disable Email Notifications** (optional, already graceful)

Follow the steps below:

### Step 1: Replace Google Fonts with Local Fonts

#### Method A: Use System Fonts (Fastest)

Edit `app/layout.tsx`:

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Quality Management System",
  description: "Professional Quality Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Then update `app/globals.css` to use system fonts:

```css
@import "tailwindcss";

/* Use system fonts instead of Google Fonts */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
}

code, pre {
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
}

/* Rest of your CSS... */
```

#### Method B: Self-Host Fonts (Better Design Control)

1. **Download fonts** and place in `public/fonts/`:
   ```
   public/
   └── fonts/
       ├── inter-var.woff2
       └── roboto-mono-var.woff2
   ```

2. **Update `app/globals.css`**:

```css
@import "tailwindcss";

@font-face {
  font-family: 'InterVariable';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

@font-face {
  font-family: 'RobotoMonoVariable';
  src: url('/fonts/roboto-mono-var.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --font-sans: 'InterVariable', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'RobotoMonoVariable', 'Monaco', 'Consolas', monospace;
}

body {
  font-family: var(--font-sans);
}

code, pre {
  font-family: var(--font-mono);
}

/* Rest of your CSS... */
```

3. **Update `app/layout.tsx`** (same as Method A)

### Step 2: Configure Environment for Offline

Your `.env` file is already offline-ready. Just ensure:

```env
# Database - Use local PostgreSQL
DATABASE_URL=postgresql://postgres:password@localhost:5432/qms_db

# Auth - All local
NEXTAUTH_SECRET=your-local-secret-here
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# Email - Keep commented out for offline mode
# EMAIL_FROM=noreply@yourcompany.com
# SENDGRID_API_KEY=your-api-key

# Cron - Not needed for offline
# CRON_SECRET=your-secret
```

### Step 3: Verify Offline Mode

Test the application without internet:

```bash
# 1. Start PostgreSQL (if not running)
# Windows: Start-Service postgresql
# Linux: sudo systemctl start postgresql
# Mac: brew services start postgresql

# 2. Start the application
npm run dev

# 3. Disconnect internet
# 4. Test the application at http://localhost:3000
```

## 📦 Pre-Setup for Offline Deployment

If you need to deploy on a completely offline system:

### 1. Package Everything

On a system WITH internet:

```bash
# Install dependencies
npm install

# Package the entire project (including node_modules)
npm run package
```

Or manually:

```bash
# Create distribution folder
mkdir qms-offline-distribution

# Copy everything INCLUDING node_modules
cp -r * qms-offline-distribution/

# Create archive
tar -czf qms-offline-complete.tar.gz qms-offline-distribution/
# Or on Windows:
# Compress-Archive -Path qms-offline-distribution -DestinationPath qms-offline-complete.zip
```

### 2. Transfer to Offline System

Transfer the archive via:
- USB drive
- Network file share
- Physical media
- Secure file transfer

### 3. Setup on Offline System

```bash
# Extract
tar -xzf qms-offline-complete.tar.gz
cd qms-offline-distribution

# NO npm install needed (node_modules included)

# Configure .env
cp env.template .env
# Edit .env with local settings

# Initialize database (PostgreSQL must be installed)
npm run db:init

# Start application
npm run dev
```

## 🔧 Offline Mode Configuration Script

Create `setup-offline.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔌 Configuring QMS for Offline Mode...\n');

// 1. Update layout.tsx for system fonts
const layoutPath = path.join(__dirname, 'app', 'layout.tsx');
const offlineLayout = `import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Quality Management System",
  description: "Professional Quality Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`;

try {
  fs.writeFileSync(layoutPath, offlineLayout);
  console.log('✓ Updated layout.tsx to use system fonts');
} catch (error) {
  console.error('✗ Failed to update layout.tsx:', error.message);
}

// 2. Update globals.css for system fonts
const cssPath = path.join(__dirname, 'app', 'globals.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

if (!cssContent.includes('font-family:')) {
  const fontDeclaration = `
/* System fonts for offline mode */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
}

code, pre {
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
}
`;
  
  cssContent = cssContent.replace('@import "tailwindcss";', 
    `@import "tailwindcss";\n${fontDeclaration}`);
  
  fs.writeFileSync(cssPath, cssContent);
  console.log('✓ Updated globals.css with system fonts');
}

// 3. Check .env for offline-ready config
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  console.log('\n📋 Environment Check:');
  console.log(envContent.includes('localhost') ? 
    '✓ DATABASE_URL uses localhost' : 
    '⚠ WARNING: DATABASE_URL should use localhost for offline mode');
  
  console.log(envContent.includes('EMAIL_FROM') && !envContent.includes('#EMAIL_FROM') ? 
    '⚠ Email configured (requires internet)' : 
    '✓ Email disabled (offline-ready)');
} else {
  console.log('⚠ .env file not found. Run setup first.');
}

console.log('\n✅ Offline mode configuration complete!');
console.log('\nYour application is now fully offline-compatible.');
console.log('Test by disconnecting internet and running: npm run dev\n');
```

Make it executable and run:

```bash
# Make executable (Linux/Mac)
chmod +x setup-offline.js

# Run configuration
node setup-offline.js
```

## 🌐 Network-Isolated Deployment

For completely isolated networks (air-gapped systems):

### Prerequisites on Offline System
1. ✅ Node.js 18+ installed
2. ✅ PostgreSQL 12+ installed
3. ✅ Complete project with node_modules

### Deployment Steps

```bash
# 1. Verify Node.js
node --version  # Should show 18+

# 2. Verify PostgreSQL
psql --version

# 3. Create database
createdb qms_db

# 4. Configure environment
cp env.template .env
# Edit .env with:
#   DATABASE_URL=postgresql://user:password@localhost:5432/qms_db
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   NEXTAUTH_URL=http://localhost:3000

# 5. Initialize database
npm run db:init

# 6. Start application
npm run dev

# For production:
npm run build
npm start
```

## 🔒 Security in Offline Mode

Offline mode provides additional security:

✅ **No external data leakage**
✅ **No cloud service dependencies**
✅ **Complete data sovereignty**
✅ **Network-isolated operation**
✅ **No external authentication**

### Recommendations:
1. Use strong passwords for database
2. Generate unique NEXTAUTH_SECRET
3. Keep database backups locally
4. Restrict physical access to server
5. Use local firewalls

## 📊 Feature Status in Offline Mode

| Feature | Offline Status | Notes |
|---------|---------------|-------|
| User Authentication | ✅ Full | Local NextAuth |
| Inspection Requests | ✅ Full | All local |
| Quality Checks | ✅ Full | All local |
| File Uploads | ✅ Full | Stored locally |
| Reports Generation | ✅ Full | Generated locally |
| Database Operations | ✅ Full | Local PostgreSQL |
| Notifications | ✅ Full | In-app notifications |
| Email Notifications | ⚠️ Disabled | Requires internet (optional) |
| Dashboard | ✅ Full | All data local |
| Document Management | ✅ Full | All local |
| User Management | ✅ Full | All local |
| Audit Trail | ✅ Full | All local |

## 🔍 Testing Offline Mode

### Test Checklist

- [ ] Start PostgreSQL locally
- [ ] Disconnect from internet
- [ ] Access http://localhost:3000
- [ ] Login works
- [ ] Dashboard loads
- [ ] Create inspection request
- [ ] Upload files
- [ ] Generate reports
- [ ] View notifications
- [ ] All CRUD operations work

### Troubleshooting

**Issue: "Cannot load fonts"**
- Solution: You're still using Google Fonts. Follow Step 1 above.

**Issue: "Cannot connect to database"**
- Solution: Ensure PostgreSQL is running locally
- Check DATABASE_URL in .env points to localhost

**Issue: "Email sending fails"**
- Solution: This is expected. Email notifications require internet.
- App continues to work; emails are logged to console.

## 📱 Progressive Web App (PWA) - Optional

For offline caching of static assets:

1. **Add next-pwa** (only if node_modules from online system):

```bash
npm install next-pwa
```

2. **Update `next.config.ts`**:

```typescript
import type { NextConfig } from "next";

const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
```

3. **Add manifest.json** in `public/`:

```json
{
  "name": "Quality Management System",
  "short_name": "QMS",
  "description": "Professional Quality Management System",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## 🎯 Quick Reference

### Offline Mode Commands

```bash
# Setup for offline mode
node setup-offline.js

# Package with node_modules (for offline deployment)
tar -czf qms-complete.tar.gz .

# Deploy on offline system
tar -xzf qms-complete.tar.gz
cd qms
cp env.template .env
# Edit .env
npm run db:init
npm run dev
```

### Environment Variables (Offline)

```env
# Minimum required for offline mode
DATABASE_URL=postgresql://localhost:5432/qms_db
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true

# All other variables are optional
```

## ✅ Verification

Your QMS is fully offline when:
- ✅ No Google Fonts dependency
- ✅ No external API calls
- ✅ No email service configured
- ✅ Database is local
- ✅ All assets are bundled
- ✅ Application works with internet disconnected

---

## Summary

**QMS is designed to be offline-first!**

The only external dependency is Google Fonts, which can be easily replaced with system fonts or self-hosted fonts. Everything else runs completely offline:

- ✅ Database: Local PostgreSQL
- ✅ Authentication: Local NextAuth
- ✅ File Storage: Local filesystem
- ✅ UI: All components bundled
- ✅ No external API calls

**For complete offline mode:**
1. Replace Google Fonts (5 minutes)
2. Use local PostgreSQL (already default)
3. Package with node_modules for air-gapped deployment

**Ready to go offline!** 🔌

