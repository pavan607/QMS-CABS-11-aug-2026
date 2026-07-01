#!/usr/bin/env node
/**
 * Air-gapped install: uses project .npm-offline-cache only (no registry).
 * Requires .npm-offline-cache/_cacache from `npm run vendor:npm-cache` on a connected machine.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cacheDir = path.join(root, '.npm-offline-cache');
const cacache = path.join(cacheDir, '_cacache');
const lockfile = path.join(root, 'package-lock.json');

process.chdir(root);

function fail(msg) {
  console.error('\n[install-offline] ' + msg + '\n');
  process.exit(1);
}

if (!fs.existsSync(lockfile)) {
  fail('package-lock.json is required. Copy it with the project bundle.');
}

if (!fs.existsSync(cacache)) {
  fail(
    'Missing .npm-offline-cache/_cacache.\n' +
      'On a connected PC (same OS/arch as target), run:\n' +
      '  npm run vendor:npm-cache\n' +
      'Then copy the whole project folder including .npm-offline-cache to the defence network.'
  );
}

const env = {
  ...process.env,
  npm_config_cache: cacheDir,
  npm_config_offline: 'true',
  npm_config_prefer_offline: 'true',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
};

console.log('\n[install-offline] Installing from local cache only (no internet)...\n');
console.log('  cache:', cacheDir);
console.log('');

try {
  execSync('npm ci --offline --no-audit --no-fund', {
    stdio: 'inherit',
    env,
  });
} catch {
  console.log('\n[install-offline] npm ci failed; trying npm install --offline...\n');
  execSync('npm install --offline --no-audit --no-fund', {
    stdio: 'inherit',
    env,
  });
}

console.log('\n[install-offline] Done.\n');
