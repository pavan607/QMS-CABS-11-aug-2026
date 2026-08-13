import { NextRequest, NextResponse } from 'next/server';
import { parseBoolSetting, getSetting } from '@/lib/app-settings';
import path from 'path';

function loadBackupScript(): { runBackup: () => { file?: string | null; lastBackupAt?: string | null } } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(path.join(process.cwd(), 'scripts', 'daily-backup.js'));
}

/** Daily backup trigger — used by Task Scheduler or external cron. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const enabled = parseBoolSetting(await getSetting('auto_backup'), false);
    if (!enabled) {
      return NextResponse.json({ skipped: true, reason: 'Auto-backup is turned off' });
    }

    const backup = loadBackupScript();
    const status = backup.runBackup();
    return NextResponse.json({ ok: true, file: status.file, at: status.lastBackupAt });
  } catch (error) {
    console.error('Auto-backup failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backup failed' },
      { status: 500 }
    );
  }
}
