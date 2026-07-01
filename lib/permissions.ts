// Role-Based Access Control (RBAC) system

export type UserRole =
  | 'initiator'
  | 'inspector'
  | 'request_approver'
  | 'qa_approver'
  | 'qa_head'
  | 'ordaqa_head'
  | 'ordaqa_inspector'
  | 'os_director'
  | 'administrator';

export interface Permission {
  resource: string;
  actions: string[];
}

// Define permissions for each role
export const rolePermissions: Record<UserRole, Permission[]> = {
  initiator: [
    { resource: 'inspection_request', actions: ['create', 'read', 'update_own'] },
    { resource: 'checklist', actions: ['read'] }, // Can VIEW but NOT create/update
    { resource: 'checklist_item', actions: ['read'] }, // Can VIEW but NOT create/update
    { resource: 'quality_check', actions: ['read'] }, // Can VIEW but NOT create/update
    { resource: 'attachment', actions: ['create', 'read', 'delete_own'] },
    { resource: 'document', actions: ['read'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  inspector: [
    { resource: 'inspection_request', actions: ['read', 'update_assigned'] },
    { resource: 'checklist', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'checklist_item', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'quality_check', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'attachment', actions: ['create', 'read', 'delete_own'] },
    { resource: 'inspection_activity', actions: ['create', 'read'] },
    { resource: 'document', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  request_approver: [
    { resource: 'inspection_request', actions: ['read', 'assign', 'approve', 'reject', 'close'] },
    { resource: 'checklist', actions: ['read'] },
    { resource: 'checklist_item', actions: ['read'] },
    { resource: 'quality_check', actions: ['read'] },
    { resource: 'attachment', actions: ['read'] },
    { resource: 'document', actions: ['read'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'user', actions: ['read'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  qa_approver: [
    { resource: 'inspection_request', actions: ['read', 'assign', 'approve', 'reject', 'close'] },
    { resource: 'quality_check', actions: ['create', 'read', 'update', 'assign'] },
    { resource: 'checklist', actions: ['read'] },
    { resource: 'checklist_item', actions: ['read'] },
    { resource: 'attachment', actions: ['read'] },
    { resource: 'document', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'user', actions: ['read'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  qa_head: [
    { resource: 'inspection_request', actions: ['read', 'assign', 'approve', 'reject', 'close'] },
    { resource: 'quality_check', actions: ['create', 'read', 'update', 'assign'] },
    { resource: 'checklist', actions: ['read'] },
    { resource: 'checklist_item', actions: ['read'] },
    { resource: 'attachment', actions: ['read'] },
    { resource: 'document', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'user', actions: ['read'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  ordaqa_head: [
    { resource: 'inspection_request', actions: ['read', 'assign', 'approve', 'reject', 'close'] },
    { resource: 'quality_check', actions: ['create', 'read', 'update', 'assign'] },
    { resource: 'checklist', actions: ['read'] },
    { resource: 'checklist_item', actions: ['read'] },
    { resource: 'attachment', actions: ['read'] },
    { resource: 'document', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'user', actions: ['read'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  ordaqa_inspector: [
    { resource: 'inspection_request', actions: ['read', 'update_assigned'] },
    { resource: 'checklist', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'checklist_item', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'quality_check', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'attachment', actions: ['create', 'read', 'delete_own'] },
    { resource: 'inspection_activity', actions: ['create', 'read'] },
    { resource: 'document', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  os_director: [
    { resource: 'inspection_request', actions: ['read', 'assign', 'approve', 'reject', 'close'] },
    { resource: 'quality_check', actions: ['read'] },
    { resource: 'checklist', actions: ['read'] },
    { resource: 'checklist_item', actions: ['read'] },
    { resource: 'attachment', actions: ['read'] },
    { resource: 'document', actions: ['read'] },
    { resource: 'report', actions: ['create', 'read', 'export'] },
    { resource: 'user', actions: ['read'] },
    { resource: 'notification', actions: ['read', 'update_own'] },
    { resource: 'profile', actions: ['read', 'update_own'] },
  ],
  administrator: [
    { resource: '*', actions: ['*'] }, // Full access to all resources
  ],
};

/**
 * Check if a user role has permission to perform an action on a resource
 */
function effectiveUserRole(userRole: UserRole | string): UserRole {
  if (userRole === 'os' || userRole === 'director') return 'os_director';
  return userRole as UserRole;
}

export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: string
): boolean {
  const role = effectiveUserRole(userRole);
  const permissions = rolePermissions[role] || [];

  // Administrator has full access
  if (role === 'administrator') {
    return true;
  }

  // Check if role has permission for the specific resource and action
  return permissions.some(
    (p) =>
      (p.resource === resource || p.resource === '*') &&
      (p.actions.includes(action) || p.actions.includes('*'))
  );
}

/**
 * Check if a user can update a specific inspection request
 */
export function canUpdateInspectionRequest(
  userRole: UserRole,
  userId: number,
  request: { initiator_id?: number; inspector_id?: number; status?: string }
): boolean {
  // Administrator can update any request
  if (userRole === 'administrator') {
    return true;
  }

  // Part I author (user who created the request) can update in these statuses, regardless of current role name
  if (
    request.initiator_id === userId &&
    ['pending', 'draft', 'returned_to_designer', 'pending_request_approval'].includes(request.status || '')
  ) {
    return true;
  }

  // Inspector can update assigned requests that are not completed/approved/rejected
  if (
    userRole === 'inspector' &&
    request.inspector_id === userId &&
    ['assigned', 'in_progress'].includes(request.status || '')
  ) {
    return true;
  }

  return false;
}

/**
 * Check if a user can delete a resource they own
 */
export function canDeleteOwn(
  userRole: UserRole,
  userId: number,
  resourceOwnerId: number
): boolean {
  if (userRole === 'administrator') {
    return true;
  }

  return userId === resourceOwnerId;
}

/**
 * Get allowed status transitions based on user role
 */
export function getAllowedStatusTransitions(
  userRole: UserRole,
  currentStatus: string
): string[] {
  const transitions: Record<string, Record<string, string[]>> = {
    initiator: {
      pending: ['pending'], // Can only update details, not change status
    },
    inspector: {
      assigned: ['in_progress'],
      in_progress: ['completed'],
    },
    request_approver: {
      completed: ['approved', 'rejected'],
      approved: ['closed'],
    },
    qa_approver: {
      completed: ['approved', 'rejected'],
      approved: ['closed'],
    },
    qa_head: {
      completed: ['approved', 'rejected'],
      approved: ['closed'],
    },
    ordaqa_head: {
      completed: ['approved', 'rejected'],
      approved: ['closed'],
    },
    os_director: {
      completed: ['approved', 'rejected'],
      approved: ['closed'],
    },
    ordaqa_inspector: {
      assigned: ['in_progress'],
      in_progress: ['completed'],
    },
    administrator: {
      pending: ['assigned', 'in_progress', 'completed', 'approved', 'rejected'],
      assigned: ['pending', 'in_progress', 'completed', 'approved', 'rejected'],
      in_progress: ['assigned', 'completed', 'approved', 'rejected'],
      completed: ['in_progress', 'approved', 'rejected'],
      approved: ['pending', 'assigned', 'in_progress', 'completed', 'rejected', 'closed'],
      rejected: ['pending', 'assigned', 'in_progress', 'completed', 'approved'],
      closed: [], // Closed is final - no transitions allowed
    },
  };

  return transitions[effectiveUserRole(userRole)]?.[currentStatus] || [];
}

