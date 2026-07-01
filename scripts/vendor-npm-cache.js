#!/usr/bin/env node
/**
 * Fills .npm-offline-cache using package-lock.json (requires network).
 * Copy the whole project including .npm-offline-cache to an air-gapped machine, then:
 *   npm run install:offline   OR   deploy\install-offline.bat
 */

const { execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

console.log('\nPopulating .npm-offline-cache from package-lock.json (network required)...\n');
console.log('Tip: Stop `npm run dev` first if npm ci fails on Windows (locked native binaries).\n');
try {
  execSync('npm ci --prefer-online --no-audit --no-fund', { stdio: 'inherit' });
} catch {
  console.log('\nRetrying with npm install (keeps existing node_modules; still fills the cache)...\n');
  execSync('npm install --prefer-online --no-audit --no-fund', { stdio: 'inherit' });
}

console.log('\nDone. Copy the project folder including .npm-offline-cache to the defence site.');
console.log('On the target (no internet): npm run install:offline  or  deploy\\install-offline.bat\n');
