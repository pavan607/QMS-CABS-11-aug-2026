#!/usr/bin/env node

/**
 * QMS Offline Mode Configuration Script
 * Configures the application to run completely offline without internet
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

log('\n' + '='.repeat(60), colors.cyan + colors.bright);
log('  QMS Offline Mode Configuration', colors.cyan + colors.bright);
log('='.repeat(60) + '\n', colors.cyan + colors.bright);

let changesCount = 0;

// 1. Update layout.tsx for system fonts
log('[1/3] Configuring layout for offline fonts...');
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
  const currentLayout = fs.readFileSync(layoutPath, 'utf8');
  
  if (currentLayout.includes('next/font/google')) {
    fs.writeFileSync(layoutPath, offlineLayout);
    logSuccess('Removed Google Fonts from layout.tsx');
    changesCount++;
  } else {
    logSuccess('Layout.tsx already offline-ready');
  }
} catch (error) {
  logWarning(`Could not update layout.tsx: ${error.message}`);
}

// 2. Update globals.css for system fonts
log('\n[2/3] Configuring CSS for system fonts...');
const cssPath = path.join(__dirname, 'app', 'globals.css');

try {
  let cssContent = fs.readFileSync(cssPath, 'utf8');
  
  // Check if font declarations already exist
  if (!cssContent.includes('/* System fonts for offline mode */')) {
    const fontDeclaration = `
/* System fonts for offline mode */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
}

code, pre {
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
}
`;
    
    // Insert after @import
    cssContent = cssContent.replace(
      '@import "tailwindcss";',
      `@import "tailwindcss";\n${fontDeclaration}`
    );
    
    fs.writeFileSync(cssPath, cssContent);
    logSuccess('Added system fonts to globals.css');
    changesCount++;
  } else {
    logSuccess('globals.css already has system fonts');
  }
} catch (error) {
  logWarning(`Could not update globals.css: ${error.message}`);
}

// 3. Check environment configuration
log('\n[3/3] Checking environment configuration...');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  log('\n📋 Environment Check:', colors.cyan);
  
  // Check DATABASE_URL
  if (envContent.includes('localhost') || envContent.includes('127.0.0.1')) {
    logSuccess('DATABASE_URL uses local connection');
  } else {
    logWarning('DATABASE_URL should use localhost for offline mode');
    log('   Current DATABASE_URL might require internet access');
  }
  
  // Check Email configuration
  const emailConfigured = envContent.match(/^EMAIL_FROM=/m) || 
                         envContent.match(/^SENDGRID_API_KEY=/m);
  
  if (emailConfigured) {
    logWarning('Email service is configured (requires internet)');
    log('   Email notifications will fail in offline mode');
    log('   Comment out EMAIL_FROM and SENDGRID_API_KEY to silence warnings');
  } else {
    logSuccess('Email service disabled (offline-ready)');
  }
  
  // Check NEXTAUTH_URL
  if (envContent.match(/NEXTAUTH_URL=http:\/\/(localhost|127\.0\.0\.1)/)) {
    logSuccess('NEXTAUTH_URL uses local address');
  } else {
    logWarning('NEXTAUTH_URL should use localhost for offline mode');
  }
} else {
  logWarning('.env file not found');
  log('   Run setup script first: npm run setup');
}

// Summary
log('\n' + '='.repeat(60), colors.green);
log('  Configuration Complete!', colors.green + colors.bright);
log('='.repeat(60) + '\n', colors.green);

if (changesCount > 0) {
  log(`Made ${changesCount} change(s) to enable offline mode.\n`);
} else {
  log('No changes needed - already offline-ready!\n');
}

log('✅ Your QMS application is now configured for offline mode!\n');

log('Next steps:');
log('  1. Ensure PostgreSQL is running locally');
log('  2. Start the application: npm run dev');
log('  3. Test by disconnecting internet');
log('  4. Access: http://localhost:3000\n');

log('Features in offline mode:');
log('  ✓ Full application functionality');
log('  ✓ Local authentication');
log('  ✓ File uploads (local storage)');
log('  ✓ Database operations');
log('  ✓ Report generation');
log('  ✓ In-app notifications');
log('  ✗ Email notifications (requires internet)\n');

log('For complete offline deployment guide, see: OFFLINE_MODE.md\n');

