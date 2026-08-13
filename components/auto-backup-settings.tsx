'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { formatDateTimeDisplay } from '@/lib/inspection-display';
import { Loader2 } from 'lucide-react';

type BackupState = {
  enabled: boolean;
  lastBackupAt: string | null;
  lastFile: string | null;
  lastError: string | null;
  lastOk: boolean | null;
  schedule?: { registered?: boolean; enabled?: boolean; detail?: string; ok?: boolean };
};

export function AutoBackupSettings() {
  const [state, setState] = useState<BackupState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const res = await fetch('/api/settings/auto-backup');
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Failed to load auto-backup setting');
      return;
    }
    setState(data);
  };

  useEffect(() => {
    load().catch(() => setMessage('Failed to load auto-backup setting'));
  }, []);

  const save = async (enabled: boolean, runNow = enabled) => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings/auto-backup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, runNow }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update auto-backup');
      setState((prev) => ({ ...(prev || { enabled: false, lastBackupAt: null, lastFile: null, lastError: null, lastOk: null }), ...data }));
      if (enabled && data.run?.ok === false) {
        setMessage(data.run.error || 'Backup ran but failed');
      } else if (enabled && data.schedule?.ok === false) {
        setMessage(data.schedule.detail || 'Backup setting saved, but the daily schedule could not be registered');
      } else if (enabled) {
        setMessage(data.run?.file ? `Backup saved: ${data.run.file}` : 'Daily auto-backup is on');
      } else {
        setMessage('Auto-backup is off');
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update auto-backup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <Label className="font-semibold">Auto-backup</Label>
          <p className="text-sm text-muted-foreground">
            Automatically backup the database daily at 2:00 AM
          </p>
        </div>
        <Switch
          checked={!!state?.enabled}
          disabled={saving || state == null}
          onCheckedChange={(checked) => save(checked)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {state?.lastBackupAt && (
          <span>
            Last backup: {formatDateTimeDisplay(state.lastBackupAt)}
            {state.lastFile ? ` (${state.lastFile})` : ''}
          </span>
        )}
        {state?.schedule?.detail && <span>{state.schedule.detail}</span>}
        {state?.enabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={saving}
            onClick={() => save(true, true)}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Backup now
          </Button>
        )}
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
