'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, UserRole } from '@/lib/permissions';

export function usePermissions() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as UserRole | undefined;
  const userId = parseInt((session?.user as any)?.id || '0');

  const checkPermission = (resource: string, action: string): boolean => {
    if (!userRole) return false;
    return hasPermission(userRole, resource, action);
  };

  const canCreate = (resource: string) => checkPermission(resource, 'create');
  const canRead = (resource: string) => checkPermission(resource, 'read');
  const canUpdate = (resource: string) => checkPermission(resource, 'update');
  const canDelete = (resource: string) => checkPermission(resource, 'delete');
  const canApprove = (resource: string) => checkPermission(resource, 'approve');
  const canReject = (resource: string) => checkPermission(resource, 'reject');
  const canClose = (resource: string) => checkPermission(resource, 'close');
  const canAssign = (resource: string) => checkPermission(resource, 'assign');

  const isRole = (role: UserRole) => userRole === role;
  const isAdmin = () => userRole === 'administrator';
  const isApprover = () => userRole === 'qa_approver' || userRole === 'request_approver' || userRole === 'qa_head' || userRole === 'ordaqa_head';
  const isQaApprover = () => userRole === 'qa_approver' || userRole === 'qa_head';
  const isQaHead = () => userRole === 'qa_head';
  const isOrdaqaHead = () => userRole === 'ordaqa_head';
  const isOrdaqaInspector = () => userRole === 'ordaqa_inspector';
  const isRequestApprover = () => userRole === 'request_approver';
  const isInspector = () => userRole === 'inspector' || userRole === 'ordaqa_inspector';
  const isInitiator = () => userRole === 'initiator';

  return {
    userRole,
    userId,
    checkPermission,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canApprove,
    canReject,
    canClose,
    canAssign,
    isRole,
    isAdmin,
    isApprover,
    isQaApprover,
    isQaHead,
    isOrdaqaHead,
    isOrdaqaInspector,
    isRequestApprover,
    isInspector,
    isInitiator,
  };
}

