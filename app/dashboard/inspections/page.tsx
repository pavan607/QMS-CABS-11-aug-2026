'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { inspectionSkipsPart2Part3 } from '@/lib/inspection-display';
import { 
  Plus, Search, FileText,
  Calendar, MapPin, User, Paperclip, AlertCircle,
} from 'lucide-react';
import { formatCalendarDateDisplay } from '@/lib/inspection-display';

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
  initiator_name: string;
  inspector_name?: string;
  inspector_names?: string | null;
  inspector_id?: number;
  nominated_team_head_id?: number;
  qa_approver_id?: number;
  attachment_count: number;
  created_at: string;
  confirmations?: unknown;
}

const ACTIONABLE_STATUSES: Record<string, string[]> = {
  administrator: ['pending_request_approval', 'pending', 'request_approved', 'assigned', 'in_progress', 'inspection_completed'],
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
      pending_request_approval: 'PENDING FORWARD',
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
    if (role === 'administrator') {
      return !['completed', 'closed', 'rejected'].includes(request.status);
    }
    if (role === 'qa_head') {
      if (request.status === 'request_approved' && !request.nominated_team_head_id) return true;
      if (['assigned', 'in_progress', 'inspection_completed'].includes(request.status)) return true;
      return false;
    }
    if (request.nominated_team_head_id === permissions.userId) {
      if (request.status === 'request_approved' && !request.inspector_id) return true;
      if (['assigned', 'in_progress', 'inspection_completed'].includes(request.status)) return true;
      return false;
    }
    if (role === 'qa_approver') {
      if (inspectionSkipsPart2Part3(request)) {
        return ['assigned', 'in_progress', 'inspection_completed'].includes(request.status);
      }
      return false;
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
      case 'pending_forward': return ['pending_request_approval', 'pending'].includes(request.status);
      case 'needs_assignment': return request.status === 'request_approved';
      case 'assigned': return request.status === 'assigned';
      case 'in_progress': return request.status === 'in_progress';
      case 'drafts': return ['draft', 'pending'].includes(request.status);
      case 'pending': return ['pending', 'pending_request_approval'].includes(request.status);
      default: return false;
    }
  };

  const HIGHLIGHT_LABELS: Record<string, string> = {
    action: 'Needs Action',
    overdue: 'Overdue Inspections',
    pending_forward: 'Pending Forward',
    needs_assignment: 'Needs Assignment',
    assigned: 'Assigned to You',
    in_progress: 'In Progress',
    drafts: 'Drafts',
    pending: 'Pending',
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
                <option value="pending_request_approval">Pending Forward</option>
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
            const actionable = shouldHighlight(request);
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

                      <div className="flex gap-2">
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

