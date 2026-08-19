'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { canUserUpdatePart4, canUserApprovePart4, canUserApproveOrdqaPart5, canUserFillPart2OutstationDetails, inspectionSkipsPart2Part3, memoReturnedAwaitingQaHead, ordaqaHeadPart3ActionRequired, ordaqaHeadReforwardActionRequired, resolveInspectionCustody, formatInspectionCustodyLine, formatCalendarDateDisplay, teamHeadQaNeedsInspectorAssignment, inspectionReadyForFinalTeamHeadApproval, userHasPart5ActionRequired, resolveInspectionRejection } from '@/lib/inspection-display';
import { 
  Plus, Search, FileText,
  Calendar, MapPin, User, Paperclip, AlertCircle, Edit,
} from 'lucide-react';

const fmtDate = (val: any): string => formatCalendarDateDisplay(val);

interface InspectionRequest {
  id: number;
  request_number: string;
  title: string;
  description: string;
  location: string;
  item: string;
  inspection_type: string;
  status: string;
  due_date: string;
  initiator_id?: number | null;
  initiator_name: string;
  inspector_name?: string;
  inspector_names?: string | null;
  inspector_id?: number;
  inspector_ids?: unknown;
  nominated_request_approver_id?: number | null;
  nominated_team_head_id?: number;
  qa_approver_id?: number;
  request_approver_id?: number | null;
  request_approver_name?: string | null;
  nominated_request_approver_name?: string | null;
  part1_approver_name?: string | null;
  part1_approved_by_name?: string | null;
  qa_approver_name?: string | null;
  qa_head_names?: string | null;
  nominated_team_head_name?: string | null;
  ordaqa_inspector_name?: string | null;
  ordaqa_head_names?: string | null;
  part3_completed_by_name?: string | null;
  ordaqa_approver_name?: string | null;
  final_qa_approver_name?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  programme_name?: string | null;
  forwarded_to_ordaqa?: boolean | null;
  ordaqa_inspector_id?: number | null;
  ordaqa_approver_id?: number | null;
  part2_data?: unknown;
  part3_data?: unknown;
  part4_data?: unknown;
  has_memo_return_activity?: boolean | null;
  attachment_count: number;
  created_at: string;
  confirmations?: unknown;
  so_involves_rqa?: unknown;
  so_involves_dgaqa?: unknown;
  rejection_reason?: string | null;
}

const ACTIONABLE_STATUSES: Record<string, string[]> = {
  administrator: ['pending_request_approval', 'pending', 'pending_part1_approval', 'request_approved', 'assigned', 'in_progress', 'inspection_completed'],
  qa_head: ['request_approved', 'assigned', 'in_progress', 'inspection_completed'],
  qa_approver: ['request_approved', 'assigned', 'in_progress', 'inspection_completed'],
  request_approver: ['pending_request_approval', 'pending'],
  initiator: ['pending', 'draft', 'returned_to_designer'],
  ordaqa_head: ['request_approved', 'assigned', 'in_progress', 'inspection_completed'],
  ordaqa_inspector: ['assigned', 'in_progress', 'inspection_completed'],
  inspector: ['request_approved', 'assigned', 'in_progress', 'inspection_completed'],
};

export default function InspectionsPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-muted-foreground">Loading...</div>}>
      <InspectionsContent />
    </Suspense>
  );
}

function InspectionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReviewMode = searchParams.get('action') === 'review';
  const highlightMode = searchParams.get('highlight') || '';
  const hasHighlight = isReviewMode || !!highlightMode;
  const permissions = usePermissions();
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const fetchRequests = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/inspection-requests?${params}`);
      const data = await response.json();
      
      if (data.requests) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      pending_request_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
      pending_part1_approval: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
      request_approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
      assigned: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
      in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
      inspection_completed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300',
      pending_qa_approval: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
      pending_ordaqa_approval: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300', // legacy
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      closed: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
      returned_to_designer: 'bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200',
    };
    const labels: Record<string, string> = {
      pending_request_approval: 'PENDING PART-1 APPROVAL',
      pending_part1_approval: 'PENDING FORWARD',
      request_approved: 'FORWARDED',
      inspection_completed: 'INSPECTION DONE',
      pending_qa_approval: 'PENDING QA',
      pending_ordaqa_approval: 'PENDING APPROVAL',
      returned_to_designer: 'RETURNED TO DESIGNER',
    };

    return (
      <Badge className={colors[status] || colors.pending}>
        {labels[status] || status.replace(/_/g, ' ').toUpperCase()}
      </Badge>
    );
  };

  const isActionable = (request: InspectionRequest): boolean => {
    const role = permissions.userRole;
    if (!role) return false;
    if (permissions.isPart1Approver() && request.status === 'pending_part1_approval') return true;
    if (
      permissions.canActAsRequestCertifier(request) &&
      ['pending_request_approval', 'pending'].includes(request.status)
    ) {
      return true;
    }
    if (role === 'administrator') {
      return !['completed', 'closed', 'rejected'].includes(request.status);
    }
    if (role === 'qa_head') {
      if (memoReturnedAwaitingQaHead(request)) return true;
      if (request.status === 'request_approved' && !request.nominated_team_head_id) return true;
      if (['assigned', 'in_progress', 'inspection_completed'].includes(request.status)) return true;
      return false;
    }
    if (request.nominated_team_head_id === permissions.userId) {
      if (teamHeadQaNeedsInspectorAssignment(request)) return true;
      if (canUserApprovePart4(request, permissions.userId, role)) return true;
      if (inspectionReadyForFinalTeamHeadApproval(request)) return true;
      return false;
    }
    if (role === 'qa_approver') {
      if (canUserApprovePart4(request, permissions.userId, role)) return true;
      if (inspectionSkipsPart2Part3(request)) {
        return ['assigned', 'in_progress', 'inspection_completed'].includes(request.status);
      }
      return false;
    }
    if (role === 'inspector') {
      return (
        canUserFillPart2OutstationDetails(request, permissions.userId, role) ||
        canUserUpdatePart4(request, permissions.userId, role) ||
        userHasPart5ActionRequired(request, permissions.userId, role)
      );
    }
    if (role === 'ordaqa_inspector') {
      return userHasPart5ActionRequired(request, permissions.userId, role);
    }
    if (role === 'ordaqa_head') {
      // Review mode: all Part III actions (new + re-forwarded)
      return ordaqaHeadPart3ActionRequired(request);
    }
    const statuses = ACTIONABLE_STATUSES[role];
    return statuses ? statuses.includes(request.status) : false;
  };

  const shouldHighlight = (request: InspectionRequest): boolean => {
    if (isReviewMode) return isActionable(request);
    if (!highlightMode) return false;
    switch (highlightMode) {
      case 'action': return isActionable(request);
      case 'overdue': return !!request.due_date && new Date(request.due_date) < new Date() && !['completed', 'closed', 'rejected'].includes(request.status);
      case 'pending_forward':
        if (permissions.userRole === 'qa_head') {
          return (
            memoReturnedAwaitingQaHead(request) ||
            (request.status === 'request_approved' && !request.nominated_team_head_id)
          );
        }
        if (permissions.userRole === 'qa_approver') {
          return (
            request.nominated_team_head_id === permissions.userId &&
            teamHeadQaNeedsInspectorAssignment(request)
          );
        }
        return ['pending_request_approval', 'pending'].includes(request.status);
      case 'pending_part1': return request.status === 'pending_part1_approval';
      case 'needs_assignment':
        if (permissions.userRole === 'qa_approver') {
          return (
            request.nominated_team_head_id === permissions.userId &&
            teamHeadQaNeedsInspectorAssignment(request)
          );
        }
        return request.status === 'request_approved';
      case 'assigned': return request.status === 'assigned';
      case 'in_progress': return request.status === 'in_progress';
      case 'drafts': return ['draft', 'pending'].includes(request.status);
      case 'pending': return ['pending', 'pending_request_approval'].includes(request.status);
      case 'returned_to_designer': return request.status === 'returned_to_designer';
      case 'pending_part4':
        return (
          permissions.userRole === 'inspector' &&
          canUserUpdatePart4(request, permissions.userId, permissions.userRole)
        );
      case 'pending_outstation':
        return (
          permissions.userRole === 'inspector' &&
          canUserFillPart2OutstationDetails(request, permissions.userId, permissions.userRole)
        );
      case 'pending_part4_approval':
        return (
          permissions.userRole === 'qa_approver' &&
          canUserApprovePart4(request, permissions.userId, permissions.userRole)
        );
      case 'pending_part5':
        return (
          (permissions.userRole === 'ordaqa_inspector' || permissions.userRole === 'inspector') &&
          userHasPart5ActionRequired(request, permissions.userId, permissions.userRole)
        );
      case 'pending_part5_approval':
        return (
          (permissions.userRole === 'ordaqa_head' || permissions.isAdmin()) &&
          canUserApproveOrdqaPart5(request, permissions.userRole)
        );
      case 'pending_part3':
        return (
          permissions.userRole === 'ordaqa_head' &&
          ordaqaHeadPart3ActionRequired(request) &&
          !ordaqaHeadReforwardActionRequired(request)
        );
      case 'reforwarded':
        return (
          permissions.userRole === 'ordaqa_head' &&
          ordaqaHeadReforwardActionRequired(request)
        );
      default: return false;
    }
  };

  const HIGHLIGHT_LABELS: Record<string, string> = {
    action: 'Needs Action',
    overdue: 'Overdue Inspections',
    pending_forward: 'Pending Forward',
    pending_part1: 'Pending Forward',
    needs_assignment: 'Needs Assignment',
    assigned: 'Assigned to You',
    in_progress: 'In Progress',
    drafts: 'Drafts',
    pending: 'Pending',
    returned_to_designer: 'Returned to Designer',
    pending_part4: 'Part IV Pending',
    pending_outstation: 'Outstation Details Pending',
    pending_part4_approval: 'Part IV Awaiting Team Head Approval',
    pending_part5: 'Part V Pending',
    pending_part5_approval: 'Part V Awaiting ORDAQA Head Approval',
    pending_part3: 'Part III Pending (new forward)',
    reforwarded: 'Re-forwarded by QA Head',
  };

  const filteredRequests = requests
    .filter(request =>
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.request_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (hasHighlight) {
        const aAct = shouldHighlight(a) ? 0 : 1;
        const bAct = shouldHighlight(b) ? 0 : 1;
        if (aAct !== bAct) return aAct - bAct;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const highlightedCount = hasHighlight ? filteredRequests.filter(r => shouldHighlight(r)).length : 0;

  return (
    <div className="space-y-6">
      {/* Highlight Mode Banner */}
      {hasHighlight && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {HIGHLIGHT_LABELS[highlightMode] || 'Review Mode'} — {highlightedCount} item{highlightedCount !== 1 ? 's' : ''} highlighted
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Matching requests are highlighted and sorted to the top</p>
          </div>
          <Link href="/dashboard/inspections">
            <Button variant="outline" size="sm" className="text-xs border-amber-300 dark:border-amber-700">Clear Filter</Button>
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inspection Requests</h2>
          <p className="text-base text-muted-foreground">
            Manage and track all inspection requests
          </p>
        </div>
        
        {permissions.canCreate('inspection_request') && (
          <Link href="/dashboard/inspections/new">
            <Button className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white gap-2">
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-input bg-background"
              >
                <option value="all">All Status</option>
                <option value="pending">Draft / Pending</option>
                <option value="pending_request_approval">Pending Part-1 Approval</option>
                <option value="pending_part1_approval">Pending Forward</option>
                <option value="request_approved">Forwarded</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="inspection_completed">Inspection Done</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="returned_to_designer">Returned to designer</option>
              </select>

            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading requests...</p>
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No inspection requests found</p>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Try adjusting your search or filters' : 'Create your first inspection request to get started'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => {
            const actionable =
              shouldHighlight(request) || isActionable(request);
            return (
            <Card key={request.id} className={`hover:shadow-md transition-shadow ${actionable ? 'border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/10' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold">{request.title}</h3>
                          {getStatusBadge(request.status)}
                          {actionable && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        {(() => {
                          const custody = resolveInspectionCustody(request);
                          return (
                            <p className="text-xs text-muted-foreground mb-1">
                              {custody.stage === 'Completed' ? (
                                <span>
                                  <span className="font-medium text-foreground">Inspection Request completed</span>
                                  {' · '}
                                  Final approved by:{' '}
                                  <span className="font-medium text-foreground">{custody.name || '—'}</span>
                                </span>
                              ) : custody.stage === 'Rejected' ? (
                                <span className="font-medium text-foreground">
                                  {formatInspectionCustodyLine(custody)}
                                </span>
                              ) : (
                                <>
                                  Currently with:{' '}
                                  <span className="font-medium text-foreground">
                                    {custody.name ? `${custody.name} (${custody.role})` : custody.role}
                                  </span>
                                  {' · '}
                                  <span className="font-medium text-foreground">{custody.stage}</span>
                                  {' — '}
                                  {custody.action}
                                </>
                              )}
                            </p>
                          );
                        })()}
                        {(() => {
                          const st = String(request.status || '');
                          const approvedByName = request.request_approver_name?.trim() || null;
                          const forwardedByName = request.part1_approved_by_name?.trim() || null;
                          const reachedPart1Queue =
                            Boolean(approvedByName) ||
                            Boolean(forwardedByName) ||
                            Boolean(request.nominated_request_approver_name?.trim()) ||
                            st === 'pending_part1_approval' ||
                            !['pending', 'draft', 'pending_request_approval', 'rejected'].includes(st);
                          if (!reachedPart1Queue && st !== 'pending_request_approval') return null;
                          const pendingForward = st === 'pending_part1_approval';
                          return (
                            <p className="text-xs text-muted-foreground mb-2">
                              Part I Approved by:{' '}
                              <span className="font-medium text-foreground">
                                {approvedByName || '—'}
                              </span>
                              {' · '}
                              Part I forwarded by:{' '}
                              <span className="font-medium text-foreground">
                                {forwardedByName || (pendingForward ? 'Pending' : '—')}
                              </span>
                            </p>
                          );
                        })()}
                        
                        {(() => {
                          const rejection = resolveInspectionRejection(request);
                          if (!rejection || String(request.status || '') !== 'rejected') return null;
                          return (
                            <div className="mb-3 rounded-md border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">
                              <p className="font-medium">{rejection.byLabel}</p>
                              {rejection.reason ? (
                                <p className="mt-1 whitespace-pre-wrap text-red-900/90 dark:text-red-200/90">
                                  {rejection.reason}
                                </p>
                              ) : null}
                            </div>
                          );
                        })()}

                        <p className="text-sm text-muted-foreground mb-3">
                          {request.description || 'No description provided'}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{request.request_number}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{request.location}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{request.inspector_names || request.inspector_name || 'Unassigned'}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Due: {fmtDate(request.due_date)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            <span>{request.attachment_count} attachments</span>
                          </div>
                          <span>Created {fmtDate(request.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(((request.initiator_id != null &&
                          Number(request.initiator_id) === permissions.userId) ||
                          permissions.isAdmin()) &&
                          ['pending', 'draft', 'returned_to_designer'].includes(request.status)) ||
                          permissions.canEditPart1AsCertifier(request) ? (
                          <Button variant="default" size="sm" asChild>
                            <Link href={`/dashboard/inspections/new?edit=${request.id}`}>
                              <Edit className="mr-1.5 h-3.5 w-3.5" />
                              Edit Part I
                            </Link>
                          </Button>
                        ) : null}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/dashboard/inspections/${request.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

