export type ObservationPart = 'part4' | 'part5';

export interface ObservationRemarkWithChat {
  sl_no?: string;
  observation?: string;
  action_required?: string;
  closed_on?: string;
  signature?: string;
  chat_id?: string;
}

/** Roles that participate in Parts 1–5 and should see observation chats on the dashboard. */
export const OBSERVATION_CHAT_VIEW_ROLES = [
  'administrator',
  'initiator',
  'request_approver',
  'qa_approver',
  'qa_head',
  'inspector',
  'ordaqa_head',
  'ordaqa_inspector',
] as const;

export function roleCanViewObservationChats(role: string): boolean {
  return (OBSERVATION_CHAT_VIEW_ROLES as readonly string[]).includes(role);
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
