/** Field 21 — Designer DH/GD/TH (certifier) eligibility and Part I edit/forward rules. */

export const DH_DESIGNATION = 'DH';

/** Division Head designation (case-insensitive). */
export function isDhDesignation(designation?: string | null): boolean {
  return String(designation || '').trim().toUpperCase() === DH_DESIGNATION;
}

/** System role Initiator/Designer with designation DH. */
export function isDhInitiator(
  role?: string | null,
  designation?: string | null
): boolean {
  return String(role || '') === 'initiator' && isDhDesignation(designation);
}

/**
 * SQL predicate for users alias `u` who may be selected on field 21:
 * Request Approver role, or Initiator/Designer with designation DH.
 */
export const SQL_FIELD21_CERTIFIER_ELIGIBLE = `(
  u.role = 'request_approver'
  OR (
    u.role = 'initiator'
    AND UPPER(TRIM(COALESCE(u.designation, ''))) = '${DH_DESIGNATION}'
  )
)`;

export function sqlUserIsEligibleField21Certifier(userIdPlaceholder: string): string {
  return `EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = ${userIdPlaceholder}
      AND COALESCE(u.status, 'active') = 'active'
      AND ${SQL_FIELD21_CERTIFIER_ELIGIBLE}
  )`;
}

/** Whether the actor may forward / reject / send-back on the Request Approver queue. */
export function canActAsNominatedRequestCertifier(
  userId: number,
  userRole: string | null | undefined,
  designation: string | null | undefined,
  ir: { nominated_request_approver_id?: number | null | unknown }
): boolean {
  if (userRole === 'administrator') return true;

  const nominated =
    ir.nominated_request_approver_id != null
      ? Number(ir.nominated_request_approver_id)
      : null;
  const isNominated =
    nominated != null && Number.isFinite(nominated) && nominated > 0 && nominated === userId;

  if (nominated != null && Number.isFinite(nominated) && nominated > 0 && nominated !== userId) {
    return false;
  }

  if (userRole === 'request_approver') return true;

  // DH + Initiator/Designer may act only when selected on field 21
  if (isDhInitiator(userRole, designation)) return isNominated;

  return false;
}

const PART1_CERTIFIER_EDIT_STATUSES = ['pending', 'pending_request_approval'] as const;

/**
 * Nominated field-21 certifier (Request Approver, or DH Initiator/Designer)
 * may edit Part I while the IR awaits their forward to 1021.
 */
export function canNominatedCertifierEditPart1(
  userId: number,
  userRole: string | null | undefined,
  designation: string | null | undefined,
  ir: {
    nominated_request_approver_id?: number | null | unknown;
    status?: string | null;
  }
): boolean {
  if (userRole === 'administrator') {
    return PART1_CERTIFIER_EDIT_STATUSES.includes(
      (ir.status || '') as (typeof PART1_CERTIFIER_EDIT_STATUSES)[number]
    );
  }

  if (
    !PART1_CERTIFIER_EDIT_STATUSES.includes(
      (ir.status || '') as (typeof PART1_CERTIFIER_EDIT_STATUSES)[number]
    )
  ) {
    return false;
  }

  const nominated =
    ir.nominated_request_approver_id != null
      ? Number(ir.nominated_request_approver_id)
      : null;
  if (nominated !== userId) return false;

  return userRole === 'request_approver' || isDhInitiator(userRole, designation);
}
