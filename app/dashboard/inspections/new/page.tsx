'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { ArrowLeft, AlertCircle, Save, FileText, ChevronDown, ChevronRight, X, Search, Paperclip, Loader2, CalendarDays, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseYmdLocal,
  getLocalYmdToday,
  getLocalDateTimeNow,
  normalizePart1RequestCreationDateTime,
  toDateOnlyYmd,
  formatInspectionStageItemLabel,
  parsePreviousStageCleared,
  PART1_VENUE_OPTIONS,
  formatPart1Venue,
  parsePart1Venue,
  validatePart1InspectionAdvanceNotice,
  getPart1InspectionFromMinDateTime,
  parsePart1RequestSubmissionDate,
  toDateTimeLocalValue,
} from '@/lib/inspection-display';
import {
  savePart1FormDraftLocal,
  loadPart1FormDraftLocal,
  clearPart1FormDraftLocal,
} from '@/lib/inspection-part1-draft-local';
import { CalendarDateInput } from '@/components/calendar-date-input';
import { DateTimeLocalInput, parseDateTimeLocalParts } from '@/components/datetime-local-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Project { id: number; name: string; code: string; }
interface Subsystem { id: number; project_id: number; name: string; code: string; }
interface LRU { id: number; subsystem_id: number; name: string; code: string; part_number: string; serial_numbers?: string; }
interface SRU { id: number; lru_id: number; name: string; code: string; part_number: string; serial_numbers?: string; }
interface InspectionTypeGroup { id: number; name: string; items: { id: number; name: string; code: string }[]; }
interface Approver {
  id: number;
  name: string;
  designation: string;
  employee_id: string;
}

/** Field 21 — certifier rank options (Part I) */
const CERTIFIER_GRADES = [
  'Sc B', 'Sc C', 'Sc D', 'Sc F', 'Sc G', 'Sc H',
  'STA-A', 'STA-B', 'TO-A', 'TO-B', 'TO-C', 'Tech-A', 'Tech-B',
] as const;

function certifierGradeSelectOptions(stored: string | undefined | null): string[] {
  const s = (stored || '').trim();
  if (s && !CERTIFIER_GRADES.includes(s as (typeof CERTIFIER_GRADES)[number])) {
    return [...CERTIFIER_GRADES, s];
  }
  return [...CERTIFIER_GRADES];
}

const DOC_TYPES = [
  { key: 'ts', label: 'TS' },
  { key: 'qap', label: 'QAP' },
  { key: 'sop_mdi', label: 'SOP/MDI' },
  { key: 'qtp_lqtp_softp', label: 'QTP/LQTP/SOFTP' },
  { key: 'ftp_atp', label: 'FTP/ATP' },
  { key: 'pc_ta_other', label: 'PC/TA/Other Doc' },
] as const;

const OPTIONAL_DOC_KEYS = ['qap', 'sop_mdi', 'qtp_lqtp_softp', 'ftp_atp', 'pc_ta_other'] as const;

/** Internal: which document row to highlight on validation error (not shown as a user message). */
const DOC_ROW_HIGHLIGHT_KEY = 'x-doc-row-highlight';

function docRowLabel(key: string): string {
  return DOC_TYPES.find((d) => d.key === key)?.label || key;
}

/** Row is "started" if any cell has a value — then the whole row must be completed. */
function docRowStarted(d: { approved?: string; doc_no?: string; amd_no?: string; rev_no?: string; date?: string } | undefined): boolean {
  if (!d) return false;
  if (d.approved) return true;
  if (d.doc_no?.trim()) return true;
  if (String(d.amd_no ?? '').trim() !== '') return true;
  if (String(d.rev_no ?? '').trim() !== '') return true;
  if (d.date?.trim()) return true;
  return false;
}

function YesNoSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-[120px]"><SelectValue placeholder="Select" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">Yes</SelectItem>
        <SelectItem value="no">No</SelectItem>
        <SelectItem value="na">N/A</SelectItem>
      </SelectContent>
    </Select>
  );
}

function InspectionStageSelect({
  groups,
  selected,
  onChange,
}: {
  groups: InspectionTypeGroup[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleGroupExpand = (id: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleItem = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter(s => s !== name)
        : [...selected, name]
    );
  };

  const removeItem = (name: string) => {
    onChange(selected.filter(s => s !== name));
  };

  const filteredGroups = groups
    .map(g => ({
      ...g,
      items: g.items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(g => g.items.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex min-h-[40px] w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:border-ring"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">Select inspection stages...</span>
          ) : (
            selected.map(name => (
              <Badge key={name} variant="secondary" className="gap-1 text-xs font-normal max-w-full">
                <span className="truncate">{formatInspectionStageItemLabel(name)}</span>
                <X
                  className="h-3 w-3 shrink-0 cursor-pointer hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); removeItem(name); }}
                />
              </Badge>
            ))
          )}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search items..."
                className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:border-ring"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredGroups.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">No items found</div>
            ) : (
              filteredGroups.map(group => {
                const isExpanded = expandedGroups.has(group.id);
                const selectedCount = group.items.filter(i => selected.includes(i.name)).length;
                return (
                  <div key={group.id}>
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent text-sm font-medium"
                      onClick={() => toggleGroupExpand(group.id)}
                    >
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      }
                      <span className="flex-1">{group.name}</span>
                      {selectedCount > 0 && (
                        <Badge variant="default" className="h-5 text-[10px] px-1.5">{selectedCount}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{group.items.length}</span>
                    </div>
                    {isExpanded && (
                      <div className="ml-4 border-l pl-2 mb-1">
                        {group.items.map(item => (
                          <label
                            key={item.id}
                            className="flex items-center gap-2 px-2 py-1 rounded-sm cursor-pointer hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(item.name)}
                              onChange={() => toggleItem(item.name)}
                              className="h-3.5 w-3.5 rounded border-gray-300"
                            />
                            <span className="text-sm leading-snug">{formatInspectionStageItemLabel(item.name)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t p-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{selected.length} selected</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onChange([])}>
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** DB / ISO value â†’ `YYYY-MM-DDTHH:mm` for `<input type="datetime-local" />`. */
function parseDbStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (val == null || val === '') return [];
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p.map(String) : val.split(',').map((s) => s.trim()).filter(Boolean);
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseJsonObj(val: unknown): Record<string, unknown> | null {
  if (val == null || val === '') return null;
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  try {
    const o = JSON.parse(String(val));
    return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Map a prior inspection request into Part I form fields (excluding hierarchy, serial, request date, designer rep). */
function mapPreviousIrToPart1Form(ir: Record<string, unknown>) {
  const dd = parseJsonObj(ir.document_details);
  const conf = parseJsonObj(ir.confirmations);

  const baseDocs = DOC_TYPES.reduce(
    (acc, d) => ({
      ...acc,
      [d.key]: { approved: '', doc_no: '', amd_no: '', rev_no: '', date: '' },
    }),
    {} as Record<string, { approved: string; doc_no: string; amd_no: string; rev_no: string; date: string }>
  );
  if (dd) {
    for (const d of DOC_TYPES) {
      const row = dd[d.key];
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        const r = row as Record<string, unknown>;
        baseDocs[d.key] = {
          approved: String(r.approved ?? ''),
          doc_no: String(r.doc_no ?? ''),
          amd_no: String(r.amd_no ?? ''),
          rev_no: String(r.rev_no ?? ''),
          date: (() => {
            const x = r.date;
            if (x == null || String(x).trim() === '') return '';
            const n = toDateOnlyYmd(x);
            if (n) return n;
            return String(x).trim();
          })(),
        };
      }
    }
  }

  const unitParsed = parseDbStringArray(ir.item_pertains_to).filter((v) => v !== 'other');
  const item_pertains_to = unitParsed.length > 0 ? [unitParsed[0]] : [];
  const tt0 = parseDbStringArray(ir.test_type);
  const tOther = String(ir.test_type_other || '').trim();
  const testMerged = tOther && !tt0.includes('other') ? [...tt0, 'other'] : tt0;
  const test_type = testMerged.length > 0 ? [testMerged[0]] : [];
  const previousStageCleared = parsePreviousStageCleared(ir.previous_stage_cleared);

  return {
    item_pertains_to,
    test_type,
    test_type_other: tOther,
    so_details: String(ir.so_details || ''),
    delivery_period: ir.delivery_period != null ? toDateOnlyYmd(ir.delivery_period) : '',
    source: String(ir.source || ''),
    oem_name: String(ir.oem_name || ''),
    criticality: parseDbStringArray(ir.criticality),
    quantity:
      ir.quantity != null && ir.quantity_per_set != null ? String(ir.quantity) : '',
    quantity_per_set:
      ir.quantity != null && ir.quantity_per_set != null ? String(ir.quantity_per_set) : '',
    total_quantity:
      ir.quantity != null && ir.quantity_per_set == null ? String(ir.quantity) : '',
    previous_stage_cleared_answer: previousStageCleared.answer,
    previous_stage_cleared: previousStageCleared.stages,
    logbook_attached: String(ir.logbook_attached || ''),
    inspection_type: String(ir.inspection_type || ''),
    inspection_stage: ir.inspection_stage
      ? String(ir.inspection_stage).split(',').map((s: string) => s.trim()).filter(Boolean)
      : [],
    inspection_mode: String(ir.inspection_mode || ''),
    inspection_datetime: toDateTimeLocalValue(ir.inspection_datetime || ir.inspection_date_from),
    inspection_date_from: toDateTimeLocalValue(ir.inspection_date_from || ir.inspection_datetime),
    inspection_date_to: toDateTimeLocalValue(ir.inspection_date_to),
    venue_category: parsePart1Venue(String(ir.venue || '')).category,
    venue_detail: parsePart1Venue(String(ir.venue || '')).detail,
    document_details: baseDocs,
    confirmations: {
      approved_docs_available: String(conf?.approved_docs_available ?? ''),
      logbook_updated: String(conf?.logbook_updated ?? ''),
      previous_observations_status: String(conf?.previous_observations_status ?? ''),
      cocs_available: String(conf?.cocs_available ?? ''),
      instruments_available: String(conf?.instruments_available ?? ''),
      joint_inspection_request: String(conf?.joint_inspection_request ?? ''),
    },
    design_coordinator_name: String(ir.design_coordinator_name || ''),
    certified_by_name: String(ir.certified_by_name || ''),
    certified_by_designation: String(ir.certified_by_designation || ''),
    nominated_request_approver_id:
      ir.nominated_request_approver_id != null ? String(ir.nominated_request_approver_id) : '',
    description: String(ir.description || ''),
  };
}

/** Searchable picker for field 21 — filters by name, employee ID, or designation. */
function CertifierSearchSelect({
  approvers,
  value,
  onChange,
  errorClassName,
  placeholder = 'Select request approver...',
}: {
  approvers: Approver[];
  value: string;
  onChange: (approverId: string) => void;
  errorClassName?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = approvers.find((a) => String(a.id) === value);
  const q = search.trim().toLowerCase();
  const filtered = approvers.filter((a) => {
    if (!q) return true;
    return (
      (a.name || '').toLowerCase().includes(q) ||
      (a.designation || '').toLowerCase().includes(q) ||
      (a.employee_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setSearch('');
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          errorClassName
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {selected
            ? `${selected.name}${
                selected.designation
                  ? ` — ${selected.designation}`
                  : selected.employee_id
                    ? ` (${selected.employee_id})`
                    : ''
              }`
            : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[280px] rounded-md border bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              placeholder="Search name, employee ID, designation..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-[min(280px,40vh)] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No matches</div>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={String(a.id) === value}
                  className={cn(
                    'flex w-full flex-col items-start rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                    String(a.id) === value && 'bg-accent'
                  )}
                  onClick={() => {
                    onChange(String(a.id));
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[a.employee_id, a.designation].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Searchable dropdown for entities with `code` + `name` (field 1 Project, field 2 Subsystem). */
function SearchableCodeNameSelect<T extends { id: number; name: string; code: string }>({
  items,
  value,
  onChange,
  disabled,
  errorClassName,
  placeholder = 'Select...',
  disabledPlaceholder = 'Select...',
  searchPlaceholder = 'Search by code or name...',
  /** Show full name first, then short code (e.g. programme / project) */
  nameFirst = true,
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  errorClassName?: string;
  placeholder?: string;
  disabledPlaceholder?: string;
  searchPlaceholder?: string;
  nameFirst?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = items.find((x) => String(x.id) === value);
  const q = search.trim().toLowerCase();
  const filtered = items.filter((x) => {
    if (!q) return true;
    return (
      (x.name || '').toLowerCase().includes(q) ||
      (x.code || '').toLowerCase().includes(q)
    );
  });

  const isOpen = open && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          if (!open) setSearch('');
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-60',
          errorClassName
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {disabled
            ? disabledPlaceholder
            : selected
              ? nameFirst
                ? `${selected.name} — ${selected.code}`
                : `${selected.code} — ${selected.name}`
              : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[260px] rounded-md border bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-[min(280px,40vh)] overflow-y-auto p-1">
            {items.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No options available</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No matches</div>
            ) : (
              filtered.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="option"
                  aria-selected={String(x.id) === value}
                  className={cn(
                    'flex w-full flex-col items-start rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                    String(x.id) === value && 'bg-accent'
                  )}
                  onClick={() => {
                    onChange(String(x.id));
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  {nameFirst ? (
                    <>
                      <span className="font-medium">{x.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{x.code}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{x.code}</span>
                      <span className="text-xs text-muted-foreground">{x.name}</span>
                    </>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 6 — LRU / nomenclature: search code, name, or part number. */
function SearchableLruSelect({
  items,
  value,
  onChange,
  disabled,
  errorClassName,
  placeholder = 'Search or select LRU...',
  disabledPlaceholder = 'Select subsystem first',
  searchPlaceholder = 'Search code, name, or part number...',
}: {
  items: LRU[];
  value: string;
  onChange: (lruId: string) => void;
  disabled?: boolean;
  errorClassName?: string;
  placeholder?: string;
  disabledPlaceholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = items.find((x) => String(x.id) === value);
  const q = search.trim().toLowerCase();
  const filtered = items.filter((x) => {
    if (!q) return true;
    const pn = (x.part_number || '').toLowerCase();
    return (
      (x.name || '').toLowerCase().includes(q) ||
      (x.code || '').toLowerCase().includes(q) ||
      pn.includes(q)
    );
  });

  const isOpen = open && !disabled;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          if (!open) setSearch('');
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-60',
          errorClassName
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {disabled
            ? disabledPlaceholder
            : selected
              ? `${selected.name} — ${selected.code}`
              : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[280px] rounded-md border bg-popover text-popover-foreground shadow-md"
          role="listbox"
        >
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-[min(280px,40vh)] overflow-y-auto p-1">
            {items.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No LRUs for this subsystem</div>
            ) : filtered.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No matches</div>
            ) : (
              filtered.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="option"
                  aria-selected={String(x.id) === value}
                  className={cn(
                    'flex w-full flex-col items-start rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                    String(x.id) === value && 'bg-accent'
                  )}
                  onClick={() => {
                    onChange(String(x.id));
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  <span className="font-medium">{x.name}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{x.code}</span>
                    {x.part_number ? ` · PN ${x.part_number}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function createEmptyPart1Form() {
  return {
    project_id: '',
    subsystem_id: '',
    lru_id: '',
    sru_id: '',
    item_pertains_to: [] as string[],
    test_type: [] as string[],
    test_type_other: '',
    so_details: '',
    delivery_period: '',
    source: '',
    oem_name: '',
    lru_nomenclature: '',
    criticality: [] as string[],
    part_number: '',
    serial_number: [] as string[],
    quantity: '',
    quantity_per_set: '',
    /** Filled when user chooses 11. Qty (total) instead of 10 (sets — qty/set); stored as `quantity` with `quantity_per_set` null. */
    total_quantity: '',
    previous_stage_cleared_answer: '',
    previous_stage_cleared: [] as string[],
    logbook_attached: '',
    inspection_type: '',
    inspection_stage: [] as string[],
    inspection_mode: '',
    inspection_datetime: '',
    inspection_date_from: '',
    inspection_date_to: '',
    venue_category: '',
    venue_detail: '',
    document_details: DOC_TYPES.reduce((acc, d) => ({
      ...acc,
      [d.key]: { approved: '', doc_no: '', amd_no: '', rev_no: '', date: '' },
    }), {} as Record<string, { approved: string; doc_no: string; amd_no: string; rev_no: string; date: string }>),
    confirmations: {
      approved_docs_available: '',
      logbook_updated: '',
      previous_observations_status: '',
      cocs_available: '',
      instruments_available: '',
      joint_inspection_request: '',
    },
    designer_rep_name: '',
    designer_rep_designation: '',
    designer_rep_contact: '',
    design_coordinator_name: '',
    certified_by_name: '',
    certified_by_designation: '',
    nominated_request_approver_id: '',
    request_date: '',
    description: '',
  };
}

function NewInspectionRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const { data: session } = useSession();
  const permissions = usePermissions();
  const [formReady, setFormReady] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const skipAutosaveRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftResumeCheckedRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const suppressCascadeRef = useRef(0);
  const subsystemFetchGenRef = useRef(0);
  const lruFetchGenRef = useRef(0);
  const sruFetchGenRef = useRef(0);
  const autofillGenRef = useRef(0);
  const skipAutofillRef = useRef(0);
  const [autofillSource, setAutofillSource] = useState<string | null>(null);
  const [loadedIrStatus, setLoadedIrStatus] = useState<string | null>(null);
  const [loadedRequestNumber, setLoadedRequestNumber] = useState<string | null>(null);
  const [hasExistingLogbook, setHasExistingLogbook] = useState(false);

  const [logbookFile, setLogbookFile] = useState<File | null>(null);
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [draftNoticeOpen, setDraftNoticeOpen] = useState(false);
  const [draftNoticeDocLabel, setDraftNoticeDocLabel] = useState('TS');

  const [projects, setProjects] = useState<Project[]>([]);
  const [subsystems, setSubsystems] = useState<Subsystem[]>([]);
  const [lrus, setLrus] = useState<LRU[]>([]);
  const [srus, setSrus] = useState<SRU[]>([]);
  const [availableSerials, setAvailableSerials] = useState<string[]>([]);
  const [inspectionTypeGroups, setInspectionTypeGroups] = useState<InspectionTypeGroup[]>([]);
  const [inspectionTypesError, setInspectionTypesError] = useState('');
  const [inspectionTypesLoading, setInspectionTypesLoading] = useState(false);
  const [requestApprovers, setRequestApprovers] = useState<Approver[]>([]);

  const [form, setForm] = useState(createEmptyPart1Form);

  useEffect(() => {
    fetchProjects();
    fetchInspectionTypes();
    fetchRequestApprovers();
  }, []);

  useEffect(() => {
    if (session?.user) {
      const name = session.user.name || '';
      const designation = String((session.user as { designation?: string }).designation || '').trim();
      setForm(prev => ({
        ...prev,
        designer_rep_name: prev.designer_rep_name || name,
        // Rank shown in “Designation” once profile loads; interim fallback from session
        designer_rep_designation: prev.designer_rep_designation || designation,
      }));
      fetch('/api/users/profile')
        .then(r => r.json())
        .then(data => {
            if (data.user) {
            if (data.user.signature_path) setUserSignature(data.user.signature_path);
            const u = data.user as { contact_number?: string; phone?: string; scientist_rank?: string; designation?: string };
            const contact = u.contact_number || u.phone || '';
            const rank = String(u.scientist_rank || '').trim();
            const des = String(u.designation || '').trim();
            if (contact) {
              setForm(prev => ({
                ...prev,
                designer_rep_contact: prev.designer_rep_contact || contact,
              }));
            }
            // New IR only: edit load merges profile + IR in its own effect (avoids wrong order)
            if (!editId) {
              setForm(prev => ({
                ...prev,
                designer_rep_designation: rank || des || prev.designer_rep_designation,
              }));
            }
          }
        })
        .catch(() => {});
    }
  }, [session, editId]);

  // Project/subsystem picks load options in handleProjectChange / handleSubsystemChange.
  // This effect only clears LRU/SRU lists when subsystem is cleared (e.g. after project change).
  useEffect(() => {
    if (suppressCascadeRef.current > 0) {
      suppressCascadeRef.current -= 1;
      return;
    }
    if (!form.subsystem_id) {
      setLrus([]);
      setSrus([]);
      setAvailableSerials([]);
    }
  }, [form.subsystem_id]);

  useEffect(() => {
    if (suppressCascadeRef.current > 0) {
      suppressCascadeRef.current -= 1;
      return;
    }
    if (form.lru_id) {
      fetchSrus(form.lru_id);
      setForm(prev => {
        const lru = lrus.find(l => String(l.id) === prev.lru_id);
        return { ...prev, sru_id: '', lru_nomenclature: lru?.name || prev.lru_nomenclature, serial_number: [] };
      });
    }
  }, [form.lru_id]);

  useEffect(() => {
    if (!editId || !session?.user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/inspection-requests/${editId}`);
        const data = await res.json();
        if (!res.ok || cancelled) {
          if (!cancelled) setSubmitError(data.error || 'Failed to load inspection request');
          return;
        }
        const ir = data.request;
        if (!ir || cancelled) return;
        if (
          !['draft', 'pending', 'returned_to_designer', 'pending_request_approval'].includes(ir.status)
        ) {
          setSubmitError('This inspection cannot be edited in its current status.');
          return;
        }
        const uid = parseInt((session.user as { id?: string }).id || '0', 10);
        const role = (session.user as { role?: string }).role;
        if (ir.initiator_id !== uid && role !== 'administrator') {
          setSubmitError('You can only edit your own inspection requests.');
          return;
        }
        await fetchSubsystems(String(ir.project_id));
        if (cancelled) return;
        await fetchLrus(String(ir.subsystem_id));
        if (cancelled) return;
        if (ir.lru_id) await fetchSrus(String(ir.lru_id));
        if (cancelled) return;

        let profileRank = '';
        let profileDes = '';
        try {
          const pr = await fetch('/api/users/profile');
          if (pr.ok) {
            const pBody = await pr.json();
            const u = pBody.user as { scientist_rank?: string; designation?: string; signature_path?: string } | undefined;
            if (u) {
              profileRank = String(u.scientist_rank || '').trim();
              profileDes = String(u.designation || '').trim();
              if (u.signature_path) setUserSignature(u.signature_path);
            }
          }
        } catch {
          /* use IR snapshot only */
        }
        if (cancelled) return;
        const designerRepDesignation =
          (profileRank || profileDes) || (String(ir.designer_rep_designation || '').trim() || '');

        const attRes = await fetch(
          `/api/attachments?entity_type=inspection_request&entity_id=${encodeURIComponent(String(ir.id))}`
        );
        if (attRes.ok) {
          const attData = await attRes.json();
          const list = attData.attachments || [];
          setHasExistingLogbook(
            list.some(
              (a: { description?: string }) =>
                String(a.description || '').toLowerCase().includes('log')
            )
          );
        }

        const dd = parseJsonObj(ir.document_details);
        const conf = parseJsonObj(ir.confirmations);

        const baseDocs = DOC_TYPES.reduce(
          (acc, d) => ({
            ...acc,
            [d.key]: { approved: '', doc_no: '', amd_no: '', rev_no: '', date: '' },
          }),
          {} as Record<string, { approved: string; doc_no: string; amd_no: string; rev_no: string; date: string }>
        );
        if (dd) {
          for (const d of DOC_TYPES) {
            const row = dd[d.key];
            if (row && typeof row === 'object' && !Array.isArray(row)) {
              const r = row as Record<string, unknown>;
              baseDocs[d.key] = {
                approved: String(r.approved ?? ''),
                doc_no: String(r.doc_no ?? ''),
                amd_no: String(r.amd_no ?? ''),
                rev_no: String(r.rev_no ?? ''),
                date: (() => {
                  const x = r.date;
                  if (x == null || String(x).trim() === '') return '';
                  const n = toDateOnlyYmd(x);
                  if (n) return n;
                  return String(x).trim();
                })(),
              };
            }
          }
        }

        const reqDate = ir.created_at
          ? toDateTimeLocalValue(ir.created_at)
          : ir.request_date != null
            ? toDateTimeLocalValue(ir.request_date)
            : getLocalDateTimeNow();

        const serialStr = ir.serial_number != null ? String(ir.serial_number) : '';
        const serialArr = serialStr
          ? serialStr.split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];

        if (cancelled) return;

        const unitParsed = parseDbStringArray(ir.item_pertains_to).filter((v) => v !== 'other');
        // Unit type: at most one; legacy multi-value rows use first
        const item_pertains_to = unitParsed.length > 0 ? [unitParsed[0]] : [];
        const tt0 = parseDbStringArray(ir.test_type);
        const tOther = String(ir.test_type_other || '').trim();
        const testMerged = tOther && !tt0.includes('other') ? [...tt0, 'other'] : tt0;
        // Test type: at most one; legacy multi-value rows use first
        const test_type = testMerged.length > 0 ? [testMerged[0]] : [];

        const previousStageCleared = parsePreviousStageCleared(ir.previous_stage_cleared);

        // Skip project/subsystem/lru cascade clears on the next effect runs. React 18 Strict Mode
        // in dev runs each effect twice (3 effects × 2 = 6); otherwise the second pass wipes loaded IDs.
        suppressCascadeRef.current = 6;
        skipAutosaveRef.current = 3;
        skipAutofillRef.current = 2;
        setLoadedIrStatus(ir.status);
        setLoadedRequestNumber(ir.request_number || null);
        setForm({
          project_id: String(ir.project_id || ''),
          subsystem_id: String(ir.subsystem_id || ''),
          lru_id: String(ir.lru_id || ''),
          sru_id: String(ir.sru_id || ''),
          item_pertains_to,
          test_type,
          test_type_other: tOther,
          so_details: ir.so_details || '',
          delivery_period: String(ir.delivery_period || ''),
          source: ir.source || '',
          oem_name: ir.oem_name || '',
          lru_nomenclature: ir.lru_nomenclature || '',
          criticality: parseDbStringArray(ir.criticality),
          part_number: ir.part_number || '',
          serial_number: serialArr,
          quantity:
            ir.quantity != null && ir.quantity_per_set != null ? String(ir.quantity) : '',
          quantity_per_set:
            ir.quantity != null && ir.quantity_per_set != null ? String(ir.quantity_per_set) : '',
          total_quantity:
            ir.quantity != null && ir.quantity_per_set == null ? String(ir.quantity) : '',
          previous_stage_cleared_answer: previousStageCleared.answer,
          previous_stage_cleared: previousStageCleared.stages,
          logbook_attached: ir.logbook_attached || '',
          inspection_type: ir.inspection_type || '',
          inspection_stage: ir.inspection_stage
            ? String(ir.inspection_stage).split(',').map((s: string) => s.trim()).filter(Boolean)
            : [],
          inspection_mode: ir.inspection_mode || '',
          inspection_datetime: toDateTimeLocalValue(ir.inspection_datetime || ir.inspection_date_from),
          inspection_date_from: toDateTimeLocalValue(ir.inspection_date_from || ir.inspection_datetime),
          inspection_date_to: toDateTimeLocalValue(ir.inspection_date_to),
          venue_category: parsePart1Venue(ir.venue || '').category,
          venue_detail: parsePart1Venue(ir.venue || '').detail,
          document_details: baseDocs,
          confirmations: {
            approved_docs_available: String(conf?.approved_docs_available ?? ''),
            logbook_updated: String(conf?.logbook_updated ?? ''),
            previous_observations_status: String(conf?.previous_observations_status ?? ''),
            cocs_available: String(conf?.cocs_available ?? ''),
            instruments_available: String(conf?.instruments_available ?? ''),
            joint_inspection_request: String(conf?.joint_inspection_request ?? ''),
          },
          designer_rep_name: ir.designer_rep_name || '',
          designer_rep_designation: designerRepDesignation,
          designer_rep_contact: ir.designer_rep_contact || '',
          design_coordinator_name: ir.design_coordinator_name || '',
          certified_by_name: ir.certified_by_name || '',
          certified_by_designation: ir.certified_by_designation || '',
          nominated_request_approver_id:
            ir.nominated_request_approver_id != null ? String(ir.nominated_request_approver_id) : '',
          request_date: reqDate,
          description: ir.description || '',
        });
      } catch {
        if (!cancelled) setSubmitError('Failed to load inspection request');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, session?.user?.id]);

  // Radix Select/Dropdown useId() — defer until mounted so SSR and client IDs match.
  useEffect(() => {
    setFormReady(true);
  }, []);

  const buildApiPayload = useCallback((formState: typeof form) => {
    const {
      total_quantity: _totalQtyUI,
      previous_stage_cleared_answer: _pscAnswer,
      venue_category,
      venue_detail,
      ...formForApi
    } = formState;
    return {
      ...formForApi,
      venue: formatPart1Venue(venue_category, venue_detail),
      item_pertains_to: formState.item_pertains_to.filter((v) => v !== 'other'),
      item_pertains_to_other: null,
      project_id: formState.project_id ? parseInt(formState.project_id, 10) : null,
      subsystem_id: formState.subsystem_id ? parseInt(formState.subsystem_id, 10) : null,
      lru_id: formState.lru_id ? parseInt(formState.lru_id, 10) : null,
      sru_id: formState.sru_id ? parseInt(formState.sru_id, 10) : null,
      quantity: formState.total_quantity.trim()
        ? parseInt(formState.total_quantity, 10)
        : formState.quantity
          ? parseInt(formState.quantity, 10)
          : null,
      quantity_per_set: formState.total_quantity.trim() ? null : formState.quantity_per_set ? parseInt(formState.quantity_per_set, 10) : null,
      serial_number: formState.serial_number.join(', '),
      previous_stage_cleared:
        formState.previous_stage_cleared_answer === 'no'
          ? 'no'
          : formState.previous_stage_cleared.join(', '),
      inspection_stage: formState.inspection_stage.join(', '),
      inspection_datetime: formState.inspection_date_from || null,
      inspection_date_from: formState.inspection_date_from || null,
      inspection_date_to: formState.inspection_date_to || null,
      due_date:
        (formState.inspection_date_to && formState.inspection_date_to.slice(0, 10)) ||
        (formState.inspection_date_from && formState.inspection_date_from.slice(0, 10)) ||
        formState.request_date,
      nominated_request_approver_id: formState.nominated_request_approver_id
        ? parseInt(formState.nominated_request_approver_id, 10)
        : null,
    };
  }, []);

  const performAutosave = useCallback(() => {
    if (!session?.user || isSubmitting || editId) return;
    if (skipAutosaveRef.current > 0) return;

    const uid = (session.user as { id?: string }).id;
    if (!uid) return;

    setAutosaveStatus('saving');
    try {
      savePart1FormDraftLocal(uid, form as unknown as Record<string, unknown>);
      setAutosaveStatus('saved');
      setTimeout(() => setAutosaveStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
    } catch (e) {
      console.error('Autosave error:', e);
      setAutosaveStatus('error');
    }
  }, [session?.user, isSubmitting, editId, form]);

  const handleClearLocalData = () => {
    if (editId || isSubmitting) return;
    if (
      !window.confirm(
        'Clear all form data and remove locally saved progress? This cannot be undone.',
      )
    ) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const uid = (session?.user as { id?: string })?.id;
    if (uid) clearPart1FormDraftLocal(uid);

    skipAutosaveRef.current = 2;
    suppressCascadeRef.current = 2;
    skipAutofillRef.current = 2;
    setAutosaveStatus('idle');
    setSubmitError('');
    setFieldErrors({});
    setLogbookFile(null);
    setAutofillSource(null);
    setHasExistingLogbook(false);
    setSubsystems([]);
    setLrus([]);
    setSrus([]);
    setAvailableSerials([]);

    const name = session?.user?.name || '';
    const designation = String(
      (session?.user as { designation?: string })?.designation || '',
    ).trim();

    setForm({
      ...createEmptyPart1Form(),
      request_date: normalizePart1RequestCreationDateTime(''),
      designer_rep_name: form.designer_rep_name || name,
      designer_rep_designation: form.designer_rep_designation || designation,
      designer_rep_contact: form.designer_rep_contact,
    });
  };

  useEffect(() => {
    if (!formReady || !session?.user) return;
    if (skipAutosaveRef.current > 0) {
      skipAutosaveRef.current -= 1;
      return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, 2000);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [form, formReady, session?.user, performAutosave]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects?status=active');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (e) { console.error(e); }
  };

  const fetchSubsystems = async (projectId: string) => {
    const gen = ++subsystemFetchGenRef.current;
    try {
      const res = await fetch(`/api/subsystems?project_id=${projectId}`);
      const data = await res.json();
      if (gen !== subsystemFetchGenRef.current) return;
      setSubsystems(data.subsystems || []);
    } catch (e) { console.error(e); }
  };

  const fetchLrus = async (subsystemId: string) => {
    const gen = ++lruFetchGenRef.current;
    try {
      const res = await fetch(`/api/lrus?subsystem_id=${subsystemId}`);
      const data = await res.json();
      if (gen !== lruFetchGenRef.current) return;
      setLrus(data.lrus || []);
    } catch (e) { console.error(e); }
  };

  const fetchSrus = async (lruId: string) => {
    const gen = ++sruFetchGenRef.current;
    try {
      const res = await fetch(`/api/srus?lru_id=${lruId}`);
      const data = await res.json();
      if (gen !== sruFetchGenRef.current) return;
      setSrus(data.srus || []);
    } catch (e) { console.error(e); }
  };

  const handleProjectChange = (projectId: string) => {
    setSubsystems([]);
    setLrus([]);
    setSrus([]);
    setAvailableSerials([]);
    setForm((prev) => ({
      ...prev,
      project_id: projectId,
      subsystem_id: '',
      lru_id: '',
      sru_id: '',
      lru_nomenclature: '',
      part_number: '',
      serial_number: [],
    }));
    if (projectId) void fetchSubsystems(projectId);
  };

  const handleSubsystemChange = (subsystemId: string) => {
    setLrus([]);
    setSrus([]);
    setAvailableSerials([]);
    setForm((prev) => ({
      ...prev,
      subsystem_id: subsystemId,
      lru_id: '',
      sru_id: '',
      lru_nomenclature: '',
      part_number: '',
      serial_number: [],
    }));
    if (subsystemId) void fetchLrus(subsystemId);
  };

  // Restore in-progress Part I from browser storage (no server record until submit).
  useEffect(() => {
    if (!formReady || editId) return;

    if (!session?.user) {
      setForm((prev) => ({
        ...prev,
        request_date: normalizePart1RequestCreationDateTime(prev.request_date),
      }));
      return;
    }

    if (draftResumeCheckedRef.current) return;
    draftResumeCheckedRef.current = true;
    const uid = (session.user as { id?: string }).id;
    if (!uid) {
      setForm((prev) => ({
        ...prev,
        request_date: normalizePart1RequestCreationDateTime(prev.request_date),
      }));
      return;
    }
    const saved = loadPart1FormDraftLocal(uid);
    if (!saved?.form) {
      setForm((prev) => ({
        ...prev,
        request_date: normalizePart1RequestCreationDateTime(prev.request_date),
      }));
      return;
    }

    (async () => {
      let draft = saved.form as typeof form & { venue?: string };
      draft.request_date = normalizePart1RequestCreationDateTime(draft.request_date);
      if (!draft.venue_category && draft.venue) {
        const parsed = parsePart1Venue(draft.venue);
        draft = {
          ...draft,
          venue_category: parsed.category,
          venue_detail: parsed.detail,
        };
      }
      let loadedSubsystems: Subsystem[] = [];
      if (draft.project_id) {
        const res = await fetch(`/api/subsystems?project_id=${draft.project_id}`);
        const data = await res.json();
        loadedSubsystems = data.subsystems || [];
        setSubsystems(loadedSubsystems);
      }
      if (
        draft.subsystem_id &&
        !loadedSubsystems.some((s) => String(s.id) === String(draft.subsystem_id))
      ) {
        draft = {
          ...draft,
          subsystem_id: '',
          lru_id: '',
          sru_id: '',
          lru_nomenclature: '',
          part_number: '',
          serial_number: [],
        };
      }
      if (draft.subsystem_id) await fetchLrus(String(draft.subsystem_id));
      if (draft.lru_id) await fetchSrus(String(draft.lru_id));
      if (draft.venue_category) {
        const submissionDate = parsePart1RequestSubmissionDate(draft.request_date);
        const suggestedFrom = getPart1InspectionFromMinDateTime(
          draft.request_date,
          draft.venue_category,
          submissionDate,
        );
        if (suggestedFrom) draft.inspection_date_from = suggestedFrom;
      }
      suppressCascadeRef.current = 6;
      skipAutosaveRef.current = 2;
      skipAutofillRef.current = 2;
      setForm((prev) => ({ ...prev, ...draft }));
    })();
  }, [formReady, session?.user, editId]);

  const fetchInspectionTypes = async (attempt = 1) => {
    const maxAttempts = 5;
    if (attempt === 1) {
      setInspectionTypesLoading(true);
      setInspectionTypesError('');
    }
    try {
      const res = await fetch('/api/inspection-types?active_only=true');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to load inspection types (${res.status})`);
      }
      setInspectionTypeGroups(data.groups || []);
      if (!(data.groups || []).length) {
        setInspectionTypesError('No active inspection types found. Add them under Inspection Types.');
      } else {
        setInspectionTypesError('');
      }
      setInspectionTypesLoading(false);
    } catch (e) {
      console.error(e);
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 800));
        return fetchInspectionTypes(attempt + 1);
      }
      setInspectionTypeGroups([]);
      setInspectionTypesError(
        e instanceof Error ? e.message : 'Failed to load inspection types. Click retry.',
      );
      setInspectionTypesLoading(false);
    }
  };

  const fetchRequestApprovers = async () => {
    try {
      const res = await fetch('/api/users?role=request_approver&status=active');
      const data = await res.json();
      setRequestApprovers(data.users || []);
    } catch (e) { console.error(e); }
  };

  const parseSerials = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
  };

  const handleLruChange = (lruId: string) => {
    const lru = lrus.find(l => String(l.id) === lruId);
    setAvailableSerials(parseSerials(lru?.serial_numbers));
    setAutofillSource(null);
    setForm(prev => ({
      ...prev,
      lru_id: lruId,
      sru_id: '',
      lru_nomenclature: lru?.name || '',
      part_number: lru?.part_number || '',
      serial_number: [],
    }));
  };

  const handleSruChange = (sruId: string) => {
    const lru = lrus.find(l => String(l.id) === form.lru_id);
    const sru = srus.find(s => String(s.id) === sruId);
    const nomenclature = sru
      ? `${lru?.name || ''} / ${sru.name}`
      : lru?.name || '';
    const partNumber = sru?.part_number
      ? `${lru?.part_number || ''} / ${sru.part_number}`.replace(/^\s*\/\s*/, '')
      : lru?.part_number || '';
    const serials = sru ? parseSerials(sru.serial_numbers) : parseSerials(lru?.serial_numbers);
    setAvailableSerials(serials);
    setAutofillSource(null);
    setForm(prev => ({
      ...prev,
      sru_id: sruId,
      lru_nomenclature: nomenclature,
      part_number: partNumber,
      serial_number: [],
    }));
  };

  const fetchAndApplyAutofill = useCallback(async (lruId: string, serialNumbers: string[]) => {
    if (!lruId || serialNumbers.length === 0) {
      if (serialNumbers.length === 0) setAutofillSource(null);
      return;
    }
    if (editId) return;
    const gen = ++autofillGenRef.current;
    const serial = serialNumbers[0];
    try {
      const params = new URLSearchParams({ lru_id: lruId, serial_number: serial });
      if (editId) params.set('exclude_id', editId);
      const res = await fetch(`/api/inspection-requests/lookup?${params}`);
      const data = await res.json();
      if (gen !== autofillGenRef.current) return;
      if (!res.ok || !data.request) {
        setAutofillSource(null);
        return;
      }
      skipAutosaveRef.current += 1;
      const mapped = mapPreviousIrToPart1Form(data.request);
      setForm(prev => {
        const submissionDate = parsePart1RequestSubmissionDate(prev.request_date);
        const suggestedFrom = mapped.venue_category
          ? getPart1InspectionFromMinDateTime(
              prev.request_date,
              mapped.venue_category,
              submissionDate,
            )
          : '';
        return {
          ...prev,
          ...mapped,
          ...(suggestedFrom ? { inspection_date_from: suggestedFrom } : {}),
          serial_number: serialNumbers,
          lru_nomenclature: prev.lru_nomenclature,
          part_number: prev.part_number,
          request_date: prev.request_date,
          designer_rep_name: prev.designer_rep_name,
          designer_rep_designation: prev.designer_rep_designation,
          designer_rep_contact: prev.designer_rep_contact,
        };
      });
      setAutofillSource(String(data.request.request_number || ''));
    } catch (e) {
      console.error(e);
      if (gen === autofillGenRef.current) setAutofillSource(null);
    }
  }, [editId]);

  useEffect(() => {
    if (skipAutofillRef.current > 0) {
      skipAutofillRef.current -= 1;
      return;
    }
    if (editId || !form.lru_id || form.serial_number.length === 0) {
      if (form.serial_number.length === 0) setAutofillSource(null);
      return;
    }
    const timer = setTimeout(() => {
      void fetchAndApplyAutofill(form.lru_id, form.serial_number);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.lru_id, form.serial_number.join('|'), editId, fetchAndApplyAutofill]);

  const handleCertifierChange = (approverId: string) => {
    const approver = requestApprovers.find(a => String(a.id) === approverId);
    setForm(prev => ({
      ...prev,
      nominated_request_approver_id: approverId,
      certified_by_name: approver?.name || '',
    }));
  };

  const toggleCheckbox = (field: 'item_pertains_to' | 'test_type' | 'criticality', value: string) => {
    setForm(prev => {
      if (field === 'item_pertains_to' || field === 'test_type') {
        const cur = prev[field];
        if (cur.includes(value)) {
          const o: typeof prev = { ...prev, [field]: [] as string[] };
          if (field === 'test_type' && value === 'other') o.test_type_other = '';
          return o;
        }
        const o: typeof prev = { ...prev, [field]: [value] };
        if (field === 'test_type' && value !== 'other') o.test_type_other = '';
        return o;
      }
      const arr = prev[field];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...prev, [field]: next };
    });
  };

  const updateDocDetail = (key: string, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      document_details: {
        ...prev.document_details,
        [key]: { ...prev.document_details[key], [field]: value },
      },
    }));
  };

  const handleDocApprovedChange = (docKey: string, value: string) => {
    updateDocDetail(docKey, 'approved', value);
    if (value === 'draft') {
      setDraftNoticeDocLabel(docRowLabel(docKey));
      setDraftNoticeOpen(true);
    }
  };

  const updateConfirmation = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      confirmations: { ...prev.confirmations, [key]: value },
    }));
  };

  const getRequestSubmissionDate = useCallback(
    () => parsePart1RequestSubmissionDate(form.request_date),
    [form.request_date],
  );

  const applyAdvanceNoticeFieldError = (venueCategory: string, inspectionDateFrom: string) => {
    const submissionDate = getRequestSubmissionDate();
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (!venueCategory || !inspectionDateFrom) {
        delete next.inspection_date_from;
        return next;
      }
      const { date, time } = parseDateTimeLocalParts(inspectionDateFrom);
      if (!date || !time) {
        delete next.inspection_date_from;
        return next;
      }
      const notice = validatePart1InspectionAdvanceNotice(
        venueCategory,
        inspectionDateFrom,
        submissionDate,
        form.request_date,
      );
      if (!notice.valid && notice.message) {
        next.inspection_date_from = notice.message;
      } else {
        delete next.inspection_date_from;
      }
      return next;
    });
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    const today = getLocalYmdToday();
    const requestDay = form.request_date.slice(0, 10);
    if (
      requestDay &&
      requestDay < today &&
      loadedIrStatus !== 'returned_to_designer' &&
      loadedIrStatus !== 'pending_request_approval'
    )
      errors.request_date = 'Request date cannot be before today';
    if (!form.project_id) errors.project_id = '1. Programme/Project is required';
    if (!form.subsystem_id) errors.subsystem_id = '2. Subsystem is required';
    if (form.item_pertains_to.length === 0 && form.test_type.length === 0)
      errors.item_pertains_to = '3. At least one Item Pertains To selection is required';
    if (form.test_type.includes('other') && !form.test_type_other.trim()) {
      errors.test_type_other = '3. Please specify the Other test type';
    }
    if (!form.so_details.trim()) errors.so_details = '4. SO Details is required';
    if (!form.delivery_period) errors.delivery_period = 'Delivery Period is required';
    else if (form.request_date && form.delivery_period < form.request_date.slice(0, 10))
      errors.delivery_period = 'Delivery period must be on or after the request date';
    if (!form.source) errors.source = '5. Source is required';
    if (!form.oem_name.trim()) errors.oem_name = 'OEM Name is required';
    if (!form.lru_id) errors.lru_id = '6. LRU Nomenclature is required';
    if (form.criticality.length === 0) errors.criticality = '7. Criticality of Store is required';
    if (!form.part_number.trim()) errors.part_number = '8. Part Number is required';
    if (form.serial_number.length === 0) errors.serial_number = '9. Serial Number is required';
    {
      const tq = form.total_quantity.trim();
      const sets = form.quantity.trim();
      const per = form.quantity_per_set.trim();
      const isPositiveInt = (s: string) => /^\d+$/.test(s) && parseInt(s, 10) >= 1;
      if (tq) {
        if (!isPositiveInt(tq)) {
          errors.total_quantity = '11. Qty must be a positive whole number';
        }
      } else if (sets && per) {
        if (!isPositiveInt(sets)) errors.quantity = '10. No. of sets must be a positive whole number';
        if (!isPositiveInt(per)) errors.quantity_per_set = '10. Qty per set must be a positive whole number';
      } else if (sets || per) {
        if (sets && !per) errors.quantity_per_set = '10. Enter both no. of sets and qty per set, or use 11. Qty only';
        if (!sets && per) errors.quantity = '10. Enter both no. of sets and qty per set, or use 11. Qty only';
      } else {
        errors.quantity = '10 or 11 is required: use 10 (sets and qty/set) or 11 (total qty)';
      }
    }
    if (!form.previous_stage_cleared_answer) {
      errors.previous_stage_cleared = '12. Previous Stage Cleared is required';
    } else if (form.previous_stage_cleared_answer === 'yes' && form.previous_stage_cleared.length === 0) {
      errors.previous_stage_cleared = '12. Select at least one inspection type when Yes is selected';
    }
    if (!form.logbook_attached) errors.logbook_attached = '13. Log Book Copy Attached is required';
    if (form.logbook_attached === 'yes' && !logbookFile && !hasExistingLogbook) {
      errors.logbook_attached = '13. A file upload is required when Yes is selected';
    }
    if (form.inspection_stage.length === 0) errors.inspection_stage = '14. Inspection Stage is required';
    if (!form.inspection_mode) errors.inspection_mode = '15. Mode of Inspection is required';
    if (!form.venue_category) errors.venue = '16. Select a venue type';
    else if (!form.venue_detail.trim()) errors.venue = '16. Enter venue location details';
    if (!form.inspection_date_from) errors.inspection_date_from = '17. From (date & time) is required';
    else {
      const submissionDate = getRequestSubmissionDate();
      if (form.request_date && form.inspection_date_from < form.request_date)
        errors.inspection_date_from = 'From must be on or after the request date & time';
      else if (form.venue_category) {
        const notice = validatePart1InspectionAdvanceNotice(
          form.venue_category,
          form.inspection_date_from,
          submissionDate,
          form.request_date,
        );
        if (!notice.valid && notice.message) {
          errors.inspection_date_from = notice.message;
        }
      }
    }
    if (!form.inspection_date_to) errors.inspection_date_to = '17. To (date & time) is required';
    else if (form.inspection_date_from && form.inspection_date_to < form.inspection_date_from)
      errors.inspection_date_to = 'To must be on or after from (date & time)';
    {
      const tsDoc = form.document_details['ts'];
      if (!tsDoc?.approved) {
        errors.document_details = '18. TS — Approval status is required';
        errors[DOC_ROW_HIGHLIGHT_KEY] = 'ts';
      } else if (tsDoc.approved !== 'na') {
        if (!tsDoc?.doc_no?.trim()) {
          errors.document_details = '18. TS — Controlled document number is required';
          errors[DOC_ROW_HIGHLIGHT_KEY] = 'ts';
        } else if (String(tsDoc?.amd_no ?? '').trim() === '') {
          errors.document_details = '18. TS — Amendment (Amd) no. is required';
          errors[DOC_ROW_HIGHLIGHT_KEY] = 'ts';
        } else if (String(tsDoc?.rev_no ?? '').trim() === '') {
          errors.document_details = '18. TS — Revision (Rev.) no. is required';
          errors[DOC_ROW_HIGHLIGHT_KEY] = 'ts';
        } else if (!tsDoc?.date?.trim()) {
          errors.document_details = '18. TS — Date is required';
          errors[DOC_ROW_HIGHLIGHT_KEY] = 'ts';
        }
      }
    }
    if (!errors.document_details) {
      for (const key of OPTIONAL_DOC_KEYS) {
        const d = form.document_details[key];
        if (!docRowStarted(d)) continue;
        const label = docRowLabel(key);
        if (!d?.approved) {
          errors.document_details = `18. ${label} — Complete the row: approval status is required`;
          errors[DOC_ROW_HIGHLIGHT_KEY] = key;
          break;
        }
        if (d.approved === 'na') continue;
        if (!d?.doc_no?.trim()) {
          errors.document_details = `18. ${label} — Controlled document number is required`;
          errors[DOC_ROW_HIGHLIGHT_KEY] = key;
          break;
        }
        if (String(d?.amd_no ?? '').trim() === '') {
          errors.document_details = `18. ${label} — Amendment (Amd) no. is required`;
          errors[DOC_ROW_HIGHLIGHT_KEY] = key;
          break;
        }
        if (String(d?.rev_no ?? '').trim() === '') {
          errors.document_details = `18. ${label} — Revision (Rev.) no. is required`;
          errors[DOC_ROW_HIGHLIGHT_KEY] = key;
          break;
        }
        if (!d?.date?.trim()) {
          errors.document_details = `18. ${label} — Date is required`;
          errors[DOC_ROW_HIGHLIGHT_KEY] = key;
          break;
        }
      }
    }
    const unanswered = Object.entries(form.confirmations).filter(([, v]) => !v);
    if (unanswered.length > 0) errors.confirmations = '19. All confirmations must be answered';
    if (!form.nominated_request_approver_id?.trim()) {
      errors.nominated_request_approver_id = '21. Designer DH/GD/TH Name (Certifier) is required';
    }
    if (!form.certified_by_designation?.trim()) {
      errors.certified_by_designation = '21. Designation is required';
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setFieldErrors({});

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const messages = Object.entries(errors)
        .filter(([k]) => k !== DOC_ROW_HIGHLIGHT_KEY)
        .map(([, v]) => v);
      setSubmitError(`Please fill all mandatory fields:\n${messages.join(', ')}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    try {
      const recordId = editId;
      const payload = {
        ...buildApiPayload(form),
        ...(recordId && loadedIrStatus === 'draft' ? { submit: true } : {}),
      };

      const res = recordId
        ? await fetch(`/api/inspection-requests/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/inspection-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      if (res.ok) {
        const bodyJson = await res.json();
        const targetId = recordId ? parseInt(recordId, 10) : bodyJson.request?.id;

        if (logbookFile && targetId) {
          try {
            const fd = new FormData();
            fd.append('file', logbookFile);
            fd.append('entity_type', 'inspection_request');
            fd.append('entity_id', String(targetId));
            fd.append('description', 'Log Book Copy');
            await fetch('/api/attachments', { method: 'POST', body: fd });
          } catch (uploadErr) {
            console.error('Logbook upload failed:', uploadErr);
          }
        }

        const uid = (session?.user as { id?: string })?.id;
        if (uid) clearPart1FormDraftLocal(uid);

        router.push(recordId ? `/dashboard/inspections/${recordId}` : '/dashboard/inspections');
      } else {
        const data = await res.json();
        setSubmitError(data.error || (editId ? 'Failed to update inspection request.' : 'Failed to create inspection request.'));
      }
    } catch (error) {
      setSubmitError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const errClass = (field: string) => fieldErrors[field] ? 'border-red-500 ring-1 ring-red-500' : '';
  const errMsg = (field: string) => fieldErrors[field] ? <p className="text-xs text-red-500 mt-1">{fieldErrors[field]}</p> : null;
  const docRowErrClass = (docKey: string) =>
    fieldErrors.document_details && fieldErrors[DOC_ROW_HIGHLIGHT_KEY] === docKey ? 'border-red-500 ring-1 ring-red-500' : '';

  const CheckboxGroup = ({ items, selected, onChange }: {
    items: { value: string; label: string }[];
    selected: string[];
    onChange: (value: string) => void;
  }) => (
    <div className="flex flex-wrap gap-3">
      {items.map(item => (
        <label key={item.value} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(item.value)}
            onChange={() => onChange(item.value)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm">{item.label}</span>
        </label>
      ))}
    </div>
  );

  if (!formReady) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {editId ? 'Edit inspection request (Part I)' : 'Request for R&QA Inspection/Testing'}
            </h2>
            <p className="text-base text-muted-foreground">
              {editId ? 'Update details, then return to the IR to resubmit if required.' : 'Part I - Details of item(s) to be inspected'}
            </p>
          </div>
        </div>
        <div className="py-16 text-center text-muted-foreground">Loading form…</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {editId ? 'Edit inspection request (Part I)' : 'Request for R&QA Inspection/Testing'}
          </h2>
          <p className="text-base text-muted-foreground">
            {editId
              ? loadedIrStatus === 'draft'
                ? 'Draft on server — submit when complete.'
                : 'Update details, then return to the IR to resubmit if required.'
              : 'Part I - Details of item(s) to be inspected (progress saves locally until you submit)'}
          </p>
          {loadedRequestNumber && editId && (
            <p className="text-sm font-mono text-muted-foreground mt-1">{loadedRequestNumber}</p>
          )}
        </div>
        {!editId && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground sm:ml-auto sm:pt-2 shrink-0">
          {autosaveStatus === 'saving' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving…</span>
            </>
          )}
          {autosaveStatus === 'saved' && (
            <span className="text-emerald-600 dark:text-emerald-400">Progress saved</span>
          )}
          {autosaveStatus === 'error' && (
            <span className="text-destructive">Could not save progress locally</span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleClearLocalData}
            disabled={isSubmitting}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear data
          </Button>
        </div>
        )}
      </div>

      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">

        {/* Section: IR Number, Date */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>IR Number</Label>
                <Input
                  value={editId && loadedRequestNumber ? loadedRequestNumber : 'Auto-generated on submit'}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  {editId ? 'Request number is fixed' : 'Assigned automatically upon submission'}
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Date &amp; Time *</Label>
                <DateTimeLocalInput
                  className="h-9"
                  value={form.request_date}
                  min={
                    loadedIrStatus === 'returned_to_designer' ||
                    loadedIrStatus === 'pending_request_approval'
                      ? undefined
                      : getLocalYmdToday()
                  }
                  disabled={!!editId}
                  pickerAriaLabel="Request creation date and time"
                  onChange={(v) => {
                    setForm((prev) => {
                      const next = { ...prev, request_date: v };
                      if (prev.venue_category) {
                        const submissionDate = parsePart1RequestSubmissionDate(v);
                        const suggested = getPart1InspectionFromMinDateTime(
                          v,
                          prev.venue_category,
                          submissionDate,
                        );
                        if (suggested) {
                          next.inspection_date_from = suggested;
                          if (prev.inspection_date_to && prev.inspection_date_to < suggested) {
                            next.inspection_date_to = '';
                          }
                          queueMicrotask(() =>
                            applyAdvanceNoticeFieldError(prev.venue_category, suggested),
                          );
                        }
                      }
                      return next;
                    });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  {editId
                    ? 'Creation date and time (fixed for this request)'
                    : 'Request creation date and time — used for venue advance notice'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section: Programme / Project / Subsystem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Programme & Item Details</CardTitle>
            <CardDescription>1-3: Project, Subsystem, and Item classification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>1. Programme/Project *</Label>
                <SearchableCodeNameSelect
                  items={projects}
                  value={form.project_id}
                  onChange={handleProjectChange}
                  errorClassName={errClass('project_id')}
                  placeholder="Search or select project..."
                  searchPlaceholder="Search project code or name..."
                />
                {errMsg('project_id')}
              </div>
              <div className="grid gap-2">
                <Label>2. Subsystem *</Label>
                <SearchableCodeNameSelect
                  items={subsystems}
                  value={form.subsystem_id}
                  onChange={handleSubsystemChange}
                  disabled={!form.project_id}
                  errorClassName={errClass('subsystem_id')}
                  placeholder="Search or select subsystem..."
                  disabledPlaceholder="Select project first"
                  searchPlaceholder="Search subsystem code or name..."
                />
                {errMsg('subsystem_id')}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>3. Item Pertains to *</Label>
              {errMsg('item_pertains_to')}
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-muted-foreground font-medium mb-1 block">Unit Type</span>
                  <CheckboxGroup
                    items={[
                      { value: 'airborne', label: 'Airborne Unit' },
                      { value: 'ground', label: 'Ground Unit' },
                      { value: 'prototype', label: 'Prototype' },
                    ]}
                    selected={form.item_pertains_to}
                    onChange={(v) => toggleCheckbox('item_pertains_to', v)}
                  />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground font-medium mb-1 block">Test Type</span>
                  <CheckboxGroup
                    items={[
                      { value: 'soft', label: 'SOFT' },
                      { value: 'qt', label: 'Full QT' },
                      { value: 'lqt_iqt', label: 'LQT/IQT' },
                      { value: 'at', label: 'AT' },
                      { value: 'pqt', label: 'PQT' },
                      { value: 'system_level_test', label: 'System-level Test' },
                      { value: 'lab_testing', label: 'Lab/LRU testing' },
                      { value: 'other', label: 'Other' },
                    ]}
                    selected={form.test_type}
                    onChange={(v) => toggleCheckbox('test_type', v)}
                  />
                  {form.test_type.includes('other') && (
                    <div className="mt-2 max-w-md">
                      <Label className="text-xs">Specify (Test Type)</Label>
                      <Input
                        className={cn('mt-1 h-9', errClass('test_type_other'))}
                        value={form.test_type_other}
                        onChange={(e) => setForm({ ...form, test_type_other: e.target.value })}
                        placeholder="Specify test type"
                      />
                      {errMsg('test_type_other')}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Section: SO, Source, LRU */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supply Order & LRU Details</CardTitle>
            <CardDescription>4-11: Supply order, source, LRU identification, and quantity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>4. SO Details *</Label>
                <Input className={errClass('so_details')} value={form.so_details} onChange={(e) => setForm({ ...form, so_details: e.target.value })} placeholder="Supply Order number" />
                {errMsg('so_details')}
              </div>
              <div className="grid gap-2">
                <Label>Delivery Period *</Label>
                <CalendarDateInput
                  className={errClass('delivery_period')}
                  value={form.delivery_period}
                  min={form.request_date ? form.request_date.slice(0, 10) : undefined}
                  onChange={(v) => setForm({ ...form, delivery_period: v })}
                />
                {errMsg('delivery_period')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>5. Source *</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger className={errClass('source')}><SelectValue placeholder="Select source..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indigenous">Indigenous</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                  </SelectContent>
                </Select>
                {errMsg('source')}
              </div>
              <div className="grid gap-2">
                <Label>OEM Name *</Label>
                <Input className={errClass('oem_name')} value={form.oem_name} onChange={(e) => setForm({ ...form, oem_name: e.target.value })} placeholder="Original Equipment Manufacturer" />
                {errMsg('oem_name')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>6. LRU / SRU Nomenclature *</Label>
                <SearchableLruSelect
                  items={lrus}
                  value={form.lru_id}
                  onChange={handleLruChange}
                  disabled={!form.subsystem_id}
                  errorClassName={errClass('lru_id')}
                  placeholder="Search or select LRU..."
                  disabledPlaceholder="Select subsystem first"
                />
                {form.lru_id && srus.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Select value={form.sru_id} onValueChange={handleSruChange}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select SRU (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        {srus.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name} — {s.code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.sru_id && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleSruChange('')}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                {form.lru_nomenclature && (
                  <p className="text-xs text-muted-foreground">Nomenclature: <span className="font-medium text-foreground">{form.lru_nomenclature}</span></p>
                )}
                {errMsg('lru_id')}
              </div>
              <div className="grid gap-2">
                <Label>7. Criticality of Store *</Label>
                {errMsg('criticality')}
                <CheckboxGroup
                  items={[
                    { value: 'mission', label: 'Mission Critical' },
                    { value: 'flight', label: 'Flight Critical' },
                    { value: 'safety', label: 'Safety Critical' },
                    { value: 'non_critical', label: 'Non Critical' },
                  ]}
                  selected={form.criticality}
                  onChange={(v) => toggleCheckbox('criticality', v)}
                />
              </div>
            </div>

            <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>8. Part Number *</Label>
                <Input className={errClass('part_number')} value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} />
                {errMsg('part_number')}
              </div>
              <div className="grid gap-2">
                <Label>9. Serial Number *</Label>
                {availableSerials.length > 0 ? (
                  <>
                    <div className={`border rounded-md p-2 max-h-36 overflow-y-auto space-y-1 ${fieldErrors.serial_number ? 'border-red-500' : ''}`}>
                      {availableSerials.map((sn) => (
                        <label key={sn} className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded text-sm">
                          <input
                            type="checkbox"
                            checked={form.serial_number.includes(sn)}
                            onChange={(e) => {
                              setForm(prev => ({
                                ...prev,
                                serial_number: e.target.checked
                                  ? [...prev.serial_number, sn]
                                  : prev.serial_number.filter(s => s !== sn),
                              }));
                            }}
                            className="rounded"
                          />
                          {sn}
                        </label>
                      ))}
                    </div>
                    {form.serial_number.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {form.serial_number.map((sn) => (
                          <Badge key={sn} variant="secondary" className="gap-1 pr-1 text-xs">
                            {sn}
                            <button type="button" className="ml-0.5 hover:text-destructive" onClick={() => {
                              setForm(prev => ({ ...prev, serial_number: prev.serial_number.filter(s => s !== sn) }));
                            }}>
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Input
                    className={errClass('serial_number')}
                    placeholder={form.lru_id ? 'No serial numbers defined for this LRU/SRU' : 'Select LRU first'}
                    value={form.serial_number.join(', ')}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm(prev => ({ ...prev, serial_number: val ? val.split(',').map(s => s.trim()).filter(Boolean) : [] }));
                    }}
                  />
                )}
                {errMsg('serial_number')}
                {autofillSource && (
                  <p className="text-xs text-muted-foreground">
                    Other fields auto-filled from previous request{' '}
                    <span className="font-medium text-foreground">{autofillSource}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>10. No. of sets — Qty/set *</Label>
                <div
                  className={cn(
                    'flex h-9 min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-background ring-offset-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
                    (fieldErrors.quantity || fieldErrors.quantity_per_set) && 'border-red-500 ring-1 ring-red-500'
                  )}
                >
                  <Input
                    className="h-9 min-w-0 flex-1 rounded-none border-0 shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    disabled={form.total_quantity.trim() !== ''}
                    placeholder="Sets"
                    value={form.quantity}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                        total_quantity: '',
                      }))
                    }
                  />
                  <span className="flex shrink-0 items-center px-1.5 text-sm text-muted-foreground select-none" aria-hidden>—</span>
                  <Input
                    className="h-9 min-w-0 flex-1 rounded-none border-0 shadow-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    disabled={form.total_quantity.trim() !== ''}
                    placeholder="Qty/set"
                    value={form.quantity_per_set}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        quantity_per_set: e.target.value,
                        total_quantity: '',
                      }))
                    }
                  />
                </div>
                {errMsg('quantity')}
                {errMsg('quantity_per_set')}
              </div>
              <div className="grid gap-2">
                <Label>11. Qty *</Label>
                <Input
                  className={errClass('total_quantity')}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  disabled={form.quantity.trim() !== '' || form.quantity_per_set.trim() !== ''}
                  placeholder="Total quantity"
                  value={form.total_quantity}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      total_quantity: e.target.value,
                      quantity: '',
                      quantity_per_set: '',
                    }))
                  }
                />
                {errMsg('total_quantity')}
              </div>
            </div>
            </div>
          </CardContent>
        </Card>

        {/* Section: Inspection Stage & Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inspection Details</CardTitle>
            <CardDescription>12-17: Stage, mode, date and time, and venue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(inspectionTypesLoading || inspectionTypesError) && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                <span>
                  {inspectionTypesLoading
                    ? 'Loading inspection stage options…'
                    : inspectionTypesError}
                </span>
                {!inspectionTypesLoading && inspectionTypesError && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0"
                    onClick={() => fetchInspectionTypes()}
                  >
                    Retry
                  </Button>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>12. Previous Stage Cleared *</Label>
                <Select
                  value={form.previous_stage_cleared_answer}
                  onValueChange={(v) => {
                    setForm(prev => ({
                      ...prev,
                      previous_stage_cleared_answer: v,
                      previous_stage_cleared: v === 'yes' ? prev.previous_stage_cleared : [],
                    }));
                    setFieldErrors(prev => ({ ...prev, previous_stage_cleared: '' }));
                  }}
                >
                  <SelectTrigger className={errClass('previous_stage_cleared')}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {form.previous_stage_cleared_answer === 'yes' && (
                  <div className="grid gap-2">
                    <Label className="text-sm font-normal text-muted-foreground">Inspection type(s) *</Label>
                    <InspectionStageSelect
                      groups={inspectionTypeGroups}
                      selected={form.previous_stage_cleared}
                      onChange={(selected) => {
                        setForm(prev => ({ ...prev, previous_stage_cleared: selected }));
                        setFieldErrors(prev => ({ ...prev, previous_stage_cleared: '' }));
                      }}
                    />
                  </div>
                )}
                {errMsg('previous_stage_cleared')}
              </div>
              <div className="grid gap-2">
                <Label>13. Log Book Copy Attached *</Label>
                <Select value={form.logbook_attached} onValueChange={(v) => {
                  setForm({ ...form, logbook_attached: v });
                  if (v !== 'yes') setLogbookFile(null);
                  setFieldErrors(prev => ({ ...prev, logbook_attached: '' }));
                }}>
                  <SelectTrigger className={errClass('logbook_attached')}><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
                {form.logbook_attached === 'yes' && (
                  <div className="mt-1">
                    {logbookFile ? (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{logbookFile.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(logbookFile.size / 1024).toFixed(0)} KB
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setLogbookFile(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <label
                        className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors ${
                          fieldErrors.logbook_attached && form.logbook_attached === 'yes' && !logbookFile
                            ? 'border-red-500 ring-1 ring-red-500'
                            : ''
                        }`}
                      >
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Attach log book copy (max 10MB) *</span>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              if (f.size > 10 * 1024 * 1024) {
                                alert('File size exceeds 10MB limit');
                                return;
                              }
                              setLogbookFile(f);
                              setFieldErrors(prev => ({ ...prev, logbook_attached: '' }));
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                )}
                {errMsg('logbook_attached')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>14. Inspection Stage Offered Now *</Label>
                {errMsg('inspection_stage')}
                <InspectionStageSelect
                  groups={inspectionTypeGroups}
                  selected={form.inspection_stage}
                  onChange={(selected) => setForm(prev => ({
                    ...prev,
                    inspection_stage: selected,
                    inspection_type: selected.join(', '),
                  }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>15. Mode of Inspection *</Label>
                <Select value={form.inspection_mode} onValueChange={(v) => setForm({ ...form, inspection_mode: v })}>
                  <SelectTrigger className={errClass('inspection_mode')}><SelectValue placeholder="Select mode..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="vc">VC</SelectItem>
                    <SelectItem value="hybrid">Through Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                {errMsg('inspection_mode')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>16. Venue *</Label>
                <div
                  className={cn(
                    'flex rounded-md border border-input bg-background overflow-hidden',
                    errClass('venue'),
                  )}
                >
                  <Select
                    value={form.venue_category}
                    onValueChange={(v) => {
                      setForm((prev) => {
                        const submissionDate = parsePart1RequestSubmissionDate(prev.request_date);
                        const suggested = getPart1InspectionFromMinDateTime(
                          prev.request_date,
                          v,
                          submissionDate,
                        );
                        const next = {
                          ...prev,
                          venue_category: v,
                          ...(suggested ? { inspection_date_from: suggested } : {}),
                          ...(suggested && prev.inspection_date_to && prev.inspection_date_to < suggested
                            ? { inspection_date_to: '' }
                            : {}),
                        };
                        if (suggested) {
                          queueMicrotask(() => applyAdvanceNoticeFieldError(v, suggested));
                        }
                        return next;
                      });
                    }}
                  >
                    <SelectTrigger className="w-[11.5rem] shrink-0 rounded-none border-0 border-r shadow-none focus:ring-0">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PART1_VENUE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1 rounded-none border-0 shadow-none focus-visible:ring-0"
                    value={form.venue_detail}
                    onChange={(e) => setForm({ ...form, venue_detail: e.target.value })}
                    placeholder="Specify location (e.g. building, lab, city)"
                  />
                </div>
                {errMsg('venue')}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>17. Inspection date &amp; time *</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">From (date &amp; time)</Label>
                  <DateTimeLocalInput
                    className={cn('h-9', errClass('inspection_date_from'))}
                    value={form.inspection_date_from}
                    pickerAriaLabel="From — open date and time"
                    onChange={(v) => {
                      const updates: Record<string, string> = { inspection_date_from: v };
                      if (form.inspection_date_to && v && form.inspection_date_to < v) {
                        updates.inspection_date_to = '';
                      }
                      setForm({ ...form, ...updates });
                      applyAdvanceNoticeFieldError(form.venue_category, v);
                    }}
                  />
                  {errMsg('inspection_date_from')}
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">To (date &amp; time)</Label>
                  <DateTimeLocalInput
                    className={cn('h-9', errClass('inspection_date_to'))}
                    value={form.inspection_date_to}
                    pickerAriaLabel="To — open date and time"
                    onChange={(v) => {
                      setForm({ ...form, inspection_date_to: v });
                      if (fieldErrors.inspection_date_to) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.inspection_date_to;
                          return next;
                        });
                      }
                    }}
                  />
                  {errMsg('inspection_date_to')}
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Duration</Label>
                  <div className="h-10 px-3 flex items-center rounded-md border bg-muted/50 text-sm font-medium">
                    {form.inspection_date_from && form.inspection_date_to
                      ? (() => {
                          const t0 = parseYmdLocal(form.inspection_date_from.slice(0, 10));
                          const t1 = parseYmdLocal(form.inspection_date_to.slice(0, 10));
                          const diff =
                            t0 && t1
                              ? Math.ceil((t1.getTime() - t0.getTime()) / (1000 * 60 * 60 * 24))
                              : 0;
                          return diff >= 0 ? `${diff + 1} day${diff + 1 !== 1 ? 's' : ''}` : '—';
                        })()
                      : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description / Additional Notes</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Any additional details about the inspection request" rows={3} />
            </div>
          </CardContent>
        </Card>

        {/* Section: Document Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Details</CardTitle>
            <CardDescription>18. The available Document Details</CardDescription>
          </CardHeader>
          <CardContent>
            {errMsg('document_details')}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Type</th>
                    <th className="text-left py-2 px-2 font-medium">Approval Status</th>
                    <th className="text-left py-2 px-2 font-medium">Controlled Doc No.</th>
                    <th className="text-left py-2 px-2 font-medium">Amd No.</th>
                    <th className="text-left py-2 px-2 font-medium">Rev. No</th>
                    <th className="text-left py-2 pl-2 font-medium min-w-[9rem]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {DOC_TYPES.map(doc => (
                    <tr key={doc.key} className={`border-b last:border-0 ${doc.key === 'ts' ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
                      <td className="py-2 pr-4 font-medium whitespace-nowrap">{doc.label}{doc.key === 'ts' ? ' *' : ''}</td>
                      <td className="py-2 px-2">
                        <Select value={form.document_details[doc.key]?.approved || ''} onValueChange={(v) => handleDocApprovedChange(doc.key, v)}>
                          <SelectTrigger className={cn('w-[100px] h-8', docRowErrClass(doc.key))}><SelectValue placeholder="--" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            {doc.key !== 'ts' && <SelectItem value="no">No</SelectItem>}
                            <SelectItem value="na">NA</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2 px-2">
                        <Input className={cn('h-8', docRowErrClass(doc.key))} value={form.document_details[doc.key]?.doc_no || ''} onChange={(e) => updateDocDetail(doc.key, 'doc_no', e.target.value)} />
                      </td>
                      <td className="py-2 px-2">
                        <Input className={cn('h-8 w-16', docRowErrClass(doc.key))} type="number" min={0} max={5} value={form.document_details[doc.key]?.amd_no || ''} onChange={(e) => updateDocDetail(doc.key, 'amd_no', e.target.value)} placeholder="0-5" />
                      </td>
                      <td className="py-2 px-2">
                        <Input className={cn('h-8 w-16', docRowErrClass(doc.key))} type="number" min={0} max={5} value={form.document_details[doc.key]?.rev_no || ''} onChange={(e) => updateDocDetail(doc.key, 'rev_no', e.target.value)} placeholder="0-5" />
                      </td>
                      <td className="py-2 pl-2 min-w-[9rem]">
                        <CalendarDateInput
                          className={cn('h-8 w-full', docRowErrClass(doc.key))}
                          inputClassName={docRowErrClass(doc.key)}
                          value={form.document_details[doc.key]?.date || ''}
                          onChange={(v) => updateDocDetail(doc.key, 'date', v)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Section: Confirmations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Confirmations</CardTitle>
            <CardDescription>19: Please confirm the following details *</CardDescription>
          </CardHeader>
          <CardContent>
            {errMsg('confirmations')}
            <div className="space-y-4">
              {[
                { key: 'approved_docs_available', label: 'a) Approved copies of documents are available with Industry Partner before start of QA coverage for LRU.' },
                { key: 'logbook_updated', label: 'b) R&QA controlled Log book with template are updated.' },
                { key: 'previous_observations_status', label: 'c) Status of the previous observations/NCs.' },
                { key: 'cocs_available', label: 'd) CoCs, Certificates, Test Reports, Datasheets, verified Industry partner QC Reports etc. are available for offered stage.' },
                { key: 'instruments_available', label: 'e) Applicable measuring instruments/Testing facilities are available with valid calibration certificates.' },
                { key: 'joint_inspection_request', label: 'f) Request for Joint Inspection with ORDAQA as per approved QAP.' },
              ].map(item => (
                <div key={item.key} className="flex items-start gap-4">
                  <div className="flex-1">
                    <span className="text-sm">{item.label}</span>
                  </div>
                  {item.key === 'previous_observations_status' ? (
                    <Select
                      value={(form.confirmations as any)[item.key] || undefined}
                      onValueChange={(v) => updateConfirmation(item.key, v)}
                    >
                      <SelectTrigger className="w-[120px]"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="na">N/A</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <YesNoSelect
                      value={(form.confirmations as any)[item.key] || ''}
                      onChange={(v) => updateConfirmation(item.key, v)}
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Section: Designer Rep & Certification */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Designer Representative & Certification</CardTitle>
            <CardDescription>20-21: Nominated designer rep details and DH/GD/TH certification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>20. Designer Rep Name</Label>
                <Input value={form.designer_rep_name} readOnly disabled className="bg-muted text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Auto-filled from logged-in user</p>
              </div>
              <div className="grid gap-2">
                <Label>Designation</Label>
                <Input value={form.designer_rep_designation} readOnly disabled className="bg-muted text-muted-foreground" />
              </div>
              <div className="grid gap-2">
                <Label>Contact Number</Label>
                <Input value={form.designer_rep_contact} readOnly disabled className="bg-muted text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Fetched from user profile</p>
              </div>
            </div>
            {userSignature && (
              <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
                <span className="text-sm font-medium text-muted-foreground">Signature:</span>
                <img src={userSignature} alt="Signature" className="h-12 max-w-[200px] object-contain" />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Design Coordinator Name</Label>
              <Input value={form.design_coordinator_name} onChange={(e) => setForm({ ...form, design_coordinator_name: e.target.value })} />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>21. Designer DH/GD/TH Name (Certifier) *</Label>
                <CertifierSearchSelect
                  approvers={requestApprovers}
                  value={form.nominated_request_approver_id || ''}
                  onChange={handleCertifierChange}
                  errorClassName={errClass('nominated_request_approver_id')}
                  placeholder="Search or select request approver..."
                />
                {errMsg('nominated_request_approver_id')}
              </div>
              <div className="grid gap-2">
                <Label>Designation *</Label>
                <Select
                  value={form.certified_by_designation || undefined}
                  onValueChange={(v) => setForm({ ...form, certified_by_designation: v })}
                >
                  <SelectTrigger className={errClass('certified_by_designation')}>
                    <SelectValue placeholder="Select rank (e.g. Sc B, TO-A)…" />
                  </SelectTrigger>
                  <SelectContent>
                    {certifierGradeSelectOptions(form.certified_by_designation).map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errMsg('certified_by_designation')}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              It is certified that the above LRU/SRU/Assembly/Part/material is ready for Inspection / Testing.
            </p>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 pb-8">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            <Save className="h-4 w-4" />
            {isSubmitting
              ? 'Saving...'
              : loadedIrStatus === 'draft' || !editId
                ? 'Submit Inspection Request'
                : 'Save changes'}
          </Button>
        </div>
      </form>

      <Dialog open={draftNoticeOpen} onOpenChange={setDraftNoticeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draftNoticeDocLabel} document is draft</DialogTitle>
            <DialogDescription>
              Since the {draftNoticeDocLabel} doc is draft, the inspection is tentative only.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setDraftNoticeOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NewInspectionRequestPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading form…</div>}>
      <NewInspectionRequestForm />
    </Suspense>
  );
}
