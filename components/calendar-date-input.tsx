'use client';

import { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatCalendarDateDisplay } from '@/lib/inspection-display';
import { useIsFirefoxBrowser } from '@/lib/browser';

type CalendarDateInputProps = {
  value: string;
  onChange: (val: string) => void;
  min?: string;
  max?: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
};

/** Native date picker with visible value in dd-mm-yyyy (stores YYYY-MM-DD). */
export function CalendarDateInput({
  value,
  onChange,
  min,
  max,
  className,
  inputClassName,
  placeholder = 'dd-mm-yyyy',
  id,
  disabled,
  required,
}: CalendarDateInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const isFirefox = useIsFirefoxBrowser();

  const commit = (raw: string) => {
    onChange(raw);
  };

  if (isFirefox) {
    return (
      <Input
        id={id}
        type="date"
        disabled={disabled}
        required={required}
        value={value}
        min={min}
        max={max}
        className={cn('h-9 min-w-[8.5rem]', inputClassName, className)}
        onChange={(e) => commit(e.target.value)}
        onInput={(e) => commit(e.currentTarget.value)}
      />
    );
  }

  const openPicker = () => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
        return;
      }
    } catch {
      /* showPicker can throw outside a user gesture */
    }
    el.focus({ preventScroll: true });
  };

  const display = value ? formatCalendarDateDisplay(value, '') : '';

  const nativeInputClass = cn(
    'absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0',
    '[&::-webkit-datetime-edit]:hidden',
    '[&::-webkit-datetime-edit-fields-wrapper]:hidden',
    '[&::-webkit-datetime-edit-text]:hidden',
    '[&::-webkit-datetime-edit-month-field]:hidden',
    '[&::-webkit-datetime-edit-day-field]:hidden',
    '[&::-webkit-datetime-edit-year-field]:hidden',
    '[&::-webkit-calendar-picker-indicator]:absolute',
    '[&::-webkit-calendar-picker-indicator]:inset-0',
    '[&::-webkit-calendar-picker-indicator]:h-full',
    '[&::-webkit-calendar-picker-indicator]:w-full',
    '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
    '[&::-webkit-calendar-picker-indicator]:opacity-0'
  );

  return (
    <div className={cn('relative h-9 w-full min-w-[8.5rem]', className)}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-[1] flex h-full items-center rounded-md border border-input bg-background px-3 pr-10 text-sm',
          disabled && 'opacity-60',
          inputClassName
        )}
      >
        {display ? (
          <span className="truncate tabular-nums">{display}</span>
        ) : (
          <span className="truncate text-muted-foreground">{placeholder}</span>
        )}
      </div>
      <input
        id={id}
        ref={ref}
        type="date"
        disabled={disabled}
        required={required}
        value={value}
        min={min}
        max={max}
        onChange={(e) => commit(e.target.value)}
        onInput={(e) => commit(e.currentTarget.value)}
        className={nativeInputClass}
        aria-label={display || placeholder}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          openPicker();
        }}
        className="absolute right-0 top-0 z-[3] flex h-full w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        aria-label="Open calendar"
      >
        <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
      </button>
    </div>
  );
}
