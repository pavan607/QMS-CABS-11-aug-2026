const COMPLETED_STATUSES = new Set([
  'inspection_completed',
  'completed',
  'approved',
  'closed',
]);

export type InspectorReportRow = {
  status?: string;
  inspector_name?: string | null;
  inspector_names?: string | null;
  inspection_started_by_name?: string | null;
  inspection_completed_by_name?: string | null;
  part4_completed_by_name?: string | null;
};

export function parseInspectorNameList(names: string | null | undefined): string[] {
  if (!names?.trim()) return [];
  return names.split(',').map((n) => n.trim()).filter(Boolean);
}

export function resolveInspectorNames(row: InspectorReportRow): string[] {
  const raw =
    (typeof row.inspector_names === 'string' && row.inspector_names.trim())
      ? row.inspector_names
      : (typeof row.inspector_name === 'string' && row.inspector_name.trim())
        ? row.inspector_name
        : '';
  return parseInspectorNameList(raw);
}

function normalizeName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

export function resolveCompletedByName(row: InspectorReportRow): string | null {
  const fromActivity = row.inspection_completed_by_name?.trim();
  if (fromActivity) return fromActivity;
  const fromPart4 = row.part4_completed_by_name?.trim();
  return fromPart4 || null;
}

/** Inspector who both started and completed the inspection (case-insensitive name match). */
export function resolveStartCompleteInspectorName(row: InspectorReportRow): string | null {
  const started = row.inspection_started_by_name?.trim();
  const completed = resolveCompletedByName(row);
  if (!started || !completed) return null;
  if (normalizeName(started) !== normalizeName(completed)) return null;
  return started;
}

export function shouldHighlightInspectorName(
  name: string,
  row: InspectorReportRow,
  startCompleteInspector: string | null
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;

  if (startCompleteInspector) {
    return normalizeName(trimmed) === normalizeName(startCompleteInspector);
  }

  // Legacy rows without activity logs: highlight sole assigned inspector once IR is done.
  if (!row.status || !COMPLETED_STATUSES.has(row.status)) return false;
  const names = resolveInspectorNames(row);
  return names.length === 1 && normalizeName(names[0]) === normalizeName(trimmed);
}

export function inspectorNamesPlainText(row: InspectorReportRow): string {
  const names = resolveInspectorNames(row);
  return names.length > 0 ? names.join(', ') : '';
}
