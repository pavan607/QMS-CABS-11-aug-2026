/** Browser-only Part I form backup — no database record until submit. */

export type Part1FormDraft = {
  savedAt: string;
  form: Record<string, unknown>;
};

function storageKey(userId: number | string) {
  return `qms-part1-draft-v1-${userId}`;
}

export function savePart1FormDraftLocal(userId: number | string, form: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: Part1FormDraft = { savedAt: new Date().toISOString(), form };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not save Part I draft locally:', e);
  }
}

export function loadPart1FormDraftLocal(userId: number | string): Part1FormDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Part1FormDraft;
    if (!parsed?.form || typeof parsed.form !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPart1FormDraftLocal(userId: number | string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}
