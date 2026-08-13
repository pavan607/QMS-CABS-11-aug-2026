import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSetting, parseBoolSetting, upsertSetting } from '@/lib/app-settings';
import path from 'path';

type BackupScript = {
  runBackup: () => { ok?: boolean; file?: string | null; lastBackupAt?: string | null; error?: string | null };
  setSchedule: (enabled: boolean) => { ok?: boolean; registered: boolean; enabled: boolean; detail: string };
  scheduleStatus: () => { registered: boolean; enabled: boolean; detail: string };
  readStatus: () => {
    ok?: boolean;
    file?: string | null;
    lastBackupAt?: string | null;
    error?: string | null;
  } | null;
};

function loadBackupScript(): BackupScript {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(process.cwd(), 'scripts', 'daily-backup.js'));
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const role = (session.user as { role?: string }).role;
  if (role !== 'administrator') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const userId = Number.parseInt(String((session.user as { id?: string }).id || ''), 10);
  return { userId: Number.isFinite(userId) ? userId : null };
}

export async function GET() {
  try {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;

    const enabled = parseBoolSetting(await getSetting('auto_backup'), false);
    const backup = loadBackupScript();
    const last = backup.readStatus();
    const schedule = backup.scheduleStatus();

    return NextResponse.json({
      enabled,
      lastBackupAt: last?.lastBackupAt || null,
      lastFile: last?.file || null,
      lastError: last?.ok === false ? last?.error || 'Last backup failed' : null,
      lastOk: last?.ok ?? null,
      schedule,
    });
  } catch (error) {
    console.error('Error reading auto-backup setting:', error);
    return NextResponse.json({ error: 'Failed to read auto-backup setting' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const gate = await requireAdmin();
    if (gate.error) return gate.error;

    const body = await request.json().catch(() => ({}));
    const enabled = !!body.enabled;
    const runNow = body.runNow !== false && enabled;

    await upsertSetting({
      key: 'auto_backup',
      value: enabled ? 'true' : 'false',
      category: 'general',
      description: 'Automatically backup the database daily',
      updatedBy: gate.userId,
    });

    const backup = loadBackupScript();
    const schedule = backup.setSchedule(enabled);

    let run: { ok: boolean; file?: string | null; error?: string | null; lastBackupAt?: string | null } | null =
      null;
    if (runNow) {
      try {
        const status = backup.runBackup();
        run = {
          ok: true,
          file: status.file,
          lastBackupAt: status.lastBackupAt,
          error: null,
        };
      } catch (err) {
        run = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }

    const last = backup.readStatus();
    return NextResponse.json({
      enabled,
      schedule,
      run,
      lastBackupAt: last?.lastBackupAt || run?.lastBackupAt || null,
      lastFile: last?.file || run?.file || null,
      lastError: run?.ok === false ? run.error : last?.ok === false ? last?.error : null,
      lastOk: run?.ok ?? last?.ok ?? null,
    });
  } catch (error) {
    console.error('Error updating auto-backup setting:', error);
    return NextResponse.json({ error: 'Failed to update auto-backup' }, { status: 500 });
  }
}
