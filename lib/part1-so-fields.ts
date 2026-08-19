/** Client-safe Part I field 4 helpers (no Node/DB imports). */

export function parsePart1Bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function isSupplyOrderAttachment(description?: string | null): boolean {
  return String(description || '')
    .toLowerCase()
    .includes('supply order');
}

export function isLogBookAttachment(description?: string | null): boolean {
  const s = String(description || '').toLowerCase();
  return s.includes('log book') || s.includes('logbook');
}

export const SUPPLY_ORDER_ATTACHMENT_DESCRIPTION = 'Supply Order';

/** General IR attachments (photos, evidence, etc.). */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20MB

/** Supply Order and Log Book Copy uploads. */
export const LARGE_DOCUMENT_MAX_BYTES = 300 * 1024 * 1024; // 300MB
export const SUPPLY_ORDER_MAX_BYTES = LARGE_DOCUMENT_MAX_BYTES;
export const LOG_BOOK_MAX_BYTES = LARGE_DOCUMENT_MAX_BYTES;

/** Display/input helper so NUMERIC values like 2.5000 show as 2.5. */
export function formatPart1Quantity(value: unknown): string {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return String(n);
}

export function isPositiveDecimalQty(value: string): boolean {
  const s = String(value || '').trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(s)) return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}
