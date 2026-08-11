#!/usr/bin/env node
/**
 * Build a customer-ready standalone package (no application source).
 *
 * Output: deploy/QMS-Standalone/
 *   - Compiled Next.js server (server.js + traced node_modules)
 *   - Static assets + public/
 *   - Portable Node runtime (copied from this machine when possible)
 *   - start/stop launchers + env template + README
 *
 * Run: npm run package:standalone
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'deploy', 'QMS-Standalone');
const ARCHIVE_NAME = 'QMS-Standalone.zip';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}
function ok(msg) {
  log(`✓ ${msg}`, colors.green);
}
function warn(msg) {
  log(`⚠ ${msg}`, colors.yellow);
}
function fail(msg) {
  log(`✗ ${msg}`, colors.red);
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(src, dest, { filter } = {}) {
  if (!fs.existsSync(src)) return;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    mkdirp(dest);
    for (const name of fs.readdirSync(src)) {
      const from = path.join(src, name);
      const to = path.join(dest, name);
      if (filter && !filter(from, name)) continue;
      copyRecursive(from, to, { filter });
    }
    return;
  }
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function findNextDevPids() {
  const pids = [];
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine 2>nul',
        { encoding: 'utf8', timeout: 20000 }
      );
      for (const line of out.split(/\r?\n/)) {
        if (!/next(?:\.cmd)?["']?\s+dev\b/i.test(line)) continue;
        const m = line.match(/\s(\d+)\s*$/);
        if (m) pids.push(m[1]);
      }
    } else {
      const out = execSync('ps -eo pid=,args= 2>/dev/null || ps aux', {
        encoding: 'utf8',
        timeout: 15000,
      });
      for (const line of out.split(/\r?\n/)) {
        if (!/next(?:\.cmd)?\s+dev\b/i.test(line)) continue;
        const m = line.trim().match(/^(\d+)/);
        if (m) pids.push(m[1]);
      }
    }
  } catch {
    /* ignore */
  }
  return [...new Set(pids)];
}

function stopNextDev() {
  const pids = findNextDevPids();
  if (!pids.length) return;
  warn(`Stopping ${pids.length} next dev process(es): ${pids.join(', ')}`);
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore' });
      } else {
        execSync(`kill ${pid}`, { stdio: 'ignore' });
      }
    } catch {
      /* ignore */
    }
  }
  // Give Windows time to release .next file locks
  const end = Date.now() + 2000;
  while (Date.now() < end) {
    /* spin */
  }
}

function writeFile(filePath, content) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function createLaunchers() {
  writeFile(
    path.join(OUT_DIR, 'start.bat'),
    `@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist ".env" (
  echo.
  echo [QMS] Missing .env file.
  echo       Copy env.example to .env and edit DATABASE_URL / NEXTAUTH_SECRET / NEXTAUTH_URL
  echo.
  if exist "env.example" copy /Y "env.example" ".env" >nul
  echo Created .env from env.example — edit it before production use.
  echo.
)

set "NODE_BIN="
if exist "%~dp0runtime\\node.exe" set "NODE_BIN=%~dp0runtime\\node.exe"
if not defined NODE_BIN (
  where node >nul 2>&1
  if errorlevel 1 (
    echo [QMS] Node.js not found. Place a portable node.exe in runtime\\ or install Node.js 20+.
    pause
    exit /b 1
  )
  set "NODE_BIN=node"
)

set NODE_ENV=production
set PORT=3000
set HOSTNAME=0.0.0.0
set AUTH_TRUST_HOST=true

echo.
echo Starting QMS on http://localhost:3000 ...
echo Press Ctrl+C to stop.
echo.
"%NODE_BIN%" server.js
if errorlevel 1 pause
`
  );

  writeFile(
    path.join(OUT_DIR, 'stop.bat'),
    `@echo off
setlocal
echo Stopping QMS (node server.js on port 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /PID %%a /F >nul 2>&1
)
echo Done.
`
  );

  writeFile(
    path.join(OUT_DIR, 'start.vbs'),
    `Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c start.bat", 1, False
`
  );

  writeFile(
    path.join(OUT_DIR, 'start.sh'),
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'cd "$(dirname "$0")"',
      '',
      'if [[ ! -f .env ]]; then',
      '  echo "[QMS] Missing .env — copying env.example"',
      '  cp -n env.example .env || true',
      '  echo "Edit .env (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL) before production use."',
      'fi',
      '',
      'if [[ -x "./runtime/bin/node" ]]; then',
      '  NODE_BIN="./runtime/bin/node"',
      'elif [[ -x "./runtime/node" ]]; then',
      '  NODE_BIN="./runtime/node"',
      'elif command -v node >/dev/null 2>&1; then',
      '  NODE_BIN="node"',
      'else',
      '  echo "[QMS] Node.js not found. Install Node 20+ or place a portable runtime in ./runtime"',
      '  exit 1',
      'fi',
      '',
      'export NODE_ENV=production',
      'export PORT="${PORT:-3000}"',
      'export HOSTNAME="${HOSTNAME:-0.0.0.0}"',
      'export AUTH_TRUST_HOST="${AUTH_TRUST_HOST:-true}"',
      '',
      'echo "Starting QMS on http://${HOSTNAME}:${PORT} ..."',
      'exec "$NODE_BIN" server.js',
      '',
    ].join('\n')
  );

  try {
    if (process.platform !== 'win32') {
      fs.chmodSync(path.join(OUT_DIR, 'start.sh'), 0o755);
    }
  } catch {
    /* ignore */
  }
}

function createReadme() {
  writeFile(
    path.join(OUT_DIR, 'README.md'),
    `# QMS Standalone Deployment

This folder is a **production runtime package**. It does **not** include application source code (\`app/\`, \`components/\`, \`lib/\`, TypeScript, etc.).

## Contents

| Item | Purpose |
|------|---------|
| \`server.js\` | Compiled Next.js production server |
| \`node_modules/\` | Minimal runtime dependencies (traced by Next.js) |
| \`.next/\` | Compiled server + static assets |
| \`public/\` | Public assets / uploads root |
| \`runtime/\` | Portable Node.js binary (when bundled) |
| \`start.bat\` / \`start.sh\` | Start the application |
| \`stop.bat\` | Stop the process listening on port 3000 (Windows) |
| \`env.example\` | Environment template — copy to \`.env\` |

## Prerequisites

1. **PostgreSQL** reachable from this machine (not bundled).
2. **Node.js 20+** — either:
   - Use the bundled \`runtime\\\` folder, or
   - Install Node.js on the host and ensure \`node\` is on PATH.

## Setup

1. Copy \`env.example\` to \`.env\` and edit:
   - \`DATABASE_URL\`
   - \`NEXTAUTH_SECRET\` (generate a long random string)
   - \`NEXTAUTH_URL\` (exact browser URL, e.g. \`http://localhost:3000\` or \`http://server-name:3000\`)
2. Ensure the database schema/migrations have been applied (vendor procedure).
3. Start:
   - **Windows:** double-click \`start.bat\` (or \`start.vbs\`)
   - **Linux/macOS:** \`chmod +x start.sh && ./start.sh\`

Open the URL from \`NEXTAUTH_URL\` in a browser.

## Uploads

User uploads are stored under \`public/uploads\`. Keep this folder writable and back it up with the database.

## Notes

- Do not redistribute or modify compiled files as a substitute for a supported upgrade from the vendor.
- Secrets must never be committed; ship only \`env.example\` to customers.
`
  );
}

function createEnvExample() {
  const templatePath = path.join(ROOT, 'env.template');
  let body = fs.existsSync(templatePath)
    ? fs.readFileSync(templatePath, 'utf8')
    : `# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/QMS

# Auth
NEXTAUTH_SECRET=change-me-generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
`;
  // Strip any accidental real secrets if template was overwritten
  body = body.replace(
    /NEXTAUTH_SECRET=.*/g,
    'NEXTAUTH_SECRET=change-me-generate-with-openssl-rand-base64-32'
  );
  writeFile(path.join(OUT_DIR, 'env.example'), body);
}

function bundleNodeRuntime() {
  const runtimeDir = path.join(OUT_DIR, 'runtime');
  mkdirp(runtimeDir);
  const nodePath = process.execPath;
  if (process.platform === 'win32') {
    const dest = path.join(runtimeDir, 'node.exe');
    fs.copyFileSync(nodePath, dest);
    // Official Node Windows builds are largely self-contained in node.exe
    ok(`Bundled portable Node: ${path.relative(OUT_DIR, dest)} (${process.version})`);
    writeFile(
      path.join(runtimeDir, 'VERSION.txt'),
      `Bundled from: ${nodePath}\nVersion: ${process.version}\nPlatform: ${process.platform} ${process.arch}\n`
    );
    return;
  }
  // Unix: copy the node binary
  const dest = path.join(runtimeDir, 'node');
  fs.copyFileSync(nodePath, dest);
  try {
    fs.chmodSync(dest, 0o755);
  } catch {
    /* ignore */
  }
  ok(`Bundled portable Node: ${path.relative(OUT_DIR, dest)} (${process.version})`);
  writeFile(
    path.join(runtimeDir, 'VERSION.txt'),
    `Bundled from: ${nodePath}\nVersion: ${process.version}\nPlatform: ${process.platform} ${process.arch}\n`
  );
}

function assertNoSourceLeak() {
  const forbidden = [
    'app',
    'components',
    'lib',
    'auth.ts',
    'auth.config.ts',
    'middleware.ts',
    'tsconfig.json',
    'database/init.ts',
    'scripts',
    'src',
  ];
  const leaks = [];
  for (const name of forbidden) {
    const p = path.join(OUT_DIR, name);
    if (fs.existsSync(p)) leaks.push(name);
  }
  // Scan for .tsx / .ts application sources at top levels
  function walk(dir, depth) {
    if (depth > 3) return;
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, depth + 1);
      else if (/\.(tsx|ts|jsx)$/.test(name) && !name.endsWith('.d.ts')) {
        leaks.push(path.relative(OUT_DIR, full));
      }
    }
  }
  walk(OUT_DIR, 0);
  if (leaks.length) {
    throw new Error(`Source leak detected in package: ${leaks.slice(0, 10).join(', ')}`);
  }
  ok('Source-code leak check passed (no app/components/lib/.ts(x) sources)');
}

function zipPackage() {
  const zipPath = path.join(ROOT, 'deploy', ARCHIVE_NAME);
  rmrf(zipPath);
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${OUT_DIR}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      execSync(`cd "${path.join(ROOT, 'deploy')}" && zip -r "${ARCHIVE_NAME}" "QMS-Standalone"`, {
        stdio: 'inherit',
        shell: true,
      });
    }
    if (fs.existsSync(zipPath)) {
      const mb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
      ok(`Archive created: deploy/${ARCHIVE_NAME} (${mb} MB)`);
    }
  } catch (e) {
    warn(`Could not create ZIP automatically: ${e.message}`);
    warn(`You can zip the folder manually: ${OUT_DIR}`);
  }
}

function main() {
  log('\n' + '='.repeat(64), colors.cyan + colors.bright);
  log('  QMS Standalone Package (no source code)', colors.cyan + colors.bright);
  log('='.repeat(64) + '\n', colors.cyan + colors.bright);

  if (!fs.existsSync(path.join(ROOT, 'package.json'))) {
    fail('Run from project root (package.json missing)');
    process.exit(1);
  }

  // 1) Stop next dev so production build can lock/clean .next
  log('[1/7] Ensuring next dev is stopped...');
  stopNextDev();
  ok('Ready to build');

  // 2) Production build (standalone output already in next.config)
  log('\n[2/7] Building production standalone...');
  if (process.env.SKIP_BUILD === '1') {
    warn('SKIP_BUILD=1 — using existing .next/standalone');
  } else {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const build = spawnSync(npmCmd, ['run', 'build'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
      shell: true,
    });
    if (build.status !== 0) {
      fail('next build failed');
      process.exit(build.status || 1);
    }
    ok('Build completed');
  }

  const standalone = path.join(ROOT, '.next', 'standalone');
  const staticDir = path.join(ROOT, '.next', 'static');
  const publicDir = path.join(ROOT, 'public');
  if (!fs.existsSync(path.join(standalone, 'server.js'))) {
    fail('Missing .next/standalone/server.js — ensure next.config has output: "standalone"');
    process.exit(1);
  }

  // 3) Assemble deploy folder
  log('\n[3/7] Assembling deploy/QMS-Standalone...');
  rmrf(OUT_DIR);
  mkdirp(OUT_DIR);
  copyRecursive(standalone, OUT_DIR);
  // Next places static assets outside standalone; copy them in
  copyRecursive(staticDir, path.join(OUT_DIR, '.next', 'static'));
  copyRecursive(publicDir, path.join(OUT_DIR, 'public'), {
    filter: (full, name) => {
      // Keep uploads directory structure but skip large user files if desired —
      // still include folder placeholders
      return true;
    },
  });
  // Never ship secrets
  for (const secret of ['.env', '.env.local', '.env.production', '.env.development']) {
    const p = path.join(OUT_DIR, secret);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      warn(`Removed ${secret} from package`);
    }
  }
  ok(`Package root: ${OUT_DIR}`);

  // 4) Runtime + launchers + docs
  log('\n[4/7] Adding portable Node runtime...');
  bundleNodeRuntime();

  log('\n[5/7] Writing launchers and customer docs...');
  createLaunchers();
  createEnvExample();
  createReadme();
  ok('Launchers + README + env.example written');

  // Optional: SQL migrations only (no TS)
  const migSrc = path.join(ROOT, 'database', 'migrations');
  if (fs.existsSync(migSrc)) {
    copyRecursive(migSrc, path.join(OUT_DIR, 'migrations'), {
      filter: (_full, name) => name.endsWith('.sql') || !name.includes('.'),
    });
    ok('Included database/migrations (*.sql only)');
  }

  // 5) Verify no source
  log('\n[6/7] Verifying source is not packaged...');
  assertNoSourceLeak();

  // 6) Zip
  log('\n[7/7] Creating ZIP archive...');
  zipPackage();

  log('\n' + '='.repeat(64), colors.green);
  log('  STANDALONE PACKAGE READY', colors.green + colors.bright);
  log('='.repeat(64), colors.green);
  log(`\nFolder:  ${OUT_DIR}`);
  log(`Archive: ${path.join(ROOT, 'deploy', ARCHIVE_NAME)}`);
  log('\nCustomer steps:');
  log('  1. Copy deploy/QMS-Standalone to the target PC');
  log('  2. Edit .env (from env.example)');
  log('  3. Run start.bat (Windows) or ./start.sh (Linux/macOS)');
  log('  4. Open NEXTAUTH_URL in the browser\n');
}

main();
