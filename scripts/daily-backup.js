/**
 * Daily PostgreSQL backup for QMS.
 * Used by Settings → Auto-backup (Windows Task Scheduler) and `npm run db:backup`.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKUP_DIR = path.join(PROJECT_ROOT, 'DB Backup', 'auto');
const STATUS_FILE = path.join(BACKUP_DIR, 'last-run.json');
const KEEP = 14;
const TASK_NAME = 'QMS-Daily-Backup';

function writeStatus(partial) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    /* first run */
  }
  const next = { ...prev, ...partial, updatedAt: new Date().toISOString() };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(next, null, 2));
  return next;
}

function parseDatabaseUrl(raw) {
  if (!raw) throw new Error('DATABASE_URL is not set');
  const u = new URL(raw);
  return {
    host: u.hostname || '127.0.0.1',
    port: u.port || '5432',
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    database: decodeURIComponent((u.pathname || '/qms').replace(/^\//, '') || 'qms'),
  };
}

function findPgDump() {
  const fromEnv = process.env.PG_DUMP_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const programFiles = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    'C:\\Program Files',
    'C:\\Program Files (x86)',
  ].filter(Boolean);

  for (const root of programFiles) {
    const pgRoot = path.join(root, 'PostgreSQL');
    if (!fs.existsSync(pgRoot)) continue;
    const versions = fs.readdirSync(pgRoot).sort().reverse();
    for (const ver of versions) {
      const exe = path.join(pgRoot, ver, 'bin', 'pg_dump.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }

  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(cmd, ['pg_dump'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    if (out && fs.existsSync(out)) return out;
  } catch {
    /* not on PATH */
  }

  throw new Error(
    'pg_dump not found. Install PostgreSQL client tools or set PG_DUMP_PATH to pg_dump.exe'
  );
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

function pruneOld(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^qms-.*\.sql$/i.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const extra of files.slice(KEEP)) {
    try {
      fs.unlinkSync(path.join(dir, extra.f));
    } catch {
      /* ignore */
    }
  }
}

function runBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const db = parseDatabaseUrl(process.env.DATABASE_URL);
  const pgDump = findPgDump();
  const fileName = `qms-${stamp()}.sql`;
  const outFile = path.join(BACKUP_DIR, fileName);

  const result = spawnSync(
    pgDump,
    [
      '-h',
      db.host,
      '-p',
      String(db.port),
      '-U',
      db.user,
      '-d',
      db.database,
      '-F',
      'p',
      '--no-owner',
      '--no-acl',
      '-f',
      outFile,
    ],
    {
      env: {
        ...process.env,
        PGPASSWORD: db.password,
        PATH: `${path.dirname(pgDump)}${path.delimiter}${process.env.PATH || ''}`,
      },
      encoding: 'utf8',
      windowsHide: true,
    }
  );

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || `pg_dump exited ${result.status}`).trim();
    writeStatus({ ok: false, error: err, file: null });
    throw new Error(err || 'pg_dump failed');
  }

  pruneOld(BACKUP_DIR);
  const status = writeStatus({
    ok: true,
    error: null,
    file: fileName,
    filePath: outFile,
    lastBackupAt: new Date().toISOString(),
  });
  return status;
}

function schtasks(args) {
  return spawnSync('schtasks', args, { encoding: 'utf8', windowsHide: true });
}

function isWindows() {
  return process.platform === 'win32';
}

function scheduleStatus() {
  if (!isWindows()) return { registered: false, enabled: false, detail: 'Windows Task Scheduler is only used on Windows' };
  const q = schtasks(['/Query', '/TN', TASK_NAME, '/FO', 'LIST', '/V']);
  if (q.status !== 0) {
    return { registered: false, enabled: false, detail: 'Scheduled task is not registered yet' };
  }
  const out = `${q.stdout || ''}`;
  const enabled = !/Status:\s*Disabled/i.test(out);
  return { registered: true, enabled, detail: enabled ? 'Daily at 02:00' : 'Task exists but is disabled' };
}

function setSchedule(enabled) {
  if (!isWindows()) {
    return { ok: true, ...scheduleStatus() };
  }
  const node = process.execPath;
  const script = path.join(__dirname, 'daily-backup.js');
  const tr = `"${node}" "${script}"`;
  const existing = schtasks(['/Query', '/TN', TASK_NAME]);
  if (existing.status !== 0) {
    const created = schtasks([
      '/Create',
      '/TN',
      TASK_NAME,
      '/TR',
      tr,
      '/SC',
      'DAILY',
      '/ST',
      '02:00',
      '/F',
    ]);
    if (created.status !== 0) {
      const err = (created.stderr || created.stdout || 'Failed to create scheduled task').trim();
      return { ok: false, registered: false, enabled: false, detail: err };
    }
  }
  const change = schtasks(['/Change', '/TN', TASK_NAME, enabled ? '/ENABLE' : '/DISABLE']);
  if (change.status !== 0) {
    const err = (change.stderr || change.stdout || 'Failed to update scheduled task').trim();
    return { ok: false, ...scheduleStatus(), detail: err };
  }
  return { ok: true, ...scheduleStatus() };
}

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { runBackup, setSchedule, scheduleStatus, readStatus, TASK_NAME, BACKUP_DIR };

if (require.main === module) {
  try {
    const status = runBackup();
    console.log(`Backup saved: ${status.filePath || status.file}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}
