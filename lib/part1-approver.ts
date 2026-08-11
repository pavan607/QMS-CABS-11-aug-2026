import { normalizeEmployeeId } from '@/lib/employee-id';

/** Fixed Part I approver (employee id). */
export const PART1_APPROVER_EMPLOYEE_ID = '1021';

/** Whether this employee id is the fixed Part I approver. */
export function employeeIsPart1Approver(employeeId?: string | number | null): boolean {
  if (employeeId == null || employeeId === '') return false;
  return normalizeEmployeeId(String(employeeId)) === normalizeEmployeeId(PART1_APPROVER_EMPLOYEE_ID);
}
