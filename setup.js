#!/usr/bin/env node

/**
 * QMS Setup Script
 * Automated setup for Quality Management System
 * Run this script after cloning/copying the project to a new system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, colors.cyan + colors.bright);
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

function execCommand(command, description) {
  try {
    log(`  Running: ${description}...`);
    execSync(command, { stdio: 'inherit' });
    logSuccess(`${description} completed`);
    return true;
  } catch (error) {
    logError(`${description} failed`);
    return false;
  }
}

function checkNodeVersion() {
  logStep('1/6', 'Checking Node.js installation');
  try {
    const version = execSync('node --version', { encoding: 'utf8' }).trim();
    logSuccess(`Node.js ${version} detected`);
    
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      logWarning('Node.js 18 or higher is recommended. Please consider upgrading.');
    }
    return true;
  } catch (error) {
    logError('Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/');
    return false;
  }
}

function installDependencies() {
  logStep('2/6', 'Installing npm dependencies');
  log('  This may take a few minutes...');
  return execCommand('npm install', 'Dependency installation');
}

function setupEnvironmentFile() {
  logStep('3/6', 'Setting up environment variables');
  
  const envPath = path.join(process.cwd(), '.env');
  const templatePath = path.join(process.cwd(), 'env.template');
  
  if (fs.existsSync(envPath)) {
    logWarning('.env file already exists. Skipping...');
    log('  If you need a fresh .env file, delete the existing one and run setup again.');
    return true;
  }
  
  if (!fs.existsSync(templatePath)) {
    logError('env.template file not found!');
    return false;
  }
  
  try {
    fs.copyFileSync(templatePath, envPath);
    logSuccess('.env file created from template');
    log('\n  ⚠️  IMPORTANT: Edit .env file with your configuration:');
    log('     - DATABASE_URL: Your PostgreSQL connection string');
    log('     - NEXTAUTH_SECRET: Generate with "openssl rand -base64 32"');
    log('     - NEXTAUTH_URL: Your application URL (default: http://localhost:3000)');
    return true;
  } catch (error) {
    logError(`Failed to create .env file: ${error.message}`);
    return false;
  }
}

function createUploadsDirectory() {
  logStep('4/6', 'Creating uploads directory');
  
  const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
  
  try {
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      logSuccess('Uploads directory created');
    } else {
      logSuccess('Uploads directory already exists');
    }
    
    // Create subdirectories
    const subdirs = ['inspection_request', 'quality_check', 'document'];
    subdirs.forEach(dir => {
      const dirPath = path.join(uploadsPath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    
    logSuccess('Upload subdirectories created');
    return true;
  } catch (error) {
    logError(`Failed to create uploads directory: ${error.message}`);
    return false;
  }
}

async function promptDatabaseSetup() {
  logStep('5/6', 'Database setup');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    log('\n  Before proceeding, ensure:');
    log('  1. PostgreSQL is installed and running');
    log('  2. You have created a database for QMS');
    log('  3. .env file is configured with correct DATABASE_URL');
    
    rl.question('\n  Do you want to initialize the database now? (y/n): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        resolve(true);
      } else {
        logWarning('Skipping database initialization');
        log('  You can run "npm run db:init" later to initialize the database');
        resolve(false);
      }
    });
  });
}

function initializeDatabase() {
  log('\n  Initializing database schema and creating default users...');
  
  const success = execCommand('npm run db:init', 'Database initialization');
  
  if (success) {
    log('\n  Default users created:');
    log('  • Administrator: admin@qms.com / admin123');
    log('  • Inspector: inspector@qms.com / admin123');
    log('  • Approver: approver@qms.com / admin123');
    log('  • Initiator: initiator@qms.com / admin123');
    logWarning('\n  SECURITY: Change these passwords immediately after first login!');
  }
  
  return success;
}

function displayNextSteps() {
  logStep('6/6', 'Setup Complete!');
  
  log('\n' + '='.repeat(60));
  log('  NEXT STEPS', colors.bright + colors.green);
  log('='.repeat(60) + '\n');
  
  log('1. Review and update your .env file with proper configuration');
  log('   - Ensure DATABASE_URL is correct');
  log('   - Generate NEXTAUTH_SECRET: openssl rand -base64 32\n');
  
  log('2. If you skipped database setup, run:');
  log('   npm run db:init\n');
  
  log('3. Start the development server:');
  log('   npm run dev\n');
  
  log('4. Open your browser and navigate to:');
  log('   http://localhost:3000\n');
  
  log('5. Login with default credentials and change passwords\n');
  
  log('='.repeat(60) + '\n');
  
  logSuccess('Setup script completed successfully!');
  log('For more information, check the README.md file\n');
}

async function main() {
  log('\n' + '='.repeat(60));
  log('  QMS - Quality Management System Setup', colors.bright + colors.cyan);
  log('='.repeat(60) + '\n');
  
  // Check Node.js
  if (!checkNodeVersion()) {
    process.exit(1);
  }
  
  // Install dependencies
  if (!installDependencies()) {
    logError('Setup failed: Could not install dependencies');
    process.exit(1);
  }
  
  // Setup .env
  if (!setupEnvironmentFile()) {
    logError('Setup failed: Could not setup environment file');
    process.exit(1);
  }
  
  // Create uploads directory
  if (!createUploadsDirectory()) {
    logWarning('Warning: Could not create uploads directory');
  }
  
  // Database setup
  const shouldInitDb = await promptDatabaseSetup();
  if (shouldInitDb) {
    if (!initializeDatabase()) {
      logWarning('Warning: Database initialization failed');
      log('  You can try running "npm run db:init" manually later');
    }
  }
  
  // Display next steps
  displayNextSteps();
}

// Run the setup
main().catch(error => {
  logError(`Setup failed: ${error.message}`);
  process.exit(1);
});

