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
  { value: 'project_director', label: 'Project Director (PD)' },
  { value: 'program_director', label: 'Program Director (PGD)' },
  { value: 'administrator', label: 'Administrator' },
];

const LEGACY_OS_DIRECTOR_ROLES: Record<string, string> = {
  os: 'OS & Director',
  director: 'OS & Director',
};

export const OS_DIRECTOR_DESIGNATION = 'OS & Director';

const OPTIONAL_DEPARTMENT_DESIGNATIONS = new Set(['PD', 'PGD']);
const OPTIONAL_DEPARTMENT_ROLES = new Set(['program_director', 'project_director']);

/** Normalise legacy `os` / `director` roles to the combined system role. */
export function normalizeSystemRole(role: string | null | undefined): string {
  if (role === 'os' || role === 'director') return 'os_director';
  return role || '';
}

/** OS & Director is the principal and is not assigned to a department. */
export function userOmitsDepartment(
  designation?: string | null,
  role?: string | null
): boolean {
  const des = String(designation || '').trim();
  if (des === OS_DIRECTOR_DESIGNATION) return true;
  return normalizeSystemRole(role) === 'os_director';
}

/** Program Director (PGD) / Project Director (PD) may leave department blank. */
export function departmentIsOptional(
  designation?: string | null,
  role?: string | null
): boolean {
  if (userOmitsDepartment(designation, role)) return true;
  const des = String(designation || '').trim();
  if (OPTIONAL_DEPARTMENT_DESIGNATIONS.has(des)) return true;
  return OPTIONAL_DEPARTMENT_ROLES.has(normalizeSystemRole(role));
}

export function formatSystemRoleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  if (LEGACY_OS_DIRECTOR_ROLES[role]) return LEGACY_OS_DIRECTOR_ROLES[role];
  return SYSTEM_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}
