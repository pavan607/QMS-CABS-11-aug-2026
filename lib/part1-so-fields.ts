/** Client-safe Part I field 4 helpers (no Node/DB imports). */

export function parsePart1Bool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function isSupplyOrderAttachment(description?: string | null): boolean {
  return String(description || '')
    .toLowerCase()
    .includes('supply order');
}

export const SUPPLY_ORDER_ATTACHMENT_DESCRIPTION = 'Supply Order';
