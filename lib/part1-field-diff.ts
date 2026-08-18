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
  so_involves_dgaqa: '4. Involvement — DGAQA (ORDAQA)',
  so_involves_rqa: '4. Involvement — R&QA',
};

const COMPARE_KEYS = Object.keys(FIELD_LABELS);

function stableStringify(value: unknown): string {
  if (value == null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function normalizeComparable(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    try {
      // Stable deep JSON — do not use Object.keys as JSON.stringify replacer
      // (that whitelist strips nested keys like doc_no / approved on document_details).
      return stableStringify(value);
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
      return stableStringify(parsed);
    } catch {
      return s;
    }
  }
  return s;
}

function formatYesNoNa(value: unknown): string {
  const v = String(value ?? '').trim().toLowerCase();
  if (v === 'yes') return 'Yes';
  if (v === 'no') return 'No';
  if (v === 'na') return 'NA';
  if (v === 'open') return 'Open';
  if (v === 'closed') return 'Closed';
  if (v === 'draft') return 'Draft';
  return v ? String(value) : '—';
}

const CONFIRMATION_SHORT_LABELS: Record<string, string> = {
  approved_docs_available: 'a) Approved copies of documents…',
  logbook_updated: 'b) R&QA Log book updated…',
  previous_observations_status: 'c) Previous observations/NCs…',
  cocs_available: 'd) CoCs / certificates available…',
  instruments_available: 'e) Measuring instruments available…',
};

const CONFIRMATION_ORDER = [
  'approved_docs_available',
  'logbook_updated',
  'previous_observations_status',
  'cocs_available',
  'instruments_available',
] as const;

function parseMaybeJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function formatConfirmationsForDisplay(conf: Record<string, unknown>): string {
  const keys = [
    ...CONFIRMATION_ORDER.filter((k) => k in conf),
    ...Object.keys(conf).filter(
      (k) => !(CONFIRMATION_ORDER as readonly string[]).includes(k) && k !== 'joint_inspection_request'
    ),
  ];
  const parts = keys.map((key) => {
    const label = CONFIRMATION_SHORT_LABELS[key] || key;
    return `${label}: ${formatYesNoNa(conf[key])}`;
  });
  return parts.join('; ') || '(empty)';
}

function formatDocDetailsForDisplay(docs: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    ts: 'TS',
    qap: 'QAP',
    sop_mdi: 'SOP/MDI/BOM/ICD',
    qtp_lqtp_softp: 'QTP/LQTP/SOFTP',
    ftp_atp: 'FTP/ATP',
    pc_ta_other: 'PC/TA/Other Doc',
  };
  const order = ['ts', 'qap', 'sop_mdi', 'qtp_lqtp_softp', 'ftp_atp', 'pc_ta_other'];
  const parts: string[] = [];
  for (const key of order) {
    const row = docs[key];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const approved = String(r.approved ?? '').trim().toLowerCase();
    const approvedLabel = formatYesNoNa(approved);
    if (approved === 'no' || approved === 'na' || !approved) {
      parts.push(`${labels[key] || key}: ${approvedLabel}`);
      continue;
    }
    const bits = [
      approvedLabel,
      r.doc_no != null && String(r.doc_no).trim() !== '' ? `Doc ${r.doc_no}` : null,
      r.amd_no != null && String(r.amd_no).trim() !== '' ? `Amd ${r.amd_no}` : null,
      r.rev_no != null && String(r.rev_no).trim() !== '' ? `Rev ${r.rev_no}` : null,
      r.date ? `Date ${String(r.date).slice(0, 10)}` : null,
    ].filter(Boolean);
    parts.push(`${labels[key] || key}: ${bits.join(', ')}`);
  }
  return parts.join('; ') || '(empty)';
}

function displayValue(value: unknown): string {
  const n = normalizeComparable(value);
  if (!n) return '(empty)';
  const asObj = parseMaybeJsonObject(value);
  if (asObj) {
    const keys = Object.keys(asObj);
    if (keys.some((k) => ['ts', 'qap', 'sop_mdi', 'ftp_atp', 'pc_ta_other'].includes(k))) {
      const pretty = formatDocDetailsForDisplay(asObj);
      if (pretty.length > 280) return `${pretty.slice(0, 277)}…`;
      return pretty;
    }
    if (keys.some((k) => k in CONFIRMATION_SHORT_LABELS)) {
      const pretty = formatConfirmationsForDisplay(asObj);
      if (pretty.length > 280) return `${pretty.slice(0, 277)}…`;
      return pretty;
    }
  }
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

function expandConfirmationsDiff(
  fromRaw: unknown,
  toRaw: unknown
): Part1FieldChange[] {
  const fromObj = parseMaybeJsonObject(fromRaw) || {};
  const toObj = parseMaybeJsonObject(toRaw) || {};
  const keys = Array.from(
    new Set([
      ...CONFIRMATION_ORDER,
      ...Object.keys(fromObj),
      ...Object.keys(toObj),
    ])
  ).filter((k) => k !== 'joint_inspection_request');
  const changes: Part1FieldChange[] = [];
  for (const key of keys) {
    const fromV = formatYesNoNa(fromObj[key]);
    const toV = formatYesNoNa(toObj[key]);
    if (fromV === toV) continue;
    if (fromV === '—' && toV === '—') continue;
    changes.push({
      key: `confirmations.${key}`,
      label: CONFIRMATION_SHORT_LABELS[key] || `19. ${key}`,
      from: fromV,
      to: toV,
    });
  }
  return changes;
}

function expandDocumentDetailsDiff(
  fromRaw: unknown,
  toRaw: unknown
): Part1FieldChange[] {
  const fromObj = parseMaybeJsonObject(fromRaw) || {};
  const toObj = parseMaybeJsonObject(toRaw) || {};
  const labels: Record<string, string> = {
    ts: 'TS',
    qap: 'QAP',
    sop_mdi: 'SOP/MDI/BOM/ICD',
    qtp_lqtp_softp: 'QTP/LQTP/SOFTP',
    ftp_atp: 'FTP/ATP',
    pc_ta_other: 'PC/TA/Other Doc',
  };
  const fieldLabels: Record<string, string> = {
    approved: 'Approved',
    doc_no: 'Doc No.',
    amd_no: 'Amd',
    rev_no: 'Rev',
    date: 'Date',
  };
  const order = ['ts', 'qap', 'sop_mdi', 'qtp_lqtp_softp', 'ftp_atp', 'pc_ta_other'];
  const keys = Array.from(new Set([...order, ...Object.keys(fromObj), ...Object.keys(toObj)]));
  const changes: Part1FieldChange[] = [];
  for (const key of keys) {
    const fromRow =
      fromObj[key] && typeof fromObj[key] === 'object'
        ? (fromObj[key] as Record<string, unknown>)
        : {};
    const toRow =
      toObj[key] && typeof toObj[key] === 'object'
        ? (toObj[key] as Record<string, unknown>)
        : {};
    const docLabel = labels[key] || key;
    for (const field of ['approved', 'doc_no', 'amd_no', 'rev_no', 'date'] as const) {
      const fromV =
        field === 'approved'
          ? formatYesNoNa(fromRow[field])
          : fromRow[field] != null && String(fromRow[field]).trim() !== ''
            ? String(fromRow[field])
            : '—';
      const toV =
        field === 'approved'
          ? formatYesNoNa(toRow[field])
          : toRow[field] != null && String(toRow[field]).trim() !== ''
            ? String(toRow[field])
            : '—';
      if (fromV === toV) continue;
      changes.push({
        key: `document_details.${key}.${field}`,
        label: `${docLabel} — ${fieldLabels[field]}`,
        from: fromV,
        to: toV,
      });
    }
  }
  return changes;
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
    if (key === 'confirmations') {
      const expanded = expandConfirmationsDiff(fromRaw, toRaw);
      if (expanded.length) {
        changes.push(...expanded);
        continue;
      }
    }
    if (key === 'document_details') {
      const expanded = expandDocumentDetailsDiff(fromRaw, toRaw);
      if (expanded.length) {
        changes.push(...expanded);
        continue;
      }
    }
    changes.push({
      key,
      label: FIELD_LABELS[key] || key,
      from: displayValue(fromRaw),
      to: displayValue(toRaw),
    });
  }
  return changes;
}

/** Re-format a single stored summary row that still has a raw JSON from/to blob. */
export function prettifyPart1FieldChange(change: Part1FieldChange): Part1FieldChange {
  if (change.key === 'confirmations' || change.key.startsWith('confirmations.')) {
    const fromObj =
      parseMaybeJsonObject(change.from) || extractConfirmationMapFromPartial(change.from);
    const toObj = parseMaybeJsonObject(change.to) || extractConfirmationMapFromPartial(change.to);
    if (fromObj || toObj) {
      return {
        ...change,
        from: fromObj ? formatConfirmationsForDisplay(fromObj) : change.from,
        to: toObj ? formatConfirmationsForDisplay(toObj) : change.to,
      };
    }
  }
  if (change.key === 'document_details' || change.key.startsWith('document_details.')) {
    const fromObj = parseMaybeJsonObject(change.from);
    const toObj = parseMaybeJsonObject(change.to);
    if (fromObj || toObj) {
      return {
        ...change,
        from: fromObj ? formatDocDetailsForDisplay(fromObj) : change.from,
        to: toObj ? formatDocDetailsForDisplay(toObj) : change.to,
      };
    }
  }
  return change;
}

/** Expand/re-format one stored summary row (handles legacy JSON blobs). */
export function expandStoredPart1FieldChange(change: Part1FieldChange): Part1FieldChange[] {
  if (change.key === 'confirmations') {
    const fromObj =
      parseMaybeJsonObject(change.from) || extractConfirmationMapFromPartial(change.from);
    const toObj = parseMaybeJsonObject(change.to) || extractConfirmationMapFromPartial(change.to);
    if (fromObj && toObj) {
      const expanded = expandConfirmationsDiff(fromObj, toObj);
      if (expanded.length) return expanded;
    }
  }
  if (change.key === 'document_details') {
    const fromObj = parseMaybeJsonObject(change.from);
    const toObj = parseMaybeJsonObject(change.to);
    if (fromObj && toObj) {
      const expanded = expandDocumentDetailsDiff(fromObj, toObj);
      if (expanded.length) return expanded;
    }
  }
  // Legacy whole-row doc change: document_details.qap with "—" → "NA"
  if (/^document_details\.[a-z0-9_]+$/i.test(change.key) && !change.key.split('.')[2]) {
    const docKey = change.key.split('.')[1];
    const labels: Record<string, string> = {
      ts: 'TS',
      qap: 'QAP',
      sop_mdi: 'SOP/MDI/BOM/ICD',
      qtp_lqtp_softp: 'QTP/LQTP/SOFTP',
      ftp_atp: 'FTP/ATP',
      pc_ta_other: 'PC/TA/Other Doc',
    };
    const looksLikeApprovedOnly =
      /^(—|-|Yes|No|NA|N\/A|Draft|\(empty\))$/i.test(String(change.from).trim()) &&
      /^(—|-|Yes|No|NA|N\/A|Draft|\(empty\))$/i.test(String(change.to).trim());
    if (looksLikeApprovedOnly) {
      return [
        {
          key: `document_details.${docKey}.approved`,
          label: `${labels[docKey] || docKey} — Approved`,
          from: formatYesNoNa(change.from === '—' || change.from === '-' ? '' : change.from),
          to: formatYesNoNa(change.to === '—' || change.to === '-' ? '' : change.to),
        },
      ];
    }
    return [
      {
        ...change,
        label: change.label?.startsWith('18.')
          ? change.label
          : `${labels[docKey] || docKey}`,
      },
    ];
  }
  return [prettifyPart1FieldChange(change)];
}

function extractConfirmationMapFromPartial(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;
  const out: Record<string, unknown> = {};
  for (const key of CONFIRMATION_ORDER) {
    const re = new RegExp(`"${key}"\\s*:\\s*"(yes|no|na|open|closed)"`, 'i');
    const m = raw.match(re);
    if (m) out[key] = m[1].toLowerCase();
  }
  return Object.keys(out).length ? out : null;
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
      ? (parsed as any).changes
          .filter((c: any) => c && typeof c.label === 'string')
          .flatMap((c: any) =>
            expandStoredPart1FieldChange({
              key: String(c.key || ''),
              label: String(c.label),
              from: String(c.from ?? ''),
              to: String(c.to ?? ''),
            })
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
