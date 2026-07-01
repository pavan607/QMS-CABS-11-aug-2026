import type { UserRole } from '@/lib/permissions';

/** Options for System role dropdowns (Users, Profile). */
export const SYSTEM_ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'initiator', label: 'Initiator / Designer' },
  { value: 'inspector', label: 'Inspector / QA Rep' },
  { value: 'request_approver', label: 'Request Approver' },
  { value: 'qa_approver', label: 'Team Head - QA' },
  { value: 'qa_head', label: 'QA Head' },
  { value: 'ordaqa_head', label: 'ORDAQA Head' },
  { value: 'ordaqa_inspector', label: 'Inspector / ORDAQA Rep' },
  { value: 'os_director', label: 'OS & Director' },
  { value: 'administrator', label: 'Administrator' },
];

const LEGACY_OS_DIRECTOR_ROLES: Record<string, string> = {
  os: 'OS & Director',
  director: 'OS & Director',
};

export function formatSystemRoleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  if (LEGACY_OS_DIRECTOR_ROLES[role]) return LEGACY_OS_DIRECTOR_ROLES[role];
  return SYSTEM_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

/** Normalise legacy `os` / `director` roles to the combined system role. */
export function normalizeSystemRole(role: string | null | undefined): string {
  if (role === 'os' || role === 'director') return 'os_director';
  return role || '';
}
