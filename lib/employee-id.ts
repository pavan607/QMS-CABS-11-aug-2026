/** Normalize employee id for login and DB lookups (trim + uppercase). */
export function normalizeEmployeeId(raw: string): string {
  return raw.trim().toUpperCase();
}
