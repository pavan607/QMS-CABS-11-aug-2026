'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, UserRole } from '@/lib/permissions';
import { employeeIsPart1Approver } from '@/lib/part1-approver';
import {
  canActAsNominatedRequestCertifier,
  canNominatedCertifierEditPart1,
  isDhInitiator,
} from '@/lib/request-certifier';

export function usePermissions() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as UserRole | undefined;
  const userId = parseInt((session?.user as any)?.id || '0');
  const employeeId = (session?.user as any)?.employee_id as string | undefined;
  const designation = (session?.user as any)?.designation as string | undefined;

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
  /** Fixed Part I approver (employee 1021) — acts after Request Approver forward. */
  const isPart1Approver = () => employeeIsPart1Approver(employeeId) || userRole === 'administrator';
  const isInspector = () => userRole === 'inspector' || userRole === 'ordaqa_inspector';
  const isInitiator = () => userRole === 'initiator';
  const isDhInitiatorDesigner = () => isDhInitiator(userRole, designation);
  /** Field-21 nominated certifier may forward/reject (Request Approver or DH + Initiator/Designer). */
  const canActAsRequestCertifier = (ir: {
    nominated_request_approver_id?: number | null;
  }) => canActAsNominatedRequestCertifier(userId, userRole, designation, ir);
  /** Nominated certifier may edit Part I while awaiting forward to 1021. */
  const canEditPart1AsCertifier = (ir: {
    nominated_request_approver_id?: number | null;
    status?: string | null;
  }) => canNominatedCertifierEditPart1(userId, userRole, designation, ir);

  return {
    userRole,
    userId,
    employeeId,
    designation,
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
    isPart1Approver,
    isInspector,
    isInitiator,
    isDhInitiatorDesigner,
    canActAsRequestCertifier,
    canEditPart1AsCertifier,
  };
}
