import { NextRequest, NextResponse } from 'next/server';
import { parseBoolSetting, getSetting } from '@/lib/app-settings';
import { runBackup } from '@/lib/daily-backup';

/** Daily backup trigger — used by Task Scheduler or external cron. Always runs (switch does not skip). */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Setting is informational only — daily backup still runs when the UI switch is off
    void parseBoolSetting(await getSetting('auto_backup'), true);

    const status = runBackup();
    return NextResponse.json({ ok: true, file: status.file, at: status.lastBackupAt });
  } catch (error) {
    console.error('Auto-backup failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backup failed' },
      { status: 500 }
    );
  }
}
