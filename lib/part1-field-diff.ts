/** Human-readable Part I field diffs for initiator visibility when a certifier edits. */

export type Part1FieldChange = {
  key: string;
  label: string;
  from: string;
  to: string;
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  location: 'Location / Venue',
  venue: '17. Venue',
  item: 'Item',
  inspection_type: 'Inspection type',
  due_date: 'Due date',
  scheduled_date: 'Scheduled date',
  request_date: 'Request date',
  project_id: '1. Project',
  subsystem_id: '2. Subsystem',
  lru_id: '3. LRU',
  sru_id: 'SRU',
  item_pertains_to: '4. Item pertains to',
  item_pertains_to_other: '4. Item pertains to (other)',
  test_type: '5. Test type',
  test_type_other: '5. Test type (other)',
  so_details: '6. S.O. details',
  delivery_period: '7. Delivery period',
  source: '8. Source',
  oem_name: 'OEM name',
  lru_nomenclature: '9. LRU nomenclature',
  criticality: '10. Criticality',
  part_number: '11. Part number',
  serial_number: '12. Serial number',
  quantity: '13. Quantity',
  quantity_per_set: 'Quantity per set',
  previous_stage_cleared: '14. Previous stage cleared',
  logbook_attached: '15. Logbook attached',
  inspection_stage: '16. Inspection stage',
  inspection_mode: 'Inspection mode',
  inspection_datetime: 'Inspection date/time',
  inspection_date_from: 'Inspection date from',
  inspection_date_to: 'Inspection date to',
  document_details: '18. Document details',
  confirmations: '19. Confirmations',
  designer_rep_name: '20. Designer rep name',
  designer_rep_designation: '20. Designer rep designation',
  designer_rep_contact: '20. Designer rep contact',
  design_coordinator_name: 'Design coordinator',
  certified_by_name: '21. Certifier name',
  certified_by_designation: '21. Certifier designation',
  nominated_request_approver_id: '21. Nominated Request Approver',
  so_involves_dgaqa: 'S.O. involves DGAQA',
  so_involves_rqa: 'S.O. involves R&QA',
};

const COMPARE_KEYS = Object.keys(FIELD_LABELS);

function normalizeComparable(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    try {
      // Stable JSON for objects/arrays (including jsonb from pg)
      return JSON.stringify(value, Object.keys(value as object).sort());
    } catch {
      return String(value);
    }
  }
  const s = String(value).trim();
  // Normalize date-like values
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // Try parse JSON strings to stable form
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    try {
      const parsed = JSON.parse(s);
      return JSON.stringify(parsed, typeof parsed === 'object' && parsed && !Array.isArray(parsed)
        ? Object.keys(parsed).sort()
        : undefined);
    } catch {
      return s;
    }
  }
  return s;
}

function displayValue(value: unknown): string {
  const n = normalizeComparable(value);
  if (!n) return '(empty)';
  if (n.length > 120) return `${n.slice(0, 117)}…`;
  try {
    const parsed = JSON.parse(n);
    if (Array.isArray(parsed)) return parsed.join(', ') || '(empty)';
    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('; ');
    }
  } catch {
    /* plain string */
  }
  return n;
}

/** Diff Part I fields between previous and updated IR rows. */
export function diffPart1Fields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Part1FieldChange[] {
  const changes: Part1FieldChange[] = [];
  for (const key of COMPARE_KEYS) {
    if (!(key in before) && !(key in after)) continue;
    const fromRaw = before[key];
    const toRaw = after[key];
    const fromN = normalizeComparable(fromRaw);
    const toN = normalizeComparable(toRaw);
    if (fromN === toN) continue;
    changes.push({
      key,
      label: FIELD_LABELS[key] || key,
      from: displayValue(fromRaw),
      to: displayValue(toRaw),
    });
  }
  return changes;
}

/** Short multi-line summary for notifications / activity (max ~fields). */
export function formatPart1ChangesSummary(
  changes: Part1FieldChange[],
  maxFields = 12
): string {
  if (changes.length === 0) return 'No field values changed.';
  const shown = changes.slice(0, maxFields);
  const lines = shown.map((c) => `• ${c.label}: "${c.from}" → "${c.to}"`);
  if (changes.length > maxFields) {
    lines.push(`• …and ${changes.length - maxFields} more field(s)`);
  }
  return lines.join('\n');
}

export type Part1CertifierEditSummary = {
  editedBy: string;
  editedByUserId: number;
  editedAt: string;
  changes: Part1FieldChange[];
};

export function buildPart1CertifierEditSummary(
  editorName: string,
  editorUserId: number,
  changes: Part1FieldChange[]
): Part1CertifierEditSummary {
  return {
    editedBy: editorName.trim() || 'Request Approver',
    editedByUserId: editorUserId,
    editedAt: new Date().toISOString(),
    changes,
  };
}

export function parsePart1CertifierEditSummary(
  raw: unknown
): Part1CertifierEditSummary | null {
  if (raw == null || raw === '') return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    const changes = Array.isArray((parsed as any).changes)
      ? (parsed as any).changes.filter(
          (c: any) => c && typeof c.label === 'string'
        )
      : [];
    return {
      editedBy: String((parsed as any).editedBy || 'Request Approver'),
      editedByUserId: Number((parsed as any).editedByUserId) || 0,
      editedAt: String((parsed as any).editedAt || ''),
      changes,
    };
  } catch {
    return null;
  }
}
