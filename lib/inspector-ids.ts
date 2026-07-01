/** Client-safe helpers for Part II `inspector_ids` / `inspector_id` (no Node/pg imports). */

/** Parse `inspector_ids` from DB (TEXT JSON, jsonb array, or already-parsed array). */
export function parseInspectorIds(raw: unknown): number[] {
  if (raw == null || raw === '') return [];
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t || t === '[]') return [];
    try {
      parsed = JSON.parse(t);
    } catch {
      return [];
    }
  }
  if (Array.isArray(parsed)) {
    return [
      ...new Set(
        parsed
          .map((x) => Number.parseInt(String(x), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      ),
    ];
  }
  const single = Number.parseInt(String(parsed), 10);
  if (Number.isFinite(single) && single > 0) return [single];
  return [];
}

/** All Part II inspector user ids (`inspector_ids` JSON, else legacy `inspector_id`). */
export function collectInspectorIds(ir: {
  inspector_id?: number | null;
  inspector_ids?: unknown;
}): number[] {
  const fromList = parseInspectorIds(ir.inspector_ids);
  if (fromList.length > 0) return fromList;
  const primary = ir.inspector_id != null ? Number(ir.inspector_id) : NaN;
  if (Number.isFinite(primary) && primary > 0) return [primary];
  return [];
}
