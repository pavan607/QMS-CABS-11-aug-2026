#!/usr/bin/env node

/**
 * QMS Project Packaging Script
 * Creates a distribution package ready for sharing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
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

function logError(message) {
  log(`✗ ${message}`, colors.red);
}

// Get current date for package name
const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
const packageName = `qms-distribution-${date}`;

log('\n' + '='.repeat(60), colors.cyan + colors.bright);
log('  QMS Distribution Package Creator', colors.cyan + colors.bright);
log('='.repeat(60) + '\n', colors.cyan + colors.bright);

try {
  // Step 1: Check if in correct directory
  log('[1/6] Verifying project structure...');
  if (!fs.existsSync('package.json')) {
    logError('package.json not found. Are you in the project root?');
    process.exit(1);
  }
  logSuccess('Project structure verified');

  // Step 2: Check for sensitive files
  log('\n[2/6] Checking for sensitive files...');
  if (fs.existsSync('.env')) {
    logWarning('.env file exists - will be excluded from package');
  }
  logSuccess('Security check completed');

  // Step 3: Create temp directory
  log('\n[3/6] Creating temporary directory...');
  const tempDir = path.join(process.cwd(), packageName);
  if (fs.existsSync(tempDir)) {
    log('  Removing existing temp directory...');
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  logSuccess('Temporary directory created');

  // Step 4: Copy files
  log('\n[4/6] Copying project files...');
  
  const excludeDirs = [
    'node_modules',
    '.next',
    '.git',
    packageName,
  ];
  
  const excludeFiles = [
    '.env',
    '.env.local',
    '.DS_Store',
    'Thumbs.db',
    '*.log',
  ];

  // Function to check if path should be excluded
  function shouldExclude(itemPath) {
    const basename = path.basename(itemPath);
    
    // Check exclude dirs
    if (excludeDirs.some(dir => itemPath.includes(dir))) {
      return true;
    }
    
    // Check exclude files
    if (excludeFiles.includes(basename)) {
      return true;
    }
    
    // Check for log files
    if (basename.endsWith('.log')) {
      return true;
    }
    
    return false;
  }

  // Recursive copy function
  function copyRecursive(src, dest) {
    if (shouldExclude(src)) {
      return;
    }

    const stat = fs.statSync(src);
    
    if (stat.isDirectory()) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      const items = fs.readdirSync(src);
      for (const item of items) {
        copyRecursive(
          path.join(src, item),
          path.join(dest, item)
        );
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  const items = fs.readdirSync(process.cwd());
  for (const item of items) {
    if (item === packageName) continue;
    
    const srcPath = path.join(process.cwd(), item);
    const destPath = path.join(tempDir, item);
    
    log(`  Copying: ${item}`);
    copyRecursive(srcPath, destPath);
  }

  // Clean uploads directory but keep structure
  const uploadsDir = path.join(tempDir, 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    log('  Cleaning uploads directory...');
    const subdirs = fs.readdirSync(uploadsDir);
    subdirs.forEach(subdir => {
      const subdirPath = path.join(uploadsDir, subdir);
      if (fs.statSync(subdirPath).isDirectory()) {
        fs.rmSync(subdirPath, { recursive: true });
        fs.mkdirSync(subdirPath);
      }
    });
  }

  logSuccess('Files copied successfully');

  // Air-gapped npm: append offline=true only when a populated project cache was copied
  log('\n[4b] Offline npm install (optional)...');
  const distNpmrc = path.join(tempDir, '.npmrc');
  const distCache = path.join(tempDir, '.npm-offline-cache');
  const distCacache = path.join(distCache, '_cacache');
  if (fs.existsSync(distCacache)) {
    if (fs.existsSync(distNpmrc)) {
      let npmrcContent = fs.readFileSync(distNpmrc, 'utf8');
      if (!/^\s*offline\s*=\s*true\s*$/m.test(npmrcContent)) {
        npmrcContent +=
          '\n# Added by package-project.js for air-gapped installs\noffline=true\n';
        fs.writeFileSync(distNpmrc, npmrcContent);
      }
      logSuccess('Packaged .npmrc enables offline npm install (npm install uses .npm-offline-cache only)');
    }
  } else if (!fs.existsSync(distCache)) {
    logWarning('No .npm-offline-cache — for offline installs run: npm run vendor:npm-cache (online), then package again');
  } else {
    logWarning('.npm-offline-cache present but empty — run: npm run vendor:npm-cache before packaging');
  }

  // Step 5: Create archive
  log('\n[5/6] Creating ZIP archive...');
  const archiveName = `${packageName}.zip`;
  
  try {
    // Try to use platform-specific zip command
    if (process.platform === 'win32') {
      // Windows - PowerShell
      execSync(`powershell Compress-Archive -Path "${packageName}/*" -DestinationPath "${archiveName}" -Force`, {
        stdio: 'inherit',
      });
    } else {
      // Unix-like systems
      execSync(`zip -r "${archiveName}" "${packageName}"`, {
        stdio: 'inherit',
      });
    }
    logSuccess(`Archive created: ${archiveName}`);
  } catch (error) {
    logWarning('Could not create ZIP archive automatically');
    log('  You can manually zip the folder: ' + packageName);
  }

  // Step 6: Cleanup
  log('\n[6/6] Cleaning up...');
  // Keep the folder for manual inspection
  logSuccess('Temporary directory kept for verification: ' + packageName);

  // Display summary
  log('\n' + '='.repeat(60), colors.green);
  log('  PACKAGING COMPLETE!', colors.green + colors.bright);
  log('='.repeat(60) + '\n', colors.green);

  log('Package contents:');
  log('  • Folder: ' + packageName);
  if (fs.existsSync(archiveName)) {
    const stats = fs.statSync(archiveName);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    log('  • Archive: ' + archiveName + ` (${sizeMB} MB)`);
  }

  log('\nWhat\'s included:');
  log('  ✓ Source code');
  log('  ✓ Setup scripts');
  log('  ✓ Documentation');
  log('  ✓ Configuration templates');
  log('  ✓ Database scripts');

  log('\nWhat\'s excluded:');
  log('  ✗ node_modules (install with npm after unpack; use .npm-offline-cache if included for offline)');
  log('  ✗ .env (contains sensitive data)');
  log('  ✗ .next (build artifacts)');
  log('  ✗ Log files');
  log('  ✗ Upload contents (directory structure preserved)');

  log('\nNext steps:');
  log('  1. Review the package folder: ' + packageName);
  log('  2. Share the ZIP file: ' + archiveName);
  log('  3. Recipients: npm install (offline if cache was bundled), then npm run setup');

  log('\n' + '='.repeat(60) + '\n');

  logSuccess('Package ready for distribution!');

  log('\nCleanup options:');
  log('  • Keep folder for inspection: ' + packageName);
  log('  • Delete folder: rm -rf ' + packageName + ' (or manually delete)');
  log('  • Keep ZIP for sharing: ' + archiveName);

} catch (error) {
  logError('Packaging failed: ' + error.message);
  console.error(error);
  process.exit(1);
}

