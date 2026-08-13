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

  const save = async (enabled: boolean, runNow = true) => {
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
      setState((prev) => ({
        ...(prev || {
          enabled: true,
          lastBackupAt: null,
          lastFile: null,
          lastError: null,
          lastOk: null,
        }),
        ...data,
      }));
      if (data.run?.ok === false) {
        setMessage(data.run.error || 'Backup ran but failed');
      } else if (data.schedule?.ok === false) {
        setMessage(
          data.schedule.detail ||
            'Backup setting saved, but the daily schedule could not be registered'
        );
      } else if (data.run?.file) {
        setMessage(`Backup saved: ${data.run.file}`);
      } else if (enabled) {
        setMessage('Daily auto-backup is on');
      } else {
        setMessage('Preference saved — daily backup at 2:00 AM still runs');
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
            Database is backed up daily at 2:00 AM (runs even if this switch is off)
          </p>
        </div>
        <Switch
          checked={!!state?.enabled}
          disabled={saving || state == null}
          onCheckedChange={(checked) => save(checked, true)}
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
        {state != null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={saving}
            onClick={() => save(!!state.enabled, true)}
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
