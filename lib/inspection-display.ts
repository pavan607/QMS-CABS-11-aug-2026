/** Normalise item_pertains_to JSON/array values for display (PDF, detail screens). */

import { parseInspectorIds } from '@/lib/inspector-ids';
import { parsePart1Bool } from '@/lib/part1-so-fields';

const ITEM_PERTAINS_LABELS: Record<string, string> = {
  airborne: 'Airborne Unit',
  ground: 'Ground Unit',
  prototype: 'Prototype',
};

function parseStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter((x) => x != null && String(x).trim() !== '').map(String);
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) return p.filter((x: unknown) => x != null && String(x).trim() !== '').map(String);
    } catch {
      /* plain string */
    }
    return val.trim() ? [val] : [];
  }
  return [];
}

/** Single token: known keys → label; else Title Case per word (snake_case → spaces). */
export function formatItemPertainsToToken(v: string): string {
  const raw = String(v).trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (ITEM_PERTAINS_LABELS[key]) return ITEM_PERTAINS_LABELS[key];
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/** Comma-separated display for tables/PDF; empty → em dash. */
export function formatItemPertainsToDisplay(val: unknown, empty = '—'): string {
  const list = parseStringArray(val).map(formatItemPertainsToToken).filter(Boolean);
  return list.length ? list.join(', ') : empty;
}

const TEST_TYPE_LABELS: Record<string, string> = {
  lab_testing: 'LAB/LRU TESTING',
  qt: 'FULL QT',
  lqt_iqt: 'LQT/IQT',
  other: 'OTHER',
};

/** Test type tokens: snake_case → spaces, full string uppercased (e.g. system_level_test → SYSTEM LEVEL TEST). */
export function formatTestTypeToken(v: string): string {
  const raw = String(v).trim();
  if (!raw) return '';
  const key = raw.toLowerCase();
  if (TEST_TYPE_LABELS[key]) return TEST_TYPE_LABELS[key];
  return raw
    .split(/[_\s]+/)
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
}

/** Comma-separated test types for PDF/tables. */
export function formatTestTypeDisplay(val: unknown, empty = '—'): string {
  const list = parseStringArray(val).map(formatTestTypeToken).filter(Boolean);
  return list.length ? list.join(', ') : empty;
}

/** Part I field 17 — venue options on the CABS inspection form. */
export const PART1_VENUE_OPTIONS = [
  'Within CABS',
  'Within Bangalore',
  'Outstation',
] as const;

export type Part1VenueOption = (typeof PART1_VENUE_OPTIONS)[number];

const PART1_VENUE_SEPARATOR = ' — ';

/** Combine Part I venue category + detail for storage (field 17). */
export function formatPart1Venue(category: string, detail: string): string {
  const cat = String(category || '').trim();
  const det = String(detail || '').trim();
  if (!cat && !det) return '';
  if (!cat) return det;
  if (!det) return cat;
  return `${cat}${PART1_VENUE_SEPARATOR}${det}`;
}

/** Split stored Part I venue into category and detail. */
export function parsePart1Venue(stored: string): { category: string; detail: string } {
  const raw = String(stored || '').trim();
  if (!raw) return { category: '', detail: '' };

  const rawLower = raw.toLowerCase();
  for (const option of PART1_VENUE_OPTIONS) {
    const optionLower = option.toLowerCase();
    if (rawLower === optionLower) return { category: option, detail: '' };
    const prefix = `${option}${PART1_VENUE_SEPARATOR}`;
    if (raw.startsWith(prefix)) {
      return { category: option, detail: raw.slice(prefix.length).trim() };
    }
    const prefixLower = `${optionLower}${PART1_VENUE_SEPARATOR.toLowerCase()}`;
    if (rawLower.startsWith(prefixLower)) {
      return { category: option, detail: raw.slice(prefix.length).trim() };
    }
    const altPrefix = `${option} - `;
    if (raw.startsWith(altPrefix)) {
      return { category: option, detail: raw.slice(altPrefix.length).trim() };
    }
    const altPrefixLower = `${optionLower} - `;
    if (rawLower.startsWith(altPrefixLower)) {
      return { category: option, detail: raw.slice(altPrefix.length).trim() };
    }
  }

  return { category: '', detail: raw };
}

/** Part I venue category, preferring `venue` over `location`. */
export function part1VenueCategory(venue: unknown, locationFallback?: unknown): Part1VenueOption | '' {
  const fromVenue = parsePart1Venue(String(venue ?? '').trim()).category;
  if (fromVenue === 'Within CABS' || fromVenue === 'Within Bangalore' || fromVenue === 'Outstation') {
    return fromVenue;
  }
  const fromLocation = parsePart1Venue(String(locationFallback ?? '').trim()).category;
  if (fromLocation === 'Within CABS' || fromLocation === 'Within Bangalore' || fromLocation === 'Outstation') {
    return fromLocation;
  }
  return '';
}

/** True only when Part I venue category is Outstation — not Within CABS / Within Bangalore. */
export function part1VenueIsOutstation(venue: unknown, locationFallback?: unknown): boolean {
  return part1VenueCategory(venue, locationFallback) === 'Outstation';
}

/**
 * Part II Outstation Inspection follows Part I venue automatically:
 * - Outstation → enabled
 * - Within CABS / Within Bangalore → disabled
 * - Unknown/legacy venue → fall back to stored part2_data flag
 */
export function resolveOutstationInspectionFromVenue(
  venue: unknown,
  locationFallback?: unknown,
  part2Fallback?: boolean
): boolean {
  const cat = part1VenueCategory(venue, locationFallback);
  if (cat === 'Outstation') return true;
  if (cat === 'Within CABS' || cat === 'Within Bangalore') return false;
  return !!part2Fallback;
}

/** Part I field 5 — Source options. */
export const SOURCE_OPTIONS = [
  { value: 'indigenous', label: 'Indigenous' },
  { value: 'imported', label: 'Imported' },
  { value: 'cots_item', label: 'COTS item' },
] as const;

export type SourceOptionValue = (typeof SOURCE_OPTIONS)[number]['value'];

/** Normalize stored Source value for forms / comparisons. */
export function normalizeSourceValue(source: unknown): string {
  const raw = source == null ? '' : String(source).trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (key === 'cots' || key === 'cots_item') return 'cots_item';
  const found = SOURCE_OPTIONS.find((o) => o.value === key);
  return found ? found.value : raw;
}

/** Display label for Source (keeps COTS casing). */
export function formatSourceLabel(source: unknown, empty = '—'): string {
  const normalized = normalizeSourceValue(source);
  if (!normalized) return empty;
  const found = SOURCE_OPTIONS.find((o) => o.value === normalized);
  if (found) return found.label;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/** Whether an inspection-type group applies to the selected Part I Source.
 *  COTS categories are identified by name (e.g. "COTS", "COTS Inspection").
 *  - COTS item: every category, including COTS.
 *  - Indigenous / Imported: every category except COTS-only ones.
 */
export function inspectionTypeGroupAppliesToSource(
  group: { name?: string | null },
  source: string,
): boolean {
  const key = normalizeSourceValue(source);
  const nameLooksCots = /^cots\b/i.test(String(group.name || '').trim());

  if (key === 'cots_item') return true;
  return !nameLooksCots;
}

export function filterInspectionTypeGroupsBySource<
  T extends { name?: string | null; items?: unknown[] },
>(groups: T[], source: string): T[] {
  return (groups || []).filter((g) => inspectionTypeGroupAppliesToSource(g, source));
}

/** Flat set of stage item names from groups (for pruning invalid selections). */
export function collectInspectionStageNamesFromGroups(
  groups: Array<{ items?: Array<{ name?: string | null }> | null }> | null | undefined
): Set<string> {
  const names = new Set<string>();
  for (const g of groups || []) {
    for (const item of g.items || []) {
      const n = String(item?.name || '').trim();
      if (n) names.add(n);
    }
  }
  return names;
}

/** DB label for inspection stage / previous stage "Others" option (sections 12 & 14). */
export const OTHERS_INSPECTION_STAGE_EXTENDED_LABEL =
  'Others (Please specify If the test is not available in the list, please contact the Admin 9507/9437)';

export function isOthersInspectionStageItem(name: string): boolean {
  return /^others\s*\(\s*please\s*specify/i.test(String(name).trim());
}

/** UI label for inspection type items; keeps stored value unchanged when saving. */
export function formatInspectionStageItemLabel(name: string): string {
  return isOthersInspectionStageItem(name) ? OTHERS_INSPECTION_STAGE_EXTENDED_LABEL : name;
}

/** Comma-separated inspection / previous stage values for display. */
export function formatInspectionStageListDisplay(val: unknown, empty = '—'): string {
  const raw = val == null ? '' : String(val).trim();
  if (!raw) return empty;
  return raw
    .split(',')
    .map((s) => formatInspectionStageItemLabel(s.trim()))
    .filter(Boolean)
    .join(', ');
}

/** Parse field 12 — stored as "no", "na", empty, or comma-separated inspection type names. */
export function parsePreviousStageCleared(value: unknown): {
  answer: '' | 'yes' | 'no' | 'na';
  stages: string[];
} {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return { answer: '', stages: [] };
  const lower = raw.toLowerCase();
  if (lower === 'no') return { answer: 'no', stages: [] };
  if (lower === 'na') return { answer: 'na', stages: [] };
  return {
    answer: 'yes',
    stages: raw.split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export const PART1_DOC_TYPE_KEYS = [
  'ts',
  'qap',
  'sop_mdi',
  'qtp_lqtp_softp',
  'ftp_atp',
  'pc_ta_other',
] as const;

export type Part1DocTypeKey = (typeof PART1_DOC_TYPE_KEYS)[number];

export type Part1DocRow = {
  approved?: string;
  doc_no?: string;
  amd_no?: string;
  rev_no?: string;
  date?: string;
  /** Required when approval status is Draft. */
  comment?: string;
};

/** Part I §18 — Doc No. / Amd / Rev / Date are not used when approval is NA or No. */
export function part1DocDetailFieldsDisabled(approved: unknown): boolean {
  const a = String(approved ?? '').trim().toLowerCase();
  return a === 'na' || a === 'no';
}

/** Printed-copy note when any §18 document is Draft. */
export const PART1_DRAFT_DOC_TENTATIVE_NOTE =
  'Since the Doc (as applicable) doc is draft, the inspection is tentative only';

export function part1DocumentDetailsHasDraft(
  documentDetails: Record<string, Part1DocRow> | null | undefined
): boolean {
  if (!documentDetails || typeof documentDetails !== 'object') return false;
  return Object.values(documentDetails).some(
    (row) => String(row?.approved ?? '').trim().toLowerCase() === 'draft'
  );
}

/**
 * Part I §18 forward rules (beyond per-row completeness):
 * - At least one document must be Draft or Yes (cannot forward if all are NA/No).
 */
export function validatePart1DocumentDetailsForward(
  documentDetails: Record<string, Part1DocRow> | null | undefined,
): string | null {
  const docs = documentDetails && typeof documentDetails === 'object' ? documentDetails : {};

  const hasYesOrDraft = PART1_DOC_TYPE_KEYS.some((key) => {
    const a = docs[key]?.approved;
    return a === 'yes' || a === 'draft';
  });
  if (!hasYesOrDraft) {
    return '18. At least one document must be Draft or Yes. The request cannot be forwarded when all approval statuses are NA or No';
  }

  return null;
}

export type AssignedInspectorRow = {
  id?: number;
  name: string;
  employee_id?: string | null;
  designation?: string | null;
};

/** Rows for Part II / Part IV UI — uses API list, then `inspector_names`, then legacy single inspector. */
export function resolveAssignedInspectorsForDisplay(
  inspection: {
    assigned_inspectors?: Array<{
      id?: number;
      name?: string | null;
      employee_id?: string | null;
      designation?: string | null;
    }> | null;
    inspector_ids?: unknown;
    inspector_id?: number | null;
    inspector_name?: string | null;
    inspector_names?: string | null;
    inspector_employee_id?: string | null;
    inspector_designation?: string | null;
  }
): AssignedInspectorRow[] {
  const fromApi = (inspection.assigned_inspectors || [])
    .map((i) => ({
      id: i.id,
      name: i.name?.trim() || '',
      employee_id: i.employee_id,
      designation: i.designation,
    }))
    .filter((i) => i.name);
  if (fromApi.length > 0) return fromApi;

  const ids = parseInspectorIds(inspection.inspector_ids);
  const namesFromAgg =
    inspection.inspector_names
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (namesFromAgg.length > 0) {
    return namesFromAgg.map((name, idx) => ({
      id: ids[idx],
      name,
    }));
  }

  const single = inspection.inspector_name?.trim();
  if (single) {
    return [
      {
        id: inspection.inspector_id ?? undefined,
        name: single,
        employee_id: inspection.inspector_employee_id,
        designation: inspection.inspector_designation,
      },
    ];
  }
  return [];
}

/** Comma-separated names for all Part II assigned inspectors (summary cards, lists). */
export function formatAssignedInspectorsDisplay(
  inspection: {
    assigned_inspectors?: Array<{ name?: string | null }> | null;
    inspector_name?: string | null;
    inspector_names?: string | null;
  },
  empty = 'Unassigned'
): string {
  const rows = resolveAssignedInspectorsForDisplay(inspection);
  if (rows.length > 0) return rows.map((r) => r.name).join(', ');
  return empty;
}

export function formatTestTypeDisplayWithOther(
  val: unknown,
  other: unknown,
  empty = '—'
): string {
  const main = formatTestTypeDisplay(val, '');
  const t = other != null && String(other).trim() ? String(other).trim() : '';
  if (t) {
    if (main) return `${main} — OTHER: ${t}`;
    return `OTHER: ${t}`;
  }
  return main || empty;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Today's calendar day in the runtime's local timezone — use instead of `toISOString().slice(0,10)` (which is UTC). */
export function getLocalYmdToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

/** Current local date and time as `YYYY-MM-DDTHH:mm` for datetime-local form fields. */
export function getLocalDateTimeNow(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}T${pad2(n.getHours())}:${pad2(n.getMinutes())}`;
}

/** Default new-IR creation datetime on the client — avoids SSR UTC drift and stale date-only drafts. */
export function normalizePart1RequestCreationDateTime(stored: unknown): string {
  const now = getLocalDateTimeNow();
  const today = getLocalYmdToday();
  const raw = stored == null ? '' : String(stored).trim();
  if (!raw) return now;

  const day = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  if (!day || day < today) return now;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) {
    const dt = parseDateTimeLocal(raw);
    return dt ? toDateTimeLocalString(dt) : now;
  }

  return `${day}T${now.slice(11)}`;
}

/** Minimum advance notice (hours) from IR submission to inspection start, by venue type. */
export const PART1_VENUE_ADVANCE_NOTICE_HOURS: Record<Part1VenueOption, number> = {
  'Within CABS': 4,
  'Within Bangalore': 24,
  Outstation: 48,
};

/** Within CABS — advance notice counts only during office hours (local time). */
const WITHIN_CABS_BUSINESS_START_HOUR = 8;
const WITHIN_CABS_BUSINESS_START_MINUTE = 30;
const WITHIN_CABS_BUSINESS_END_HOUR = 17;

function getWithinCabsBusinessDayStart(day: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    WITHIN_CABS_BUSINESS_START_HOUR,
    WITHIN_CABS_BUSINESS_START_MINUTE,
    0,
    0,
  );
}

function getWithinCabsBusinessDayEnd(day: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    WITHIN_CABS_BUSINESS_END_HOUR,
    0,
    0,
    0,
  );
}

/** Add working hours for Within CABS (8:30 AM–5:00 PM), skipping time outside that window. */
export function addWithinCabsWorkingHours(from: Date, hours: number): Date {
  let remainingMs = hours * 60 * 60 * 1000;
  let current = new Date(from);

  for (let guard = 0; guard < 366 && remainingMs > 0; guard++) {
    const dayStart = getWithinCabsBusinessDayStart(current);
    const dayEnd = getWithinCabsBusinessDayEnd(current);

    if (current.getTime() < dayStart.getTime()) {
      current = dayStart;
    } else if (current.getTime() >= dayEnd.getTime()) {
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);
      current = getWithinCabsBusinessDayStart(nextDay);
      continue;
    }

    const availableMs = dayEnd.getTime() - current.getTime();
    if (availableMs >= remainingMs) {
      return new Date(current.getTime() + remainingMs);
    }

    remainingMs -= availableMs;
    const nextDay = new Date(current);
    nextDay.setDate(nextDay.getDate() + 1);
    current = getWithinCabsBusinessDayStart(nextDay);
  }

  return current;
}

function formatPart1VenueAdvanceNoticePeriod(category: string, requiredHours: number): string {
  if (category === 'Within CABS') {
    return '4 working hours (8:30 AM–5:00 PM)';
  }
  if (requiredHours === 24) return '24 hours';
  if (requiredHours === 48) return '2 days';
  return `${requiredHours} hours`;
}

export function getPart1VenueAdvanceNoticeHours(category: string): number | null {
  const cat = String(category || '').trim();
  if (cat in PART1_VENUE_ADVANCE_NOTICE_HOURS) {
    return PART1_VENUE_ADVANCE_NOTICE_HOURS[cat as Part1VenueOption];
  }
  return null;
}

export function formatPart1VenueAdvanceNoticeLabel(
  category: string,
  submissionDate: Date = new Date(),
  requestDateTime?: string,
): string | null {
  const hours = getPart1VenueAdvanceNoticeHours(category);
  if (hours == null) return null;
  const earliest = formatPart1EarliestInspectionDisplay(category, submissionDate, requestDateTime);
  const period = formatPart1VenueAdvanceNoticePeriod(category, hours);
  return `Inspection must be after ${period} from submission — earliest: ${earliest}`;
}

/** Parse `YYYY-MM-DDTHH:mm` (or date-only) as local date/time — no timezone conversion. */
export function parseDateTimeLocal(val: unknown): Date | null {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const h = m[4] != null ? Number(m[4]) : 0;
  const mi = m[5] != null ? Number(m[5]) : 0;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, mi, 0, 0);
}

/** Format a local `Date` as `YYYY-MM-DDTHH:mm` for datetime-local fields. */
export function toDateTimeLocalString(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** DB / ISO value → `YYYY-MM-DDTHH:mm` for datetime-local form fields (local wall time, no UTC shift). */
export function toDateTimeLocalValue(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) {
    return toDateTimeLocalString(v);
  }
  const s = String(v).trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return s;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;

  const pgTs = s.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/);
  if (pgTs) return `${pgTs[1]}T${pgTs[2]}:${pgTs[3]}`;

  const hasTimezone = /Z$/i.test(s) || /[+-]\d{2}(?::?\d{2})?$/.test(s);
  if (!hasTimezone) {
    const wall = s.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/);
    if (wall) return `${wall[1]}T${wall[2]}:${wall[3]}`;
  }

  const midnightUtc = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z$/i);
  if (midnightUtc) return `${midnightUtc[1]}T00:00`;

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return toDateTimeLocalString(d);
  }

  return '';
}

const INSPECTION_DATETIME_API_FIELDS = [
  'inspection_datetime',
  'inspection_date_from',
  'inspection_date_to',
] as const;

/** Serialize inspection timestamp columns as local `YYYY-MM-DDTHH:mm` strings in API JSON. */
export function normalizeInspectionDateTimeFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const key of INSPECTION_DATETIME_API_FIELDS) {
    if (key in out && out[key] != null && out[key] !== '') {
      (out as Record<string, unknown>)[key] = toDateTimeLocalValue(out[key]);
    }
  }
  return out;
}

/** Earliest allowed inspection start for a venue type, from the submission moment. */
export function getMinimumPart1InspectionDateTime(
  venueCategory: string,
  submissionDate: Date = new Date(),
): Date {
  const hours = getPart1VenueAdvanceNoticeHours(venueCategory) ?? 0;
  if (venueCategory === 'Within CABS') {
    return addWithinCabsWorkingHours(submissionDate, hours);
  }
  return new Date(submissionDate.getTime() + hours * 60 * 60 * 1000);
}

/** Display earliest allowed inspection start for a venue type (dd-mm-yyyy HH:mm). */
export function formatPart1EarliestInspectionDisplay(
  venueCategory: string,
  submissionDate: Date = new Date(),
  requestDateTime?: string,
): string {
  const minAt = getPart1InspectionFromMinDateTime(
    requestDateTime ?? toDateTimeLocalString(submissionDate),
    venueCategory,
    submissionDate,
  );
  return formatReceivedDateTimeDisplay(minAt, '—');
}

export type Part1AdvanceNoticeValidation = {
  valid: boolean;
  requiredHours: number | null;
  message?: string;
};

/** Validate inspection start meets venue-based minimum advance notice from submission time. */
export function validatePart1InspectionAdvanceNotice(
  venueCategory: string,
  inspectionDateFrom: string,
  submissionDate: Date = new Date(),
  requestDateTime?: string,
): Part1AdvanceNoticeValidation {
  const requiredHours = getPart1VenueAdvanceNoticeHours(venueCategory);
  if (requiredHours == null) {
    return { valid: true, requiredHours: null };
  }

  const inspectionAt = parseDateTimeLocal(inspectionDateFrom);
  if (!inspectionAt) {
    return { valid: false, requiredHours, message: '17. From (date & time) is invalid' };
  }

  const minAtStr = getPart1InspectionFromMinDateTime(
    requestDateTime ?? toDateTimeLocalString(submissionDate),
    venueCategory,
    submissionDate,
  );
  const minAt = parseDateTimeLocal(minAtStr);
  if (!minAt || inspectionAt.getTime() < minAt.getTime()) {
    const noticeText = formatPart1VenueAdvanceNoticePeriod(venueCategory, requiredHours);
    const earliest = formatReceivedDateTimeDisplay(minAtStr, '—');
    return {
      valid: false,
      requiredHours,
      message: `17. Inspection must be on or after ${earliest} (${noticeText} after submission for ${venueCategory})`,
    };
  }

  return { valid: true, requiredHours };
}

/** Parse IR request creation date/time from form or API (date-only or `YYYY-MM-DDTHH:mm`). */
export function parsePart1RequestSubmissionDate(requestDateTime: unknown): Date {
  if (requestDateTime == null || requestDateTime === '') return new Date();
  const s = String(requestDateTime).trim();
  const dt = parseDateTimeLocal(s);
  if (dt) return dt;
  const d = parseYmdLocal(s);
  if (d) return d;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** Store IR `request_date` (DATE column) from a form date/time value. */
export function toPart1RequestDateYmd(requestDateTime: unknown): string {
  const dt = parsePart1RequestSubmissionDate(requestDateTime);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** Server/client helper — returns validation error message or null. */
export function getPart1AdvanceNoticeValidationError(
  venue: string | null | undefined,
  inspectionDateFrom: string | null | undefined,
  submissionDate: Date = new Date(),
  requestDateTime?: string,
): string | null {
  if (!venue?.trim() || !inspectionDateFrom?.trim()) return null;
  const { category } = parsePart1Venue(venue);
  if (!category) return null;
  const result = validatePart1InspectionAdvanceNotice(
    category,
    inspectionDateFrom,
    submissionDate,
    requestDateTime,
  );
  return result.valid ? null : result.message ?? null;
}

/** Latest of request creation datetime and venue-based minimum inspection datetime. */
export function getPart1InspectionFromMinDateTime(
  requestDateTime: string,
  venueCategory: string,
  submissionDate?: Date,
): string {
  const anchor =
    submissionDate ?? parseDateTimeLocal(requestDateTime) ?? parseYmdLocal(requestDateTime) ?? new Date();
  const candidates: Date[] = [anchor];
  if (venueCategory.trim()) {
    candidates.push(getMinimumPart1InspectionDateTime(venueCategory, anchor));
  }
  return toDateTimeLocalString(new Date(Math.max(...candidates.map((d) => d.getTime()))));
}

/**
 * Normalise a DB/API value to `YYYY-MM-DD` for `<input type="date" />` and form state.
 * Do not use `String(dateObj).slice(0, 10)` — it is not ISO. Prefer this over blind ISO `slice(0, 10)` for midnight-UTC values.
 */
export function toDateOnlyYmd(val: unknown): string {
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    const h = val.getUTCHours();
    const m = val.getUTCMinutes();
    const s = val.getUTCSeconds();
    const ms = val.getUTCMilliseconds();
    if (h + m + s + ms === 0) {
      return `${val.getUTCFullYear()}-${pad2(val.getUTCMonth() + 1)}-${pad2(val.getUTCDate())}`;
    }
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
  }
  const str = String(val).trim();
  if (!str) return '';
  const head = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!head) {
    const d = new Date(str);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  const y = head[1];
  const mo = head[2];
  const dday = head[3];
  const rest = str.slice(10);
  if (rest === '' || /^T00:00:00(?:\.0+)?Z$/i.test(rest)) {
    return `${y}-${mo}-${dday}`;
  }
  if (/^T\d{2}:\d{2}:\d{2}/.test(rest) || rest.startsWith('T')) {
    const d = new Date(str);
    if (isNaN(d.getTime())) return `${y}-${mo}-${dday}`;
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return `${y}-${mo}-${dday}`;
}

/**
 * Display a DB calendar date (DATE column, `YYYY-MM-DD`, or `YYYY-MM-DDT00:00:00.000Z`) as dd-mm-yyyy
 * using the stored calendar day — avoids showing one day early in timezones behind UTC when the API sends midnight UTC.
 */
export function formatCalendarDateDisplay(val: unknown, empty = '—'): string {
  if (val == null || val === '') return empty;

  if (val instanceof Date) {
    const utcH = val.getUTCHours();
    const utcM = val.getUTCMinutes();
    const utcS = val.getUTCSeconds();
    const utcMs = val.getUTCMilliseconds();
    if (utcH === 0 && utcM === 0 && utcS === 0 && utcMs === 0) {
      return `${pad2(val.getUTCDate())}-${pad2(val.getUTCMonth() + 1)}-${val.getUTCFullYear()}`;
    }
    return `${pad2(val.getDate())}-${pad2(val.getMonth() + 1)}-${val.getFullYear()}`;
  }

  const s = String(val).trim();
  if (!s) return empty;

  const head = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!head) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return empty;
    return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
  }
  const [, y, mo, d] = head;
  const rest = s.slice(10);
  if (rest === '' || /^T00:00:00(?:\.0+)?Z$/i.test(rest)) {
    return `${d}-${mo}-${y}`;
  }
  const dt = new Date(s);
  if (isNaN(dt.getTime())) return `${d}-${mo}-${y}`;
  return `${pad2(dt.getDate())}-${pad2(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}

/** Parse leading `YYYY-MM-DD` as local calendar date (for date math without UTC shift). */
export function parseYmdLocal(val: unknown): Date | null {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  return new Date(y, mo - 1, day);
}

/**
 * Part III received value: `YYYY-MM-DD` / `datetime-local` → `dd-mm-yyyy` or `dd-mm-yyyy HH:mm`.
 * Uses stored calendar components (no timezone shift). Other parseable ISO strings fall back to `Date` in local time.
 */
/** Format hour/minute in 12-hour clock with AM/PM (e.g. 03:27 PM). */
export function formatTime12h(h24: number, minute: number | string): string {
  const mi = String(minute).padStart(2, '0');
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, '0')}:${mi} ${ampm}`;
}

/**
 * Display date+time for UI / PDF / reports — always 12-hour with AM/PM.
 * Accepts ISO, local `YYYY-MM-DDTHH:mm`, Date, etc.
 * Example: `12-08-2026 03:27 PM`
 */
export function formatDateTimeDisplay(val: unknown, empty = '—'): string {
  if (val == null || val === '') return empty;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return empty;
    return `${pad2(val.getDate())}-${pad2(val.getMonth() + 1)}-${val.getFullYear()} ${formatTime12h(val.getHours(), val.getMinutes())}`;
  }

  const s = String(val).trim();
  if (!s) return empty;

  const localLike = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (localLike) {
    const [, y, mo, d, h, mi] = localLike;
    const datePart = `${d}-${mo}-${y}`;
    if (h != null && mi != null) {
      // Midnight UTC date-only payloads — show date without time
      if (/^T00:00:00(?:\.0+)?Z$/i.test(s.slice(10))) return datePart;
      return `${datePart} ${formatTime12h(parseInt(h, 10), mi)}`;
    }
    return datePart;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return `${pad2(parsed.getDate())}-${pad2(parsed.getMonth() + 1)}-${parsed.getFullYear()} ${formatTime12h(parsed.getHours(), parsed.getMinutes())}`;
  }

  return s.replace('T', ' ');
}

/** Alias — same 12-hour date+time display. */
export function formatReceivedDateTimeDisplay(val: unknown, empty = '—'): string {
  return formatDateTimeDisplay(val, empty);
}

/**
 * Activity timeline type labels.
 * Request Approver is the Part I approver; employee 1021 only forwards to QA Head.
 */
export function formatInspectionActivityType(activityType: unknown): string {
  const type = String(activityType || '').trim();
  if (type === 'request_forwarded') return 'request approved';
  if (type === 'part1_approved') return 'request forwarded';
  return type.replace(/_/g, ' ') || '—';
}

/** Activity timeline description — maps stored wording to Request Approver vs 1021 roles. */
export function formatInspectionActivityDescription(
  activityType: unknown,
  description: unknown
): string {
  const type = String(activityType || '').trim();
  const desc = String(description || '').trim();

  if (desc.startsWith('Request forwarded by Request Approver for Part I approval')) {
    return desc.replace(
      /^Request forwarded by Request Approver for Part I approval/,
      'Request Approved by Request Approver for Part I approval'
    );
  }
  if (type === 'request_forwarded' && !desc) {
    return 'Request Approved by Request Approver for Part I approval';
  }

  const forwardedByGd4 = desc.match(
    /^(?:Part I approved by employee \S+|Request forwarded to QA Head by employee \S+)(?::\s*(.*))?$/s
  );
  if (forwardedByGd4 || (type === 'part1_approved' && /by employee \d+/i.test(desc))) {
    const comment = (forwardedByGd4?.[1] || '').trim();
    if (comment) return `Request forwarded to QA Head by GD-4: ${comment}`;
    if (/^Part I approved by employee/i.test(desc) || /^Request forwarded to QA Head by employee/i.test(desc)) {
      return desc
        .replace(/^Part I approved by employee \S+/i, 'Request forwarded to QA Head by GD-4')
        .replace(/^Request forwarded to QA Head by employee \S+/i, 'Request forwarded to QA Head by GD-4');
    }
    return 'Request forwarded to QA Head by GD-4';
  }

  return desc || '—';
}

/**
 * Part III / Part V reports: "(In case of delegation to R&QA) ORDAQA Rep".
 * When ORDAQA Head chose Delegated, print the fixed label (not the person name).
 * Prefer explicit `dgaqa_rep` from Sections 24–25 only when not a delegation case.
 */
export function ordaqaRepReportDisplay(
  part3: Record<string, any> | null | undefined,
  _inspectionOrdaqaInspectorName?: string | null
): string {
  const p = part3 || {};
  if (p.delegation_type === 'delegated') {
    return 'Delegated to R&QA Inspector';
  }
  const explicit = String(p.dgaqa_rep ?? '').trim();
  if (explicit) return explicit;
  return '';
}

/** Fixed PDF / report text when ORDAQA Head delegates to R&QA. */
export const ORDAQA_DELEGATED_TO_RQA_LABEL = 'Delegated to R&QA Inspector';

function parseJsonRecord(val: unknown): Record<string, unknown> {
  if (!val) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, unknown>;
  if (typeof val === 'string') {
    try {
      const o = JSON.parse(val);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Part I confirmations object. */
export function parseConfirmations(val: unknown): Record<string, string> {
  const raw = parseJsonRecord(val);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && String(v).trim() !== '') out[k] = String(v).trim().toLowerCase();
  }
  return out;
}

/**
 * Field 4 — DGAQA involvement (DGAQA and ORDAQA are the same).
 * When Yes, ORDAQA Parts III and V are required.
 * Legacy fallback: old Part I 19(f) joint_inspection_request = yes.
 */
export function dgaqaInvolvedInPart1(ir: {
  so_involves_dgaqa?: unknown;
  confirmations?: unknown;
}): boolean {
  if (parsePart1Bool(ir.so_involves_dgaqa)) return true;
  return parseConfirmations(ir.confirmations).joint_inspection_request === 'yes';
}

/**
 * Field 4 — R&QA involvement.
 * When Yes, Parts II and IV are required.
 * Legacy: when neither involvement flag is set, treat as R&QA involved (historical default).
 */
export function rqaInvolvedInPart1(ir: {
  so_involves_rqa?: unknown;
  so_involves_dgaqa?: unknown;
}): boolean {
  if (parsePart1Bool(ir.so_involves_rqa)) return true;
  const dgaqa = parsePart1Bool(ir.so_involves_dgaqa);
  const rqa = parsePart1Bool(ir.so_involves_rqa);
  if (!dgaqa && !rqa) return true;
  return false;
}

/** Parts II and IV are not used when R&QA involvement is No. */
export function inspectionSkipsRqaPart2AndPart4(ir: {
  so_involves_rqa?: unknown;
  so_involves_dgaqa?: unknown;
}): boolean {
  return !rqaInvolvedInPart1(ir);
}

/** @deprecated Use dgaqaInvolvedInPart1 — kept as alias for existing call sites. */
export function jointInspectionRequestedInPart1(ir: {
  so_involves_dgaqa?: unknown;
  confirmations?: unknown;
}): boolean {
  return dgaqaInvolvedInPart1(ir);
}

/**
 * Part I DGAQA/ORDAQA involvement is No (legacy 19(f) No / N/A also).
 * Parts III / V stay unused unless QA Head later forwards to ORDAQA in Part II.
 * (Function name is historical; it does not skip Part II.)
 */
export function inspectionSkipsPart2Part3(ir: {
  so_involves_dgaqa?: unknown;
  confirmations?: unknown;
}): boolean {
  if (dgaqaInvolvedInPart1(ir)) return false;
  const v = parseConfirmations(ir.confirmations).joint_inspection_request;
  if (v === 'no' || v === 'na' || v === 'n/a') return true;
  return true;
}

/**
 * Legacy 19(f)=No IRs that never received a nominated Team Head — any R&QA Inspector
 * could fill Part IV. New IRs always go through QA Head Team Head selection first.
 */
export function inspectionUsesLegacyOpenRqaPart4(ir: {
  confirmations?: unknown;
  nominated_team_head_id?: number | null;
}): boolean {
  if (!inspectionSkipsPart2Part3(ir)) return false;
  const th = ir.nominated_team_head_id;
  return th == null || String(th).trim() === '' || Number(th) <= 0;
}

/** Part IV editable on legacy open skip-path IRs only before inspection is started. */
const SKIPPED_PART2_PART4_STATUSES = ['request_approved', 'assigned'] as const;

/** R&QA Inspector may act on legacy open skip-path IRs; locks to assignee after Part IV save. */
export function isRqaInspectorEligibleForSkippedParts(
  ir: {
    inspector_id?: number | null;
    inspector_ids?: unknown;
    confirmations?: unknown;
    nominated_team_head_id?: number | null;
  },
  userId: number,
  userRole?: string
): boolean {
  if (!inspectionUsesLegacyOpenRqaPart4(ir)) return false;
  if (userRole === 'administrator') return true;
  if (userRole !== 'inspector' || !userId) return false;
  const hasAssignee =
    (ir.inspector_id != null && Number(ir.inspector_id) > 0) ||
    parseInspectorIds(ir.inspector_ids).length > 0;
  if (!hasAssignee) return true;
  return isUserAssignedPart2Inspector(ir, userId);
}

/** IR was marked for ORDAQA joint inspection in Part II (boolean may arrive as string from DB/JSON). */
export function isForwardedToOrdqa(ir: { forwarded_to_ordaqa?: unknown }): boolean {
  const v = ir.forwarded_to_ordaqa;
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 't' || s === 'yes';
  }
  return false;
}

/**
 * ORDAQA returned the memo to QA Head — QA Head must review Part II and re-forward when ready.
 * Cleared when QA Head re-forwards to ORDAQA.
 */
export function memoReturnedAwaitingQaHead(ir: {
  forwarded_to_ordaqa?: unknown;
  part3_data?: unknown;
  status?: string | null;
}): boolean {
  if (isForwardedToOrdqa(ir)) return false;
  const status = String(ir.status ?? '');
  if (
    ['completed', 'closed', 'rejected', 'draft', 'returned_to_designer', 'pending', 'pending_request_approval', 'pending_part1_approval'].includes(
      status
    )
  ) {
    return false;
  }
  const p3 = parseJsonRecord(ir.part3_data);
  return String(p3.memo_returned ?? '').trim().toLowerCase() === 'yes';
}

/**
 * Nominated Team Head – QA still needs to assign inspector(s).
 * False once inspectors exist or memo is back with QA Head.
 * Forward to ORDAQA does not skip this — R&QA inspectors are still assigned in Part II.
 */
export function teamHeadQaNeedsInspectorAssignment(ir: {
  status?: string | null;
  inspector_id?: number | null;
  inspector_ids?: unknown;
  assigned_inspectors?: Array<{ id?: number | null; name?: string | null }> | null;
  forwarded_to_ordaqa?: unknown;
  part3_data?: unknown;
}): boolean {
  if (String(ir.status ?? '') !== 'request_approved') return false;
  if (memoReturnedAwaitingQaHead(ir)) return false;
  if (ir.inspector_id != null && Number(ir.inspector_id) > 0) return false;
  if (parseInspectorIds(ir.inspector_ids).length > 0) return false;
  const fromApi = ir.assigned_inspectors || [];
  if (fromApi.some((i) => i?.id != null && Number(i.id) > 0)) return false;
  return true;
}

/**
 * When Team Head enabled Outstation Inspection, Part III waits until the assigned
 * R&QA inspector fills Email Sent / Name & Sign / Date & Time.
 */
export function part3BlockedByIncompleteOutstation(ir: { part2_data?: unknown }): boolean {
  return part2OutstationDetailsIncomplete(ir);
}

/** ORDAQA Head still needs to complete Part III / assign (including after QA Head re-forward). */
export function ordaqaHeadPart3ActionRequired(ir: {
  forwarded_to_ordaqa?: unknown;
  ordaqa_inspector_id?: number | null;
  part2_data?: unknown;
  part3_data?: unknown;
  status?: string | null;
}): boolean {
  if (!isForwardedToOrdqa(ir)) return false;
  if (!['request_approved', 'assigned', 'in_progress'].includes(String(ir.status ?? ''))) {
    return false;
  }
  if (ir.ordaqa_inspector_id != null && String(ir.ordaqa_inspector_id).trim() !== '') {
    return false;
  }
  // After Outstation is submitted (when enabled), Part III becomes the next action
  if (part3BlockedByIncompleteOutstation(ir)) return false;
  const p3 = parseJsonRecord(ir.part3_data);
  return String(p3.memo_returned ?? '').trim().toLowerCase() !== 'yes';
}

/** SQL / list helper: part3_data marks QA Head re-forward after memo return. */
export function part3MarkedReforwardedAfterMemo(part3Data: unknown): boolean {
  const p3 = parseJsonRecord(part3Data);
  const flag = String(p3.reforwarded_after_memo ?? '').trim().toLowerCase();
  return flag === 'true' || flag === 't' || flag === '1' || flag === 'yes';
}

/** IR was re-forwarded to ORDAQA by QA Head after a Part III memo return. */
export function ordaqaHeadReforwardActionRequired(ir: {
  forwarded_to_ordaqa?: unknown;
  ordaqa_inspector_id?: number | null;
  part3_data?: unknown;
  status?: string | null;
  /** When list/detail includes activities, used to detect older re-forwards without the flag. */
  has_memo_return_activity?: boolean | null;
}): boolean {
  if (!ordaqaHeadPart3ActionRequired(ir)) return false;
  if (part3MarkedReforwardedAfterMemo(ir.part3_data)) return true;
  return ir.has_memo_return_activity === true;
}

/**
 * True when ORDAQA path applies (Part III + Part V).
 * - After QA Head enables Forward to ORDAQA in Part II (`forwarded_to_ordaqa`), or
 * - DGAQA/ORDAQA-only Part I (DGAQA Yes, R&QA No): III/V are always required
 *   (auto-forward runs after Part I approval; show steps even before that).
 * Joint path with R&QA Yes still waits for Part II forward before III/V apply.
 */
export function inspectionRequiresOrdqaPart5(ir: {
  so_involves_dgaqa?: unknown;
  so_involves_rqa?: unknown;
  confirmations?: unknown;
  forwarded_to_ordaqa?: unknown;
}): boolean {
  if (isForwardedToOrdqa(ir)) return true;
  // ORDAQA-only: Parts III & V are the ORDAQA sections for this IR
  if (dgaqaInvolvedInPart1(ir) && inspectionSkipsRqaPart2AndPart4(ir)) return true;
  return false;
}

/** Team Head – QA final sign-off (Approve & Close) recorded. */
export function teamHeadFinalSignoffApproved(ir: {
  final_qa_approver_id?: number | null;
}): boolean {
  return ir.final_qa_approver_id != null && String(ir.final_qa_approver_id).trim() !== '';
}

/**
 * Part IV §30 Team Head signature — shown after Part IV Team Head approval
 * (not after final Approve & Close).
 */
export function resolvePart4TeamHeadSignoff(ir: {
  part4_data?: unknown;
  nominated_team_head_name?: string | null;
  nominated_team_head_signature_path?: string | null;
}): {
  approved: boolean;
  name: string;
  designation: string;
  signaturePath: string | null;
  approvedAt: string | null;
} {
  const approved = part4ApprovedByTeamHead(ir);
  if (!approved) {
    return { approved: false, name: '', designation: '', signaturePath: null, approvedAt: null };
  }
  const p = parseJsonRecord(ir.part4_data);
  const name = String(
    p.part4_team_head_approver_name || ir.nominated_team_head_name || ''
  ).trim();
  const designation = String(p.part4_team_head_approver_designation || '').trim();
  const sigRaw =
    p.part4_team_head_approver_signature_path || ir.nominated_team_head_signature_path || null;
  const signaturePath = sigRaw != null && String(sigRaw).trim() ? String(sigRaw).trim() : null;
  const atRaw = p.part4_team_head_approved_at;
  const approvedAt =
    atRaw != null && String(atRaw).trim() ? String(atRaw).trim() : null;
  return {
    approved: true,
    name: name || 'Team Head – QA',
    designation,
    signaturePath,
    approvedAt,
  };
}

/** Statuses where R&QA Team Head (qa_approver) retains access on Part I No/N/A skip-path IRs. */
export const QA_APPROVER_SKIP_PATH_STATUSES = [
  'request_approved',
  'assigned',
  'in_progress',
  'inspection_completed',
  'completed',
] as const;

/** IR is ready for final Team Head – QA Approve & Close (no Start/Complete step). */
export function inspectionReadyForFinalTeamHeadApproval(ir: {
  status?: string;
  so_involves_rqa?: unknown;
  so_involves_dgaqa?: unknown;
  confirmations?: unknown;
  part4_data?: unknown;
  part3_data?: unknown;
  forwarded_to_ordaqa?: unknown;
  ordaqa_approver_id?: number | null;
}): boolean {
  if (ir.status === 'inspection_completed') return true;
  // DGAQA-only path: Part V approval is enough (no Part IV / Team Head)
  if (inspectionSkipsRqaPart2AndPart4(ir)) {
    return (
      inspectionRequiresOrdqaPart5(ir) &&
      ordqaPart5Completed(ir) &&
      ['assigned', 'in_progress', 'inspection_completed', 'request_approved'].includes(ir.status || '')
    );
  }
  if (!part4ApprovedByTeamHead(ir)) return false;
  if (inspectionRequiresOrdqaPart5(ir)) {
    return (
      ordqaPart5Completed(ir) &&
      ['assigned', 'in_progress', 'inspection_completed'].includes(ir.status || '')
    );
  }
  return ['assigned', 'in_progress', 'inspection_completed'].includes(ir.status || '');
}

/** Team Head – QA (qa_approver) may Approve & Close after inspection_completed
 * (set automatically when Part V is approved, or when Part IV is approved with no Part V). */
export function canUserQaApproverApproveAndClose(
  ir: {
    status?: string;
    so_involves_rqa?: unknown;
    so_involves_dgaqa?: unknown;
    confirmations?: unknown;
    nominated_team_head_id?: number | null;
    part4_data?: unknown;
    part3_data?: unknown;
    forwarded_to_ordaqa?: unknown;
    ordaqa_approver_id?: number | null;
  },
  userId: number,
  userRole?: string
): boolean {
  // DGAQA-only path closes via ORDAQA Head Part V approval — no Team Head step
  if (inspectionSkipsRqaPart2AndPart4(ir)) return false;
  if (!inspectionReadyForFinalTeamHeadApproval(ir)) return false;
  if (userRole === 'administrator') return true;
  if (userRole !== 'qa_approver' || !userId) return false;
  if (inspectionUsesLegacyOpenRqaPart4(ir)) return true;
  return (
    ir.nominated_team_head_id != null && Number(ir.nominated_team_head_id) === userId
  );
}

/** Team Head – QA (qa_approver) may reject IR after inspector completes (inspection_completed). */
export function canUserQaApproverReject(
  ir: Parameters<typeof canUserQaApproverApproveAndClose>[0],
  userId: number,
  userRole?: string
): boolean {
  return canUserQaApproverApproveAndClose(ir, userId, userRole);
}

/**
 * Team Head – QA may permanently reject the IR during Part II
 * (same window as Send back — before inspectors are assigned on nominated path).
 */
export function canUserQaApproverRejectDuringPart2(
  ir: Parameters<typeof canUserQaApproverSendBack>[0],
  userId: number,
  userRole?: string,
  hasInspectorsAssigned?: boolean
): boolean {
  return canUserQaApproverSendBack(ir, userId, userRole, hasInspectorsAssigned);
}

/** Team Head – QA send-back on skip-path IRs (any R&QA TH) or nominated path (before assign). */
export function canUserQaApproverSendBack(
  ir: {
    status?: string;
    confirmations?: unknown;
    nominated_team_head_id?: number | null;
    inspector_id?: number | null;
    inspector_ids?: unknown;
  },
  userId: number,
  userRole?: string,
  hasInspectorsAssigned?: boolean
): boolean {
  if (!(QA_APPROVER_SKIP_PATH_STATUSES as readonly string[]).includes(ir.status || '')) {
    return false;
  }
  if (userRole === 'administrator') return true;
  if (userRole !== 'qa_approver' || !userId) return false;
  if (inspectionUsesLegacyOpenRqaPart4(ir)) {
    return (
      ir.status === 'inspection_completed' ||
      !hasInspectorsAssigned
    );
  }
  return (
    ir.nominated_team_head_id != null &&
    Number(ir.nominated_team_head_id) === userId &&
    !hasInspectorsAssigned
  );
}

const PART3_SECTION23_EDIT_STATUSES = ['request_approved', 'assigned', 'in_progress'] as const;

export function part3Section23EditableStatus(status?: string): boolean {
  return (PART3_SECTION23_EDIT_STATUSES as readonly string[]).includes(status || '');
}

/** Section 23 saved or assignee set — show read-only Part III regardless of workflow status. */
export function part3Section23HasSavedData(ir: {
  part3_data?: unknown;
  ordaqa_inspector_id?: number | null;
}): boolean {
  if (ir.ordaqa_inspector_id != null && String(ir.ordaqa_inspector_id).trim() !== '') {
    return true;
  }
  const p3 = parseJsonRecord(ir.part3_data);
  return !!(
    p3.section23_complete ||
    String(p3.memo_returned ?? '').toLowerCase() === 'yes' ||
    String(p3.received_date_time ?? '').trim() ||
    String(p3.ordaqa_comments ?? '').trim() ||
    p3.delegation_type
  );
}

/** ORDAQA Head / admin may complete or update Section 23 while IR is forwarded and status allows.
 * Locked once Part IV is submitted by R&QA inspector, or Part V is submitted/approved.
 * Also blocked while Outstation Inspection details are still incomplete. */
export function canEditPart3Section23(ir: {
  forwarded_to_ordaqa?: boolean | null;
  status?: string;
  ordaqa_inspector_id?: number | null;
  part2_data?: unknown;
  part3_data?: unknown;
  part4_data?: unknown;
  ordaqa_approver_id?: number | null;
  so_involves_dgaqa?: unknown;
  confirmations?: unknown;
}): boolean {
  if (!isForwardedToOrdqa(ir)) return false;
  if (!part3Section23EditableStatus(ir.status)) return false;
  // Do not allow changing Section 23 after Part IV is submitted
  if (inspectionPart4Saved(ir)) return false;
  // Do not allow changing Section 23 after Part V is with ORDAQA Head or completed
  if (ordqaPart5Submitted(ir) || ordqaPart5Approved(ir)) return false;
  if (part3BlockedByIncompleteOutstation(ir)) return false;
  return true;
}

/** Sections 24–25 fields (Part V UI saves into part3_data alongside Section 23). */
export function effectiveOrdqaPart5Data(ir: { part3_data?: unknown }): Record<string, unknown> {
  const p3 = parseJsonRecord(ir.part3_data);
  return {
    inspection_remarks: p3.inspection_remarks,
    clearance_status: p3.clearance_status,
    dgaqa_inspector_name: p3.dgaqa_inspector_name,
    dgaqa_rep: p3.dgaqa_rep,
    ordaqa_sections_24_25_signature_path: p3.ordaqa_sections_24_25_signature_path,
    delegation_type: p3.delegation_type,
    assigned_delegated_to: p3.assigned_delegated_to,
  };
}

/** User is among Part II assigned R&QA inspector(s). */
export function isUserAssignedPart2Inspector(
  ir: {
    inspector_id?: number | null;
    inspector_ids?: unknown;
    assigned_inspectors?: Array<{ id?: number | null }> | null;
  },
  userId: number
): boolean {
  if (!userId) return false;
  if (ir.inspector_id != null && Number(ir.inspector_id) === userId) return true;
  if (parseInspectorIds(ir.inspector_ids).includes(userId)) return true;
  const fromApi = ir.assigned_inspectors || [];
  return fromApi.some((i) => i?.id != null && Number(i.id) === userId);
}

/** Part II Outstation Inspection — driven by Part I venue when known. */
export function isOutstationInspectionEnabled(ir: {
  part2_data?: unknown;
  venue?: unknown;
  location?: unknown;
}): boolean {
  const cat = part1VenueCategory(ir.venue, ir.location);
  if (cat === 'Outstation') return true;
  if (cat === 'Within CABS' || cat === 'Within Bangalore') return false;

  const v = parseJsonRecord(ir.part2_data).outstation_inspection;
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 't';
  }
  return false;
}

/** Part II outstation email fields still missing after Team Head enabled Outstation Inspection. */
export function part2OutstationDetailsIncomplete(ir: { part2_data?: unknown }): boolean {
  if (!isOutstationInspectionEnabled(ir)) return false;
  const p = parseJsonRecord(ir.part2_data);
  const emailSent = String(p.email_sent ?? '').trim().toLowerCase();
  const by = String(p.email_sent_by ?? '').trim();
  const date = String(p.email_sent_date ?? '').trim();
  if (emailSent !== 'yes' && emailSent !== 'no') return true;
  if (!by) return true;
  if (!date) return true;
  return false;
}

/** True after the assigned R&QA inspector has submitted Outstation Email Sent / Name & Sign / Date & Time. */
export function part2OutstationDetailsSubmitted(ir: { part2_data?: unknown }): boolean {
  return isOutstationInspectionEnabled(ir) && !part2OutstationDetailsIncomplete(ir);
}

/** Outstation edit/reject/send-back locked once ORDAQA Head has submitted Part III (Section 23). */
export function part2OutstationEditLockedByPart3(ir: {
  part3_data?: unknown;
  ordaqa_inspector_id?: number | null;
}): boolean {
  return part3Section23HasSavedData(ir);
}

/** Assigned R&QA inspector may fill outstation Email Sent / Name & Sign / Date & Time. */
export function canUserFillPart2OutstationDetails(
  ir: {
    status?: string;
    part2_data?: unknown;
    part3_data?: unknown;
    ordaqa_inspector_id?: number | null;
    inspector_id?: number | null;
    inspector_ids?: unknown;
    assigned_inspectors?: Array<{ id?: number | null }> | null;
  },
  userId: number,
  userRole?: string
): boolean {
  if (part2OutstationEditLockedByPart3(ir)) return false;
  if (!part2OutstationDetailsIncomplete(ir)) return false;
  if (!['assigned', 'in_progress'].includes(ir.status || '')) return false;
  if (userRole === 'administrator') return true;
  if (!userId) return false;
  return isUserAssignedPart2Inspector(ir, userId);
}

/**
 * Assigned R&QA inspector may Send back to Team Head – QA only while outstation
 * Email Sent / Name & Sign / Date & Time have not been submitted yet.
 */
export function canUserInspectorOutstationRejectOrSendBack(
  ir: {
    status?: string;
    part2_data?: unknown;
    part3_data?: unknown;
    part4_data?: unknown;
    ordaqa_inspector_id?: number | null;
    ordaqa_approver_id?: number | null;
    inspector_id?: number | null;
    inspector_ids?: unknown;
    assigned_inspectors?: Array<{ id?: number | null }> | null;
    so_involves_rqa?: unknown;
    so_involves_dgaqa?: unknown;
    confirmations?: unknown;
    forwarded_to_ordaqa?: unknown;
  },
  userId: number,
  userRole?: string
): boolean {
  if (!isOutstationInspectionEnabled(ir)) return false;
  if (part2OutstationDetailsSubmitted(ir)) return false;
  if (!['assigned', 'in_progress'].includes(String(ir.status || ''))) return false;

  const assigned = isUserAssignedPart2Inspector(ir, userId);
  if (userRole !== 'administrator' && !assigned) return false;

  const p4Status = parseJsonRecord(ir.part4_data).team_head_approval_status;
  if (p4Status === 'pending' || p4Status === 'approved') return false;
  if (ordqaPart5Submitted(ir) || ordqaPart5Approved(ir)) return false;
  return true;
}

/** Latest inspector → Team Head send-back comment stored on Part II. */
export function getInspectorSendBackToTeamHeadComment(ir: { part2_data?: unknown }): string | null {
  const p = parseJsonRecord(ir.part2_data);
  const c = String(p.inspector_send_back_comment ?? '').trim();
  return c || null;
}

/** Primary R&QA inspector from Part II assignment (`inspector_id`, else first in `inspector_ids`). */
export function getPrimaryInspectorId(ir: {
  inspector_id?: number | null;
  inspector_ids?: unknown;
}): number | null {
  const ids = parseInspectorIds(ir.inspector_ids);
  if (ids.length > 0) return ids[0];
  const primary = ir.inspector_id;
  if (primary != null) {
    const n = Number(primary);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * ORDAQA path: Part IV waits for Part III Section 23 only when forwarded to ORDAQA.
 * If Forward to ORDAQA is not selected, the assigned R&QA inspector fills Part IV.
 */
export function part3RequiredBeforePart4(ir: {
  forwarded_to_ordaqa?: unknown;
  so_involves_dgaqa?: unknown;
  so_involves_rqa?: unknown;
  confirmations?: unknown;
}): boolean {
  if (inspectionSkipsRqaPart2AndPart4(ir)) return false;
  return isForwardedToOrdqa(ir);
}

export function part3CompleteForOrdqaWorkflow(ir: {
  part3_data?: unknown;
  ordaqa_inspector_id?: number | null;
}): boolean {
  return part3Section23HasSavedData(ir);
}

/** Part IV blocked until ORDAQA Part III is done (IRs not forwarded to ORDAQA are never blocked). */
export function part4BlockedByPart3(ir: {
  forwarded_to_ordaqa?: unknown;
  so_involves_dgaqa?: unknown;
  so_involves_rqa?: unknown;
  confirmations?: unknown;
  part3_data?: unknown;
  ordaqa_inspector_id?: number | null;
}): boolean {
  return part3RequiredBeforePart4(ir) && !part3CompleteForOrdqaWorkflow(ir);
}

/** Part IV Team Head – QA approval status stored in `part4_data.team_head_approval_status`. */
export type Part4TeamHeadApprovalStatus = 'pending' | 'approved' | 'rejected';

export function getPart4TeamHeadApprovalStatusRaw(
  ir: { part4_data?: unknown }
): Part4TeamHeadApprovalStatus | null {
  const p = parseJsonRecord(ir.part4_data);
  const s = p.team_head_approval_status;
  if (s === 'pending' || s === 'approved' || s === 'rejected') return s;
  return null;
}

/** Part IV submitted and awaiting Team Head – QA approve/reject. */
export function part4PendingTeamHeadApproval(ir: { part4_data?: unknown }): boolean {
  return getPart4TeamHeadApprovalStatusRaw(ir) === 'pending';
}

/**
 * Part IV approved by Team Head – QA.
 * Legacy rows (saved before this gate) with no status field are treated as approved
 * so in-flight IRs are not blocked from Start / Part V.
 */
export function part4ApprovedByTeamHead(ir: { part4_data?: unknown }): boolean {
  if (!inspectionPart4Saved(ir)) return false;
  const s = getPart4TeamHeadApprovalStatusRaw(ir);
  if (s == null) return true;
  return s === 'approved';
}

/** Team Head – QA rejected Part IV (with comments) — inspector may revise and resubmit. */
export function part4RejectedByTeamHead(ir: { part4_data?: unknown }): boolean {
  return getPart4TeamHeadApprovalStatusRaw(ir) === 'rejected';
}

export function getPart4TeamHeadRejectComment(ir: { part4_data?: unknown }): string | null {
  const p = parseJsonRecord(ir.part4_data);
  const c = p.part4_team_head_reject_comment;
  if (c == null || !String(c).trim()) return null;
  return String(c).trim();
}

/**
 * Team Head – QA (or admin) may approve/send back Part IV while it is pending.
 * Skip-path: any `qa_approver`. Nominated path: nominated Team Head – QA only.
 */
export function canUserApprovePart4(
  ir: {
    status?: string;
    confirmations?: unknown;
    nominated_team_head_id?: number | null;
    part4_data?: unknown;
  },
  userId: number,
  userRole?: string
): boolean {
  if (!part4PendingTeamHeadApproval(ir)) return false;
  if (!['assigned', 'in_progress'].includes(ir.status || '')) return false;
  if (userRole === 'administrator') return true;
  if (userRole !== 'qa_approver' || !userId) return false;
  if (inspectionUsesLegacyOpenRqaPart4(ir)) return true;
  return (
    ir.nominated_team_head_id != null && Number(ir.nominated_team_head_id) === userId
  );
}

export function canUserRejectPart4(
  ir: Parameters<typeof canUserApprovePart4>[0],
  userId: number,
  userRole?: string
): boolean {
  return canUserApprovePart4(ir, userId, userRole);
}

/**
 * Team Head – QA (or admin) may permanently reject the IR while Part IV
 * awaits their approval (same gate as Approve / Send back Part IV).
 * Distinct from `reject_part4` (send back to inspector for revision).
 */
export function canUserQaRejectDuringPart4(
  ir: Parameters<typeof canUserApprovePart4>[0],
  userId: number,
  userRole?: string
): boolean {
  return canUserApprovePart4(ir, userId, userRole);
}

/**
 * Team Head – QA (or admin) may edit Part IV while it awaits their approval
 * (same gate as Approve / Send back Part IV).
 */
export function canUserTeamHeadEditPart4(
  ir: Parameters<typeof canUserApprovePart4>[0],
  userId: number,
  userRole?: string
): boolean {
  return canUserApprovePart4(ir, userId, userRole);
}

export type Part4FieldChange = {
  key: string;
  label: string;
  from: string;
  to: string;
};

const PART4_YN_KEYS = new Set([
  'verification_logbook',
  'instruments_calibration',
  'logbook_copy_attached',
  'per_guiding_checklist',
]);

function displayPart4Scalar(key: string, value: unknown): string {
  if (PART4_YN_KEYS.has(key)) {
    const s = String(value ?? '').trim().toLowerCase();
    if (s === 'yes') return 'Yes';
    if (s === 'no') return 'No';
    if (s === 'na') return 'N/A';
    return s ? String(value) : '—';
  }
  if (key === 'start_date' || key === 'completion_date') {
    const s = value == null ? '' : String(value).trim();
    if (!s) return '—';
    return s.slice(0, 10);
  }
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

function normalizePart4Remarks(raw: unknown): Array<Record<string, string>> {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    const row = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
    return {
      sl_no: String(row.sl_no ?? i + 1).trim(),
      observation: String(row.observation ?? '').trim(),
      action_required: String(row.action_required ?? '').trim(),
    };
  });
}

/** Part IV fields the inspector submitted (excludes Team Head metadata). */
export function snapshotPart4EditableFields(src: Record<string, unknown>): Record<string, unknown> {
  return {
    inspection_details: src.inspection_details ?? null,
    start_date: src.start_date ?? null,
    completion_date: src.completion_date ?? null,
    items_offered: src.items_offered ?? null,
    items_accepted: src.items_accepted ?? null,
    observations_count: src.observations_count ?? null,
    items_rejected: src.items_rejected ?? null,
    verification_logbook: src.verification_logbook ?? null,
    instruments_calibration: src.instruments_calibration ?? null,
    logbook_copy_attached: src.logbook_copy_attached ?? null,
    logbook_copy_file_name: src.logbook_copy_file_name ?? null,
    inspection_status: src.inspection_status ?? null,
    per_guiding_checklist: src.per_guiding_checklist ?? null,
    remarks: src.remarks ?? null,
    inspector_rep2_name: src.inspector_rep2_name ?? null,
    part4_remarks: Array.isArray(src.part4_remarks) ? src.part4_remarks : [],
  };
}

/** Diff inspector-submitted Part IV vs current (after Team Head – QA edit). */
export function diffPart4TeamHeadEdits(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Part4FieldChange[] {
  const changes: Part4FieldChange[] = [];
  const scalarKeys: Array<{ key: string; label: string }> = [
    { key: 'inspection_details', label: '26. Details of Inspection / Test' },
    { key: 'start_date', label: '26. Inspection / Test Start Date' },
    { key: 'completion_date', label: '26. Inspection / Test Completion Date' },
    { key: 'items_offered', label: '27. No. of Items Offered' },
    { key: 'items_accepted', label: '27. Accepted' },
    { key: 'observations_count', label: '27. No. of Observations' },
    { key: 'items_rejected', label: '27. Rejected' },
    { key: 'verification_logbook', label: '28.a Verification of observations in log book' },
    { key: 'instruments_calibration', label: '28.b Instruments/Test Facilities Calibration' },
    { key: 'logbook_copy_attached', label: '28.c Copy of log book entries attached' },
    { key: 'logbook_copy_file_name', label: '28.c Log book attachment' },
    { key: 'inspection_status', label: '28.d Status of inspection carried out' },
    { key: 'per_guiding_checklist', label: '28.e Inspection as per guiding checklist' },
    { key: 'remarks', label: '28.f Remarks' },
    { key: 'inspector_rep2_name', label: '30. Inspector / QA Rep 2' },
  ];
  for (const f of scalarKeys) {
    const from = displayPart4Scalar(f.key, before[f.key]);
    const to = displayPart4Scalar(f.key, after[f.key]);
    if (from !== to) changes.push({ key: f.key, label: f.label, from, to });
  }

  const beforeRows = normalizePart4Remarks(before.part4_remarks);
  const afterRows = normalizePart4Remarks(after.part4_remarks);
  const max = Math.max(beforeRows.length, afterRows.length);
  const remarkFields: Array<{ key: string; label: string }> = [
    { key: 'observation', label: 'Observation' },
    { key: 'action_required', label: 'Action Required' },
  ];
  for (let i = 0; i < max; i++) {
    const b = beforeRows[i];
    const a = afterRows[i];
    const sl = a?.sl_no || b?.sl_no || String(i + 1);
    if (!b && a) {
      const summary = [a.observation, a.action_required].filter(Boolean).join(' / ') || '(new row)';
      changes.push({
        key: `part4_remarks.${i}`,
        label: `29. Remark ${sl} (added)`,
        from: '—',
        to: summary,
      });
      continue;
    }
    if (b && !a) {
      const summary = [b.observation, b.action_required].filter(Boolean).join(' / ') || '(removed)';
      changes.push({
        key: `part4_remarks.${i}`,
        label: `29. Remark ${sl} (removed)`,
        from: summary,
        to: '—',
      });
      continue;
    }
    if (!b || !a) continue;
    for (const f of remarkFields) {
      const from = displayPart4Scalar(f.key, b[f.key]);
      const to = displayPart4Scalar(f.key, a[f.key]);
      if (from !== to) {
        changes.push({
          key: `part4_remarks.${i}.${f.key}`,
          label: `29. Remark ${sl} — ${f.label}`,
          from,
          to,
        });
      }
    }
  }
  return changes;
}

function parseStoredPart4Changes(raw: unknown): Part4FieldChange[] {
  if (!Array.isArray(raw)) return [];
  const out: Part4FieldChange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const key = String(o.key || '').trim();
    const label = String(o.label || '').trim();
    if (!key || !label) continue;
    out.push({
      key,
      label,
      from: String(o.from ?? '—'),
      to: String(o.to ?? '—'),
    });
  }
  return out;
}

export function getPart4TeamHeadEditInfo(ir: { part4_data?: unknown }): {
  name: string;
  at: string | null;
  changes: Part4FieldChange[];
} | null {
  const p4 = parseJsonRecord(ir.part4_data);
  const name = String(p4.part4_team_head_edited_by_name || '').trim();
  let changes = parseStoredPart4Changes(p4.part4_team_head_edit_changes);
  const snapshot = p4.part4_inspector_submitted;
  if (
    changes.length === 0 &&
    snapshot &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot)
  ) {
    changes = diffPart4TeamHeadEdits(
      snapshot as Record<string, unknown>,
      snapshotPart4EditableFields(p4)
    );
  }
  const atRaw = p4.part4_team_head_edited_at;
  if (!name && changes.length === 0) {
    const editedBy = p4.part4_team_head_edited_by;
    const hasEditMarker =
      (editedBy != null && Number(editedBy) > 0) ||
      (atRaw != null && String(atRaw).trim() !== '');
    if (!hasEditMarker) return null;
  }
  const at = atRaw != null && String(atRaw).trim() ? String(atRaw).trim() : null;
  return { name: name || 'Team Head – QA', at, changes };
}

/** Part IV (R&QA report) — editable while assigned (before Start); locked while pending/approved by Team Head; locked after Part V when ORDAQA path applies. */
export function canUserUpdatePart4(
  ir: {
    inspector_id?: number | null;
    inspector_ids?: unknown;
    assigned_inspectors?: Array<{ id?: number | null }> | null;
    status?: string;
    so_involves_rqa?: unknown;
    so_involves_dgaqa?: unknown;
    confirmations?: unknown;
    forwarded_to_ordaqa?: boolean | null;
    part3_data?: unknown;
    ordaqa_inspector_id?: number | null;
    part4_data?: unknown;
  },
  userId: number,
  userRole?: string
): boolean {
  if (inspectionSkipsRqaPart2AndPart4(ir)) return false;
  if (ordqaPart5Completed(ir)) return false;
  if (part4PendingTeamHeadApproval(ir)) return false;
  if (getPart4TeamHeadApprovalStatusRaw(ir) === 'approved') return false;
  const status = ir.status || '';
  if (inspectionUsesLegacyOpenRqaPart4(ir)) {
    if (!(SKIPPED_PART2_PART4_STATUSES as readonly string[]).includes(status)) return false;
  } else if (status !== 'assigned') {
    return false;
  }
  if (userRole === 'administrator') return true;
  if (inspectionUsesLegacyOpenRqaPart4(ir)) {
    if (!isRqaInspectorEligibleForSkippedParts(ir, userId, userRole)) return false;
    return true;
  }
  if (!userId) return false;
  if (!isUserAssignedPart2Inspector(ir, userId)) return false;
  if (part4BlockedByPart3(ir)) return false;
  return true;
}

/** Reports saved — prerequisites before Start Inspection. */
export function inspectionReadyToStart(ir: {
  so_involves_rqa?: unknown;
  so_involves_dgaqa?: unknown;
  part4_data?: unknown;
  part3_data?: unknown;
  forwarded_to_ordaqa?: unknown;
  ordaqa_approver_id?: number | null;
  confirmations?: unknown;
}): boolean {
  if (inspectionSkipsRqaPart2AndPart4(ir)) {
    if (inspectionRequiresOrdqaPart5(ir)) return ordqaPart5Completed(ir);
    return true;
  }
  if (!inspectionPart4Saved(ir)) return false;
  if (!part4ApprovedByTeamHead(ir)) return false;
  if (inspectionRequiresOrdqaPart5(ir)) return ordqaPart5Completed(ir);
  return true;
}

/**
 * Start / Complete Inspection are not available to R&QA inspectors or Team Head – QA.
 * Administrator only (for recovery / admin override).
 */
function canUserAdminStartOrCompleteInspection(userId: number, userRole?: string): boolean {
  return !!userId && userRole === 'administrator';
}

/** Start inspection (assigned → in_progress): administrator only. */
export function canUserStartInspection(
  ir: {
    inspector_id?: number | null;
    inspector_ids?: unknown;
    confirmations?: unknown;
    nominated_team_head_id?: number | null;
    status?: string;
    part4_data?: unknown;
    part3_data?: unknown;
    forwarded_to_ordaqa?: unknown;
    ordaqa_approver_id?: number | null;
  },
  userId: number,
  userRole?: string
): boolean {
  if (ir.status !== 'assigned') return false;
  if (!canUserAdminStartOrCompleteInspection(userId, userRole)) return false;
  return inspectionReadyToStart(ir);
}

/** Complete inspection (in_progress → inspection_completed): administrator only. */
export function canUserCompleteInspection(
  ir: {
    inspector_id?: number | null;
    inspector_ids?: unknown;
    confirmations?: unknown;
    nominated_team_head_id?: number | null;
    status?: string;
    part4_data?: unknown;
    part3_data?: unknown;
    forwarded_to_ordaqa?: unknown;
    ordaqa_approver_id?: number | null;
  },
  userId: number,
  userRole?: string
): boolean {
  if (ir.status !== 'in_progress') return false;
  if (!canUserAdminStartOrCompleteInspection(userId, userRole)) return false;
  return inspectionReportsReadyForTeamHead(ir);
}

export function inspectionPart4Saved(ir: { part4_data?: unknown }): boolean {
  const p = ir.part4_data;
  if (p == null) return false;
  if (typeof p === 'string') return p.trim() !== '' && p !== '{}';
  if (typeof p === 'object') return Object.keys(p as object).length > 0;
  return false;
}

/** Assignee saved Part V (clearance in part3_data) — pending ORDAQA Head approval. */
export function ordqaPart5Submitted(ir: {
  forwarded_to_ordaqa?: unknown;
  part3_data?: unknown;
}): boolean {
  if (!inspectionRequiresOrdqaPart5(ir)) return false;
  const e = effectiveOrdqaPart5Data(ir);
  return e.clearance_status != null && String(e.clearance_status).trim() !== '';
}

/** ORDAQA Head approved Part V (`approve_part5` workflow). */
export function ordqaPart5Approved(ir: { ordaqa_approver_id?: number | null }): boolean {
  return ir.ordaqa_approver_id != null && String(ir.ordaqa_approver_id).trim() !== '';
}

/** Part V fully complete — submitted by assignee and approved by ORDAQA Head. */
export function ordqaPart5Completed(ir: {
  forwarded_to_ordaqa?: unknown;
  part3_data?: unknown;
  ordaqa_approver_id?: number | null;
}): boolean {
  return ordqaPart5Submitted(ir) && ordqaPart5Approved(ir);
}

/** ORDAQA Head (or admin) may approve Part V after assignee submission. */
export function canUserApproveOrdqaPart5(
  ir: {
    status?: string | null;
    forwarded_to_ordaqa?: unknown;
    part3_data?: unknown;
    ordaqa_approver_id?: number | null;
  },
  userRole?: string
): boolean {
  if (['completed', 'closed', 'rejected'].includes(String(ir.status || ''))) return false;
  if (!inspectionRequiresOrdqaPart5(ir)) return false;
  if (ordqaPart5Approved(ir)) return false;
  if (!ordqaPart5Submitted(ir)) return false;
  return userRole === 'ordaqa_head' || userRole === 'administrator';
}

/** ORDAQA Head sent Part V back to the assignee for revision (comment stored in part3_data). */
export function ordqaPart5ReturnedToInspector(ir: { part3_data?: unknown }): boolean {
  const p3 = parseJsonRecord(ir.part3_data);
  const c = p3.part5_head_send_back_comment;
  return c != null && String(c).trim() !== '';
}

export function getPart5HeadSendBackComment(ir: { part3_data?: unknown }): string | null {
  const p3 = parseJsonRecord(ir.part3_data);
  const c = p3.part5_head_send_back_comment;
  if (c == null || !String(c).trim()) return null;
  return String(c).trim();
}

/** Who rejected the IR and the comment — visible to every stakeholder. */
export function resolveInspectionRejection(ir: {
  status?: string | null;
  rejection_reason?: string | null;
  part2_data?: unknown;
  part3_data?: unknown;
}): { reason: string; byLabel: string } | null {
  const p2 = parseJsonRecord(ir.part2_data);
  const p3 = parseJsonRecord(ir.part3_data);
  const p5 = String(p3.part5_head_reject_comment ?? '').trim();
  const inspector = String(p2.inspector_reject_comment ?? '').trim();
  const teamHead = String(p2.team_head_reject_comment ?? '').trim();
  const column = String(ir.rejection_reason ?? '').trim();

  let byLabel = 'Rejected';
  let reason = column;
  if (p5) {
    byLabel = 'Rejected by ORDAQA Head';
    reason = p5;
  } else if (inspector) {
    byLabel = 'Rejected by R&QA Inspector';
    reason = inspector;
  } else if (teamHead) {
    byLabel = 'Rejected by Team Head – QA';
    reason = teamHead;
  }

  if (String(ir.status || '') !== 'rejected' && !reason) return null;
  if (!reason && String(ir.status || '') === 'rejected') {
    return { reason: '', byLabel: 'Inspection request was rejected' };
  }
  if (!reason) return null;
  return { reason, byLabel };
}

/** ORDAQA Head (or admin) may send Part V back to the assignee after submission, before approval. */
export function canUserOrdqaHeadPart5SendBack(
  ir: Parameters<typeof canUserApproveOrdqaPart5>[0],
  userRole?: string
): boolean {
  return canUserApproveOrdqaPart5(ir, userRole);
}

/** ORDAQA Head (or admin) may reject the IR after Part V is submitted, before approval. */
export function canUserOrdqaHeadReject(
  ir: Parameters<typeof canUserApproveOrdqaPart5>[0],
  userRole?: string
): boolean {
  return canUserApproveOrdqaPart5(ir, userRole);
}

/**
 * ORDAQA Head (or admin) may edit Part V after the assignee submits,
 * until the IR is completed / closed. Inspector sees the updated fields.
 */
export function canUserOrdqaHeadEditPart5(
  ir: {
    status?: string;
    forwarded_to_ordaqa?: unknown;
    part3_data?: unknown;
    ordaqa_approver_id?: number | null;
  },
  userRole?: string
): boolean {
  if (!inspectionRequiresOrdqaPart5(ir)) return false;
  if (!ordqaPart5Submitted(ir)) return false;
  if (userRole !== 'ordaqa_head' && userRole !== 'administrator') return false;
  if (['completed', 'closed', 'rejected'].includes(String(ir.status || ''))) return false;
  return true;
}

export type Part5FieldChange = {
  key: string;
  label: string;
  from: string;
  to: string;
};

function displayPart5Scalar(key: string, value: unknown): string {
  if (key === 'clearance_status') {
    const s = String(value ?? '').trim().toLowerCase();
    if (s === 'accepted') return 'Accepted and Cleared';
    if (s === 'rework') return 'Rework';
    if (s === 'open') return 'Open';
    return s ? String(value) : '—';
  }
  if (key === 'closed_on') {
    const s = value == null ? '' : String(value).trim();
    if (!s) return '—';
    return s.slice(0, 10);
  }
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

function normalizePart5Remarks(raw: unknown): Array<Record<string, string>> {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => {
    const row = r && typeof r === 'object' ? (r as Record<string, unknown>) : {};
    return {
      sl_no: String(row.sl_no ?? i + 1).trim(),
      observation: String(row.observation ?? '').trim(),
      action_required: String(row.action_required ?? '').trim(),
      closed_on: String(row.closed_on ?? '').trim().slice(0, 10),
      signature: String(row.signature ?? '').trim(),
    };
  });
}

/** Part V fields the inspector submitted (excludes Head metadata). */
export function snapshotPart5EditableFields(src: Record<string, unknown>): Record<string, unknown> {
  return {
    clearance_status: src.clearance_status ?? null,
    dgaqa_inspector_name: src.dgaqa_inspector_name ?? null,
    dgaqa_rep: src.dgaqa_rep ?? null,
    inspection_remarks: Array.isArray(src.inspection_remarks) ? src.inspection_remarks : [],
  };
}

/** Diff inspector-submitted Part V vs current (after ORDAQA Head edit). */
export function diffPart5HeadEdits(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Part5FieldChange[] {
  const changes: Part5FieldChange[] = [];
  const scalarKeys: Array<{ key: string; label: string }> = [
    { key: 'clearance_status', label: '25. Clearance Status' },
    { key: 'dgaqa_inspector_name', label: '25. ORDAQA Approved Inspector' },
    { key: 'dgaqa_rep', label: '25. ORDAQA Rep' },
  ];
  for (const f of scalarKeys) {
    const from = displayPart5Scalar(f.key, before[f.key]);
    const to = displayPart5Scalar(f.key, after[f.key]);
    if (from !== to) changes.push({ key: f.key, label: f.label, from, to });
  }

  const beforeRows = normalizePart5Remarks(before.inspection_remarks);
  const afterRows = normalizePart5Remarks(after.inspection_remarks);
  const max = Math.max(beforeRows.length, afterRows.length);
  const remarkFields: Array<{ key: string; label: string }> = [
    { key: 'observation', label: 'Observation' },
    { key: 'action_required', label: 'Action Required' },
    { key: 'closed_on', label: 'Closed On' },
  ];
  for (let i = 0; i < max; i++) {
    const b = beforeRows[i];
    const a = afterRows[i];
    const sl = a?.sl_no || b?.sl_no || String(i + 1);
    if (!b && a) {
      const summary = [a.observation, a.action_required].filter(Boolean).join(' / ') || '(new row)';
      changes.push({
        key: `inspection_remarks.${i}`,
        label: `24. Remark ${sl} (added)`,
        from: '—',
        to: summary,
      });
      continue;
    }
    if (b && !a) {
      const summary = [b.observation, b.action_required].filter(Boolean).join(' / ') || '(removed)';
      changes.push({
        key: `inspection_remarks.${i}`,
        label: `24. Remark ${sl} (removed)`,
        from: summary,
        to: '—',
      });
      continue;
    }
    if (!b || !a) continue;
    for (const f of remarkFields) {
      const from = displayPart5Scalar(f.key, b[f.key]);
      const to = displayPart5Scalar(f.key, a[f.key]);
      if (from !== to) {
        changes.push({
          key: `inspection_remarks.${i}.${f.key}`,
          label: `24. Remark ${sl} — ${f.label}`,
          from,
          to,
        });
      }
    }
  }
  return changes;
}

function parseStoredPart5Changes(raw: unknown): Part5FieldChange[] {
  if (!Array.isArray(raw)) return [];
  const out: Part5FieldChange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const key = String(o.key || '').trim();
    const label = String(o.label || '').trim();
    if (!key || !label) continue;
    out.push({
      key,
      label,
      from: String(o.from ?? '—'),
      to: String(o.to ?? '—'),
    });
  }
  return out;
}

export function getPart5HeadEditInfo(ir: { part3_data?: unknown }): {
  name: string;
  at: string | null;
  changes: Part5FieldChange[];
} | null {
  const p3 = parseJsonRecord(ir.part3_data);
  const name = String(p3.part5_head_edited_by_name || '').trim();
  let changes = parseStoredPart5Changes(p3.part5_head_edit_changes);
  const snapshot = p3.part5_inspector_submitted;
  if (
    changes.length === 0 &&
    snapshot &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot)
  ) {
    changes = diffPart5HeadEdits(
      snapshot as Record<string, unknown>,
      {
        clearance_status: p3.clearance_status,
        dgaqa_inspector_name: p3.dgaqa_inspector_name,
        dgaqa_rep: p3.dgaqa_rep,
        inspection_remarks: p3.inspection_remarks,
      }
    );
  }
  const atRaw = p3.part5_head_edited_at;
  if (!name && changes.length === 0) {
    const editedBy = p3.part5_head_edited_by;
    const hasEditMarker =
      (editedBy != null && Number(editedBy) > 0) ||
      (atRaw != null && String(atRaw).trim() !== '');
    if (!hasEditMarker) return null;
  }
  const at = atRaw != null && String(atRaw).trim() ? String(atRaw).trim() : null;
  return { name: name || 'ORDAQA Head', at, changes };
}

/**
 * Assigned ORDAQA inspector (or admin) may fill/revise Part V after Part IV Team Head approval,
 * while status is assigned/in_progress and Part V is not yet submitted (or was sent back).
 */
export function canUserUpdatePart5(
  ir: {
    status?: string;
    so_involves_rqa?: unknown;
    so_involves_dgaqa?: unknown;
    confirmations?: unknown;
    forwarded_to_ordaqa?: unknown;
    part3_data?: unknown;
    part4_data?: unknown;
    ordaqa_inspector_id?: number | null;
    ordaqa_approver_id?: number | null;
  },
  userId: number,
  userRole?: string
): boolean {
  if (!inspectionRequiresOrdqaPart5(ir)) return false;
  // When R&QA is involved, Part IV must be done first; DGAQA-only can fill Part V after Part III
  if (!inspectionSkipsRqaPart2AndPart4(ir)) {
    if (!inspectionPart4Saved(ir)) return false;
    if (!part4ApprovedByTeamHead(ir)) return false;
  }
  if (ordqaPart5Approved(ir)) return false;
  if (ordqaPart5Submitted(ir)) return false;
  const status = ir.status || '';
  if (!['request_approved', 'assigned', 'in_progress'].includes(status)) return false;
  if (userRole === 'administrator') return true;
  if (!userId) return false;
  return ir.ordaqa_inspector_id != null && Number(ir.ordaqa_inspector_id) === userId;
}

/**
 * Assigned ORDAQA inspector has outstanding Part V work (dashboard / Action Required).
 * Shown once they are assigned in Part III — filling may still wait on Part IV when R&QA is involved.
 */
export function userHasPart5ActionRequired(
  ir: Parameters<typeof canUserUpdatePart5>[0],
  userId: number,
  userRole?: string
): boolean {
  if (!inspectionRequiresOrdqaPart5(ir)) return false;
  if (ordqaPart5Approved(ir)) return false;
  if (ordqaPart5Submitted(ir)) return false;
  const status = ir.status || '';
  if (!['request_approved', 'assigned', 'in_progress'].includes(status)) return false;
  if (userRole === 'administrator') return true;
  if (!userId) return false;
  return ir.ordaqa_inspector_id != null && Number(ir.ordaqa_inspector_id) === userId;
}

/** Part IV saved & Team Head–approved; when ORDAQA, Part V submitted and Head-approved — required before Complete Inspection. */
export function inspectionReportsReadyForTeamHead(ir: {
  so_involves_rqa?: unknown;
  so_involves_dgaqa?: unknown;
  part4_data?: unknown;
  part3_data?: unknown;
  forwarded_to_ordaqa?: unknown;
  ordaqa_approver_id?: number | null;
  confirmations?: unknown;
}): boolean {
  if (inspectionSkipsRqaPart2AndPart4(ir)) {
    if (!inspectionRequiresOrdqaPart5(ir)) return true;
    return ordqaPart5Completed(ir);
  }
  if (!inspectionPart4Saved(ir)) return false;
  if (!part4ApprovedByTeamHead(ir)) return false;
  if (!inspectionRequiresOrdqaPart5(ir)) return true;
  return ordqaPart5Completed(ir);
}

export type InspectionCustody = {
  /** Short workflow location, e.g. "Part III". */
  stage: string;
  /** Role holding the IR, e.g. "ORDAQA Head". */
  role: string;
  /** Person name(s) when known. */
  name: string | null;
  /** One-line hint for stakeholders. */
  action: string;
};

function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) {
    const t = v != null ? String(v).trim() : '';
    if (t) return t;
  }
  return null;
}

/**
 * Where the IR currently sits — for stakeholder "Currently with" display.
 * Prefer named people from the IR / role holders; fall back to role title.
 */
export function resolveInspectionCustody(ir: {
  status?: string | null;
  rejection_reason?: string | null;
  so_involves_rqa?: unknown;
  so_involves_dgaqa?: unknown;
  confirmations?: unknown;
  forwarded_to_ordaqa?: unknown;
  part2_data?: unknown;
  part3_data?: unknown;
  part4_data?: unknown;
  initiator_name?: string | null;
  nominated_request_approver_name?: string | null;
  request_approver_name?: string | null;
  part1_approver_name?: string | null;
  part1_approved_by_name?: string | null;
  qa_approver_name?: string | null;
  qa_head_names?: string | null;
  nominated_team_head_id?: number | null;
  nominated_team_head_name?: string | null;
  inspector_id?: number | null;
  inspector_ids?: unknown;
  assigned_inspectors?: Array<{ name?: string | null }> | null;
  inspector_name?: string | null;
  inspector_names?: string | null;
  ordaqa_inspector_id?: number | null;
  ordaqa_inspector_name?: string | null;
  ordaqa_head_names?: string | null;
  part3_completed_by_name?: string | null;
  ordaqa_approver_id?: number | null;
  ordaqa_approver_name?: string | null;
  final_qa_approver_id?: number | null;
  final_qa_approver_name?: string | null;
}): InspectionCustody {
  const status = String(ir.status || '');
  const needsOrdqa = inspectionRequiresOrdqaPart5(ir);
  const needsRqa = rqaInvolvedInPart1(ir);
  const forwarded = isForwardedToOrdqa(ir);
  const section23 = part3Section23HasSavedData(ir);
  const inspectors = formatAssignedInspectorsDisplay(ir, '');
  const hasInspectors = !!inspectors;
  const teamHead = firstNonEmpty(ir.nominated_team_head_name);
  const qaHead = firstNonEmpty(ir.qa_approver_name, ir.qa_head_names);
  // Do not use part3_completed_by_name here — save_part5 overwrites that with the
  // ORDAQA Inspector who signed Sections 24–25, not the ORDAQA Head.
  const ordaqaHead = firstNonEmpty(ir.ordaqa_approver_name, ir.ordaqa_head_names);
  const ordaqaAssignee = firstNonEmpty(ir.ordaqa_inspector_name);
  const requestApprover = firstNonEmpty(
    ir.request_approver_name,
    ir.nominated_request_approver_name
  );
  const part1Approver = firstNonEmpty(ir.part1_approver_name, ir.part1_approved_by_name);

  if (status === 'rejected') {
    const rej = resolveInspectionRejection(ir);
    return {
      stage: 'Rejected',
      role: '—',
      name: null,
      action: rej?.byLabel || 'Inspection request was rejected',
    };
  }
  if (status === 'completed' || ir.final_qa_approver_id != null) {
    return {
      stage: 'Completed',
      role: '—',
      name: firstNonEmpty(ir.final_qa_approver_name),
      action: 'Inspection Request completed',
    };
  }
  if (status === 'returned_to_designer' || status === 'pending' || status === 'draft') {
    return {
      stage: 'Part I',
      role: 'Initiator',
      name: firstNonEmpty(ir.initiator_name),
      action:
        status === 'returned_to_designer'
          ? 'Part I corrections / resubmit'
          : 'Draft or pending submit',
    };
  }
  if (status === 'pending_request_approval') {
    return {
      stage: 'Part I',
      role: 'Part I Approver',
      name: requestApprover,
      action: 'Approve Part I / Send back / Reject',
    };
  }
  if (status === 'pending_part1_approval') {
    return {
      stage: 'Part I',
      role: 'Forward Request',
      name: part1Approver,
      action: 'Forward Request',
    };
  }

  if (memoReturnedAwaitingQaHead(ir)) {
    return {
      stage: 'Part II',
      role: 'QA Head',
      name: qaHead,
      action: 'Review memo return and re-forward to ORDAQA if needed',
    };
  }

  // Part II — QA Head nominates Team Head (R&QA path only)
  if (needsRqa && !ir.nominated_team_head_id && status === 'request_approved') {
    return {
      stage: 'Part II',
      role: 'QA Head',
      name: qaHead,
      action: 'Nominate Team Head – QA and complete Part II',
    };
  }

  // Team Head assigns inspectors (R&QA path only)
  if (needsRqa && ir.nominated_team_head_id && !hasInspectors) {
    return {
      stage: 'Part II',
      role: 'Team Head – QA',
      name: teamHead,
      action: 'Assign R&QA inspector(s)',
    };
  }

  // Part II — assigned R&QA inspector fills Outstation details (before Part III / IV)
  if (
    needsRqa &&
    hasInspectors &&
    part2OutstationDetailsIncomplete(ir) &&
    ['assigned', 'in_progress', 'request_approved'].includes(status)
  ) {
    return {
      stage: 'Part II',
      role: 'R&QA Inspector',
      name: inspectors || null,
      action: 'Fill Outstation Inspection details (Email Sent, Name & Sign, Date & Time)',
    };
  }

  // Part III — ORDAQA Head Section 23
  // DGAQA/ORDAQA-only: show as next step even before auto-forward flag is set
  if (needsOrdqa && !section23 && (forwarded || !needsRqa)) {
    return {
      stage: 'Part III',
      role: 'ORDAQA Head',
      name: ordaqaHead,
      action: forwarded
        ? 'Complete Section 23 (Assigned / Delegated)'
        : 'Awaiting forward to ORDAQA, then complete Section 23',
    };
  }

  // Part IV Team Head approval pending
  if (inspectionPart4Saved(ir) && part4PendingTeamHeadApproval(ir)) {
    return {
      stage: 'Part IV',
      role: 'Team Head – QA',
      name: teamHead,
      action: 'Approve, send back, or reject Part IV',
    };
  }

  // Part V awaiting ORDAQA Head approval
  if (needsOrdqa && ordqaPart5Submitted(ir) && !ordqaPart5Approved(ir)) {
    return {
      stage: 'Part V',
      role: 'ORDAQA Head',
      name: ordaqaHead,
      action: 'Approve Part V (Sections 24–25)',
    };
  }

  // Part V with assignee (after Part III; Part IV only when R&QA involved)
  if (needsOrdqa && section23 && forwarded && !ordqaPart5Submitted(ir)) {
    const part4Ready =
      !needsRqa || (inspectionPart4Saved(ir) && part4ApprovedByTeamHead(ir));
    if (part4Ready) {
      return {
        stage: 'Part V',
        role: 'ORDAQA Assignee',
        name: ordaqaAssignee,
        action: 'Complete Sections 24–25',
      };
    }
  }

  // Ready for Approve & Close (R&QA Team Head path only)
  if (
    needsRqa &&
    inspectionReadyForFinalTeamHeadApproval({ ...ir, status: status || undefined })
  ) {
    return {
      stage: 'Approve & Close',
      role: 'Team Head – QA',
      name: teamHead,
      action: 'Final Approve & Close',
    };
  }

  // Part IV with R&QA inspectors (or waiting Part III gate)
  if (needsRqa && needsOrdqa && forwarded && section23 && !inspectionPart4Saved(ir)) {
    return {
      stage: 'Part IV',
      role: 'R&QA Inspector',
      name: inspectors || null,
      action: 'Fill Part IV inspection report',
    };
  }

  if (needsRqa && !needsOrdqa && hasInspectors && !inspectionPart4Saved(ir)) {
    return {
      stage: 'Part IV',
      role: 'R&QA Inspector',
      name: inspectors || null,
      action: 'Fill Part IV inspection report',
    };
  }

  if (needsRqa && hasInspectors && inspectionPart4Saved(ir) && part4RejectedByTeamHead(ir)) {
    return {
      stage: 'Part IV',
      role: 'R&QA Inspector',
      name: inspectors || null,
      action: 'Revise Part IV after Team Head rejection',
    };
  }

  // DGAQA-only: awaiting ORDAQA forward / Part III
  if (needsOrdqa && !needsRqa && !section23) {
    return {
      stage: 'Part III',
      role: 'ORDAQA Head',
      name: ordaqaHead,
      action: forwarded
        ? 'Complete Section 23 (Assigned / Delegated)'
        : 'Awaiting forward to ORDAQA',
    };
  }

  if (hasInspectors) {
    return {
      stage: 'Inspection',
      role: 'R&QA Inspector',
      name: inspectors || null,
      action: 'In progress with assigned inspector(s)',
    };
  }

  return {
    stage: 'Part II',
    role: 'QA Head',
    name: qaHead,
    action: 'Awaiting Part II action',
  };
}

/** Compact line: "Currently with: Name (Role) · Stage — action". */
export function formatInspectionCustodyLine(c: InspectionCustody): string {
  if (c.stage === 'Completed') {
    const by = c.name?.trim();
    return by
      ? `Inspection Request completed · Final approved by: ${by}`
      : 'Inspection Request completed';
  }
  if (c.stage === 'Rejected') return c.action || 'Inspection request was rejected';
  const who = c.name ? `${c.name} (${c.role})` : c.role;
  return `Currently with: ${who} · ${c.stage} — ${c.action}`;
}
