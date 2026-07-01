'use client';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CalendarDateInput } from '@/components/calendar-date-input';

/** `YYYY-MM-DDTHH:mm` → date + `HH:mm` parts (no timezone conversion). */
export function parseDateTimeLocalParts(value: string): { date: string; time: string } {
  if (!value?.trim()) return { date: '', time: '' };
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!m) return { date: '', time: '' };
  return {
    date: m[1],
    time: m[2] != null && m[3] != null ? `${m[2]}:${m[3]}` : '',
  };
}

function normalizeTimeHm(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return '00:00';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Merge to `YYYY-MM-DDTHH:mm` for API / form state. */
export function mergeDateTimeLocalParts(date: string, time: string): string {
  if (!date.trim()) return '';
  const t = time.trim() ? normalizeTimeHm(time) : '00:00';
  return `${date.trim()}T${t}`;
}

function parseDateTimeBound(bound?: string): { date?: string; time?: string } {
  if (!bound?.trim()) return {};
  const m = bound.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (!m) return {};
  return { date: m[1], time: m[2] != null && m[3] != null ? `${m[2]}:${m[3]}` : undefined };
}

/** `YYYY-MM-DDTHH:mm` state — separate date (dd-mm-yyyy) and time pickers for Firefox & Chrome. */
export function formatDateTimeLocalDisplay(iso: string): string {
  if (!iso?.trim()) return '';
  const { date, time } = parseDateTimeLocalParts(iso);
  if (!date) return '';
  const [y, mo, d] = date.split('-');
  if (!time) return `${d}-${mo}-${y}`;
  const [hStr, mi] = time.split(':');
  let h24 = parseInt(hStr, 10);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  const hh = String(h12).padStart(2, '0');
  return `${d}/${mo}/${y} ${hh}:${mi} ${ampm}`;
}

type DateTimeLocalInputProps = {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  max?: string;
  className?: string;
  timeClassName?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  pickerAriaLabel?: string;
};

export function DateTimeLocalInput({
  value,
  onChange,
  min,
  max,
  className,
  timeClassName,
  disabled,
  required,
  id,
  pickerAriaLabel = 'Time',
}: DateTimeLocalInputProps) {
  const { date, time } = parseDateTimeLocalParts(value);
  const minP = parseDateTimeBound(min);
  const maxP = parseDateTimeBound(max);

  const timeMin = minP.date && minP.time && date === minP.date ? minP.time : undefined;
  const timeMax = maxP.date && maxP.time && date === maxP.date ? maxP.time : undefined;

  const commit = (nextDate: string, nextTime: string) => {
    onChange(mergeDateTimeLocalParts(nextDate, nextTime));
  };

  return (
    <div className={cn('flex w-full min-w-0 gap-2', className)}>
      <CalendarDateInput
        id={id ? `${id}-date` : undefined}
        className="min-w-0 flex-1"
        disabled={disabled}
        required={required}
        value={date}
        min={minP.date}
        max={maxP.date}
        onChange={(d) => commit(d, time)}
      />
      <Input
        id={id ? `${id}-time` : undefined}
        type="time"
        step={60}
        disabled={disabled || !date}
        required={required && !!date}
        value={time}
        min={timeMin}
        max={timeMax}
        aria-label={pickerAriaLabel}
        title={!date ? 'Select a date first' : undefined}
        className={cn('h-9 w-[7.5rem] shrink-0', timeClassName)}
        onChange={(e) => commit(date, e.target.value)}
        onInput={(e) => commit(date, e.currentTarget.value)}
      />
    </div>
  );
}
