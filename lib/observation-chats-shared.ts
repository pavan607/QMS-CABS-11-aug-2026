export type ObservationPart = 'part4' | 'part5';

export interface ObservationRemarkWithChat {
  sl_no?: string;
  observation?: string;
  action_required?: string;
  closed_on?: string;
  signature?: string;
  chat_id?: string;
}

export function generateObservationChatId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function normalizeRemarkWithChatId<T extends Record<string, unknown>>(
  remark: T
): T & { chat_id: string } {
  const existing = remark.chat_id != null ? String(remark.chat_id).trim() : '';
  return {
    ...remark,
    chat_id: existing || generateObservationChatId(),
  };
}
