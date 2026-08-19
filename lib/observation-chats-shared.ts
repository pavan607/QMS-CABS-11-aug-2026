export type ObservationPart = 'part4' | 'part5';

export interface ObservationRemarkWithChat {
  sl_no?: string;
  observation?: string;
  action_required?: string;
  closed_on?: string;
  signature?: string;
  chat_id?: string;
}

/** Roles that can open Observation Chats (sidebar menu and chat pages). */
export const OBSERVATION_CHAT_VIEW_ROLES = [
  'administrator',
  'initiator',
  'request_approver',
  'qa_approver',
  'qa_head',
  'inspector',
  'ordaqa_head',
  'ordaqa_inspector',
  'os_director',
  'program_director',
  'project_director',
  'os',
  'director',
] as const;

function normalizeObservationChatRole(role: string): string {
  return role === 'os' || role === 'director' ? 'os_director' : role;
}

export function roleCanViewObservationChats(role: string): boolean {
  const normalized = normalizeObservationChatRole(role);
  return (OBSERVATION_CHAT_VIEW_ROLES as readonly string[]).includes(normalized);
}

/** Dashboard home banner — hidden for OS & Director (they still get the sidebar menu). */
export function roleCanSeeObservationChatBanner(role: string): boolean {
  const normalized = normalizeObservationChatRole(role);
  if (normalized === 'os_director' || normalized === 'program_director' || normalized === 'project_director') {
    return false;
  }
  return roleCanViewObservationChats(role);
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
