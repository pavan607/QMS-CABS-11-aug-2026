'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Calendar, MapPin, User, FileText, Paperclip,
  Clock, CheckCircle, XCircle, AlertCircle, Upload, Download,
  Plus, Edit, Trash2, Activity as ActivityIcon, Minus, Eye,
  MoreVertical, Printer, X, RotateCcw,
} from 'lucide-react';
import {
  ObservationChatActions,
  useObservationThreadStatus,
  type ObservationRemarkRow,
} from '@/components/observation-chat-actions';
import { normalizeRemarkWithChatId } from '@/lib/observation-chats-shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { CalendarDateInput } from '@/components/calendar-date-input';
import { DateTimeLocalInput } from '@/components/datetime-local-input';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useSession } from 'next-auth/react';
import {
  formatItemPertainsToToken,
  formatTestTypeToken,
  formatReceivedDateTimeDisplay,
  formatCalendarDateDisplay,
  formatDateTimeDisplay,
  formatSourceLabel,
  getLocalDateTimeNow,
  toDateOnlyYmd,
  parseYmdLocal,
  ordaqaRepReportDisplay,
  effectiveOrdqaPart5Data,
  inspectionRequiresOrdqaPart5,
  inspectionReportsReadyForTeamHead,
  inspectionPart4Saved,
  canUserUpdatePart4,
  canUserStartInspection,
  canUserCompleteInspection,
  canUserApproveOrdqaPart5,
  canUserOrdqaHeadPart5SendBack,
  canUserUpdatePart5,
  canUserApprovePart4,
  canUserRejectPart4,
  canUserTeamHeadEditPart4,
  part4PendingTeamHeadApproval,
  part4ApprovedByTeamHead,
  part4RejectedByTeamHead,
  getPart4TeamHeadRejectComment,
  ordqaPart5Submitted,
  ordqaPart5Approved,
  ordqaPart5Completed,
  ordqaPart5ReturnedToInspector,
  getPart5HeadSendBackComment,
  isForwardedToOrdqa,
  part3Section23HasSavedData,
  part3CompleteForOrdqaWorkflow,
  part4BlockedByPart3,
  canEditPart3Section23,
  formatInspectionStageItemLabel,
  parsePreviousStageCleared,
  formatAssignedInspectorsDisplay,
  resolveAssignedInspectorsForDisplay,
  resolvePart4TeamHeadSignoff,
  isUserAssignedPart2Inspector,
  inspectionSkipsPart2Part3,
  inspectionUsesLegacyOpenRqaPart4,
  jointInspectionRequestedInPart1,
  canUserQaApproverApproveAndClose,
  canUserQaApproverReject,
  canUserQaApproverRejectDuringPart2,
  canUserQaApproverSendBack,
  inspectionReadyForFinalTeamHeadApproval,
  memoReturnedAwaitingQaHead,
  ordaqaHeadReforwardActionRequired,
  resolveInspectionCustody,
  formatInspectionCustodyLine,
} from '@/lib/inspection-display';
import {
  parsePart1CertifierEditSummary,
  type Part1FieldChange,
} from '@/lib/part1-field-diff';
import {
  shouldHighlightInspectorName,
  resolveStartCompleteInspectorName,
} from '@/lib/report-inspector-display';

/** Highlight + previous value for Part I rows edited by nominated Request Approver / DH. */
function Part1RowEditNote({ changes }: { changes: Part1FieldChange[] }) {
  if (!changes.length) return null;
  return (
    <div className="mt-1.5 rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-semibold text-[11px] uppercase tracking-wide text-amber-800 dark:text-amber-300 mb-1">
        Updated by Request Approver
      </p>
      <ul className="space-y-0.5">
        {changes.map((c) => (
          <li key={c.key}>
            {changes.length > 1 && <span className="font-medium">{c.label}: </span>}
            <span className="opacity-70 line-through decoration-amber-500/50">{c.from}</span>
            <span className="mx-1 text-amber-700 dark:text-amber-300">→</span>
            <span className="font-medium">{c.to}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function part1RowClass(changed: boolean): string | undefined {
  return changed
    ? 'bg-amber-50/90 dark:bg-amber-950/20 ring-1 ring-inset ring-amber-200/60 dark:ring-amber-800/50'
    : undefined;
}

function parseJsonArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  try { const p = typeof val === 'string' ? JSON.parse(val) : val; return Array.isArray(p) ? p : []; }
  catch { return []; }
}

function parseJsonObj(val: any): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  try { const p = typeof val === 'string' ? JSON.parse(val) : val; return typeof p === 'object' && !Array.isArray(p) ? p : {}; }
  catch { return {}; }
}

/** Stable snapshot for syncing Part IV form when server `part4_data` changes (not on unrelated inspection polls). */
function serializePart4ForSync(inspection: InspectionRequest): string {
  const p = inspection.part4_data;
  if (p == null) return '';
  if (typeof p === 'string') return p;
  try {
    return JSON.stringify(p);
  } catch {
    return '';
  }
}

function normalizeDateInputForPart4(v: unknown): string {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return '';
}

function buildPart4FormState(inspection: InspectionRequest) {
  const d = parseJsonObj(inspection.part4_data);
  const remarks = Array.isArray(d.part4_remarks)
    ? d.part4_remarks.map((r: any, i: number) => {
        const normalized = normalizeRemarkWithChatId({
          sl_no: String(r.sl_no ?? i + 1),
          observation: String(r.observation ?? ''),
          action_required: String(r.action_required ?? ''),
          closed_on: String(r.closed_on ?? ''),
          signature: String(r.signature ?? ''),
          chat_id: r.chat_id != null ? String(r.chat_id) : '',
        });
        return normalized;
      })
    : [];

  return {
    inspection_details: String(d.inspection_details ?? ''),
    start_date: normalizeDateInputForPart4(d.start_date),
    completion_date: normalizeDateInputForPart4(d.completion_date),
    items_offered:
      d.items_offered !== undefined && d.items_offered !== null && String(d.items_offered) !== ''
        ? String(d.items_offered)
        : '',
    items_accepted:
      d.items_accepted !== undefined && d.items_accepted !== null && String(d.items_accepted) !== ''
        ? String(d.items_accepted)
        : '',
    observations_count:
      d.observations_count !== undefined && d.observations_count !== null && String(d.observations_count) !== ''
        ? String(d.observations_count)
        : '',
    items_rejected:
      d.items_rejected !== undefined && d.items_rejected !== null && String(d.items_rejected) !== ''
        ? String(d.items_rejected)
        : '',
    verification_logbook: String(d.verification_logbook ?? ''),
    instruments_calibration: String(d.instruments_calibration ?? ''),
    logbook_copy_attached: String(d.logbook_copy_attached ?? ''),
    logbook_copy_attachment_id:
      d.logbook_copy_attachment_id != null && String(d.logbook_copy_attachment_id).trim() !== ''
        ? Number(d.logbook_copy_attachment_id)
        : null,
    logbook_copy_file_name: String(d.logbook_copy_file_name ?? ''),
    inspection_status: String(d.inspection_status ?? ''),
    per_guiding_checklist: String(d.per_guiding_checklist ?? ''),
    remarks: String(d.remarks ?? ''),
    part4_remarks: remarks,
    inspector_rep1_name:
      resolveAssignedInspectorsForDisplay(inspection).map((i) => i.name).join(', ') ||
      '',
    inspector_rep2_name: String(d.inspector_rep2_name ?? ''),
    team_head_name: inspection.nominated_team_head_name || '',
  };
}

function hasInspectorsAssignedInsp(inspection: InspectionRequest): boolean {
  return resolveAssignedInspectorsForDisplay(inspection).length > 0;
}

function isNominatedTeamHeadUser(inspection: InspectionRequest, userId: number): boolean {
  return (
    !!inspection.nominated_team_head_id &&
    Number(inspection.nominated_team_head_id) === userId &&
    userId > 0
  );
}

function canQaApproverManageInspectors(
  inspection: InspectionRequest,
  userId: number,
  userRole: string | undefined,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return userRole === 'qa_approver' && isNominatedTeamHeadUser(inspection, userId);
}

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
  request_date?: string;
  scheduled_date?: string;
  completed_date?: string;
  initiator_id: number;
  initiator_name: string;
  initiator_email: string;
  initiator_phone?: string;
  initiator_employee_id?: string;
  initiator_designation?: string;
  /** Profile rank/grade; Part I field 20 “Designation” shows this when set */
  initiator_scientist_rank?: string | null;
  inspector_id?: number;
  inspector_name?: string;
  inspector_names?: string | null;
  inspector_email?: string;
  inspector_phone?: string;
  inspector_employee_id?: string;
  inspector_designation?: string;
  inspector_signature_path?: string | null;
  approver_id?: number;
  approver_name?: string;
  approved_by?: number;
  approved_by_name?: string;
  approval_date?: string;
  rejection_reason?: string;
  /** Set when Request Approver sends IR back for Part I (non-rejection). */
  request_approver_send_back_comment?: string | null;
  /** Set when Request Approver forwards IR to QA Head. */
  request_approver_forward_comment?: string | null;
  /** Set when nominated Team Head – QA sends IR back (Part I corrections). */
  qa_approver_send_back_comment?: string | null;
  qa_approver_send_back_to?: 'initiator' | 'designer' | string | null;
  /** Set when assigned ORDAQA person (Sections 24–25) sends IR back for Part I. */
  ordaqa_inspector_send_back_comment?: string | null;
  ordaqa_inspector_send_back_to?: 'initiator' | 'designer' | string | null;
  created_at: string;
  updated_at: string;
  checklists: any[];
  attachments: any[];
  activities: any[];
  // CABS format fields
  project_id?: number;
  project_name?: string;
  project_code?: string;
  subsystem_id?: number;
  subsystem_name?: string;
  subsystem_code?: string;
  lru_id?: number;
  lru_name?: string;
  lru_code?: string;
  lru_part_number?: string;
  sru_id?: number;
  sru_name?: string;
  sru_code?: string;
  sru_part_number?: string;
  item_pertains_to?: string[];
  item_pertains_to_other?: string;
  test_type?: string[];
  test_type_other?: string;
  so_details?: string;
  delivery_period?: string;
  so_involves_dgaqa?: boolean | null;
  so_involves_rqa?: boolean | null;
  source?: string;
  oem_name?: string;
  lru_nomenclature?: string;
  criticality?: string[];
  part_number?: string;
  serial_number?: string;
  quantity?: number;
  quantity_per_set?: number;
  previous_stage_cleared?: string;
  logbook_attached?: string;
  inspection_stage?: string;
  inspection_mode?: string;
  inspection_datetime?: string;
  inspection_date_from?: string;
  inspection_date_to?: string;
  venue?: string;
  document_details?: Record<string, { approved: string; doc_no: string; amd_no: string; rev_no: string; date: string }>;
  confirmations?: Record<string, string>;
  designer_rep_name?: string;
  designer_rep_designation?: string;
  designer_rep_contact?: string;
  design_coordinator_name?: string;
  certified_by_name?: string;
  certified_by_designation?: string;
  nominated_request_approver_id?: number | null;
  nominated_request_approver_name?: string;
  /** JSON summary of Part I fields last edited by nominated Request Approver / DH certifier */
  part1_certifier_edit_summary?: string | null;
  part1_approver_name?: string;
  part1_approved_by?: number | null;
  part1_approved_by_name?: string;
  part1_approved_at?: string | null;
  // Workflow fields
  request_approver_id?: number;
  request_approver_name?: string;
  request_approver_designation?: string;
  request_approver_signature_path?: string | null;
  request_approval_date?: string;
  qa_approver_id?: number;
  qa_approver_name?: string;
  qa_approver_designation?: string;
  qa_approver_signature_path?: string | null;
  forwarded_to_ordaqa?: boolean;
  part2_notes?: string;
  part2_data?: any;
  part2_date?: string;
  ordaqa_inspector_id?: number;
  ordaqa_inspector_name?: string;
  ordaqa_inspector_designation?: string;
  ordaqa_inspector_employee_id?: string;
  part3_data?: any;
  part3_completed_by?: number;
  part3_completed_by_name?: string;
  part3_completed_by_signature_path?: string | null;
  part3_date?: string;
  part4_data?: any;
  part4_completed_by?: number;
  part4_completed_by_name?: string;
  part4_date?: string;
  final_qa_approver_id?: number;
  final_qa_approver_name?: string;
  final_qa_approver_designation?: string;
  final_qa_approver_signature_path?: string | null;
  final_qa_approval_date?: string;
  ordaqa_approver_id?: number;
  ordaqa_approver_name?: string;
  ordaqa_approver_designation?: string;
  ordaqa_approval_date?: string;
  nominated_team_head_id?: number;
  nominated_team_head_name?: string;
  nominated_team_head_employee_id?: string;
  nominated_team_head_signature_path?: string | null;
  /** Active QA Head user names (comma-separated) for “Currently with”. */
  qa_head_names?: string | null;
  /** Active ORDAQA Head user names (comma-separated) for “Currently with”. */
  ordaqa_head_names?: string | null;
  inspector_ids?: string;
  assigned_inspectors?: Array<{
    id: number;
    name: string;
    employee_id: string;
    designation: string;
    signature_path?: string | null;
  }>;
}

const DOC_TYPE_ORDER = ['ts', 'qap', 'sop_mdi', 'qtp_lqtp_softp', 'ftp_atp', 'pc_ta_other'];
const DOC_TYPE_LABELS: Record<string, string> = {
  ts: 'TS',
  qap: 'QAP',
  sop_mdi: 'SOP/MDI/BOM/ICD',
  qtp_lqtp_softp: 'QTP/LQTP/SOFTP',
  ftp_atp: 'FTP/ATP',
  pc_ta_other: 'PC/TA/Other Doc',
};

const MODE_LABELS: Record<string, string> = {
  physical: 'Physical',
  vc: 'VC',
  hybrid: 'Through Hybrid',
  physical_vc: 'Physical VC',
};

const fmtDate = (val: any): string => formatCalendarDateDisplay(val);
const fmtDateTime = (val: any): string => formatDateTimeDisplay(val);

const CONFIRMATION_LABELS: Record<string, string> = {
  approved_docs_available: 'a) Approved copies of documents are available at place of inspection before start of QA coverage for LRU.',
  logbook_updated: 'b) R&QA controlled Log book with template are updated.',
  previous_observations_status: 'c) Status of the previous observations/NCs.',
  cocs_available: 'd) CoCs, Certificates, Test Reports, Datasheets, verified Industry partner QC Reports etc. are available for offered stage.',
  instruments_available: 'e) Applicable measuring instruments/Testing facilities are available with valid calibration certificates.',
  joint_inspection_request: 'f) Request for Joint Inspection with ORDAQA as per approved QAP.',
};

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const permissions = usePermissions();
  const [inspection, setInspection] = useState<InspectionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const goToTab = (tab: string, formId?: string) => {
    setActiveTab(tab);
    window.setTimeout(() => {
      const panel = document.getElementById(`inspection-tab-${tab}`);
      const preferred =
        (formId && document.getElementById(formId)) ||
        (tab === 'part2'
          ? document.getElementById('part2-assign-form') || document.getElementById('part2-fill-form')
          : tab === 'part3'
            ? document.getElementById('part3-fill-form')
            : tab === 'part4'
              ? document.getElementById('part4-fill-form')
              : null);
      (preferred || panel)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };
  const [showAddChecklistDialog, setShowAddChecklistDialog] = useState(false);
  const [showViewChecklistDialog, setShowViewChecklistDialog] = useState(false);
  const [showEditChecklistDialog, setShowEditChecklistDialog] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [showEditItemDialog, setShowEditItemDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [newItemForm, setNewItemForm] = useState({
    description: '',
    category: '',
  });
  const [editItemForm, setEditItemForm] = useState({
    status: '',
    is_compliant: null as boolean | null,
    findings: '',
    corrective_action: '',
    inspector_notes: '',
  });
  const [checklistForm, setChecklistForm] = useState({
    name: '',
    description: '',
    items: [{ description: '', category: '' }],
  });
  const [editChecklistForm, setEditChecklistForm] = useState({
    name: '',
    description: '',
    is_completed: false,
  });
  const [inspectors, setInspectors] = useState<any[]>([]);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const actionMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sendBackDialogOpen, setSendBackDialogOpen] = useState(false);
  const [sendBackComment, setSendBackComment] = useState('');
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardComment, setForwardComment] = useState('');
  const [qaSendBackDialogOpen, setQaSendBackDialogOpen] = useState(false);
  const [qaSendBackComment, setQaSendBackComment] = useState('');
  const [qaRejectDialogOpen, setQaRejectDialogOpen] = useState(false);
  const [qaRejectReason, setQaRejectReason] = useState('');
  const [part5SendBackDialogOpen, setPart5SendBackDialogOpen] = useState(false);
  const [part5SendBackComment, setPart5SendBackComment] = useState('');
  const [part4RejectDialogOpen, setPart4RejectDialogOpen] = useState(false);
  const [part4RejectComment, setPart4RejectComment] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchInspection();
      fetchInspectors();
      // Set up auto-refresh for activities every 30 seconds
      const interval = setInterval(fetchInspection, 30000);
      return () => clearInterval(interval);
    }
  }, [params.id]);

  const fetchInspectors = async () => {
    try {
      const response = await fetch('/api/users?role=inspector');
      const data = await response.json();
      if (data.users) {
        setInspectors(data.users);
      }
    } catch (error) {
      console.error('Error fetching inspectors:', error);
    }
  };

  const fetchInspection = async () => {
    try {
      const response = await fetch(`/api/inspection-requests/${params.id}?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (data.request) {
        setInspection(data.request);
      } else if (!response.ok) {
        showMessage('error', data.error || 'Unable to load this inspection');
      }
    } catch (error) {
      console.error('Error fetching inspection:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    if (actionMessageTimerRef.current) clearTimeout(actionMessageTimerRef.current);
    setActionMessage({ type, text });
    actionMessageTimerRef.current = setTimeout(() => setActionMessage(null), 4000);
  };

  const handleWorkflowAction = async (
    action: string,
    extra: Record<string, any> = {}
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/inspection-requests/${params.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await response.json();
      if (response.ok) {
        await fetchInspection();
        showMessage('success', data.message || 'Action completed');
        return true;
      }
      showMessage('error', data.error || 'Action failed');
      return false;
    } catch (error) {
      console.error('Workflow action error:', error);
      showMessage('error', 'Failed to perform action');
      return false;
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/inspection-requests/${params.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchInspection();
        showMessage('success', 'Status updated');
      } else {
        showMessage('error', 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showMessage('error', 'Failed to update status');
    }
  };

  const handleApprove = async () => {
    try {
      const response = await fetch(`/api/inspection-requests/${params.id}/approve`, {
        method: 'PUT',
      });

      if (response.ok) {
        await fetchInspection();
        showMessage('success', 'Inspection approved');
      } else {
        showMessage('error', 'Failed to approve');
      }
    } catch (error) {
      console.error('Error approving inspection:', error);
      showMessage('error', 'Failed to approve');
    }
  };

  const handleReject = async () => {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/inspection-requests/${params.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        await fetchInspection();
        showMessage('success', 'Inspection rejected');
      } else {
        showMessage('error', 'Failed to reject');
      }
    } catch (error) {
      console.error('Error rejecting inspection:', error);
      showMessage('error', 'Failed to reject');
    }
  };

  const handleClose = async () => {
    if (!confirm('Are you sure you want to close this inspection? This action cannot be undone.')) {
      return;
    }

    const notes = prompt('Optional: Add any closing notes');

    try {
      const response = await fetch(`/api/inspection-requests/${params.id}/close`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (response.ok) {
        await fetchInspection();
        showMessage('success', 'Inspection closed');
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to close inspection');
      }
    } catch (error) {
      console.error('Error closing inspection:', error);
      showMessage('error', 'Failed to close inspection');
    }
  };

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    setUploadProgress({ done: 0, total: files.length });

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 20 * 1024 * 1024) {
        alert(`"${file.name}" exceeds 20 MB limit and was skipped.`);
        setUploadProgress(p => ({ ...p, done: p.done + 1 }));
        continue;
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entity_type', 'inspection_request');
      formData.append('entity_id', params.id as string);
      try {
        const response = await fetch('/api/attachments', { method: 'POST', body: formData });
        if (response.ok) successCount++;
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
      }
      setUploadProgress(p => ({ ...p, done: p.done + 1 }));
    }

    if (successCount > 0) {
      await fetchInspection();
      showMessage('success', `${successCount} file(s) uploaded`);
    }
    setUploadingFiles(false);
    setUploadProgress({ done: 0, total: 0 });
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchInspection();
        showMessage('success', 'Attachment deleted');
      }
    } catch (error) {
      console.error('Error deleting attachment:', error);
      showMessage('error', 'Failed to delete attachment');
    }
  };

  const handleAddChecklistFormItem = () => {
    setChecklistForm({
      ...checklistForm,
      items: [...checklistForm.items, { description: '', category: '' }],
    });
  };

  const handleRemoveChecklistItem = (index: number) => {
    const newItems = checklistForm.items.filter((_, i) => i !== index);
    setChecklistForm({
      ...checklistForm,
      items: newItems.length > 0 ? newItems : [{ description: '', category: '' }],
    });
  };

  const handleChecklistItemChange = (index: number, field: string, value: string) => {
    const newItems = [...checklistForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setChecklistForm({
      ...checklistForm,
      items: newItems,
    });
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checklistForm.name.trim()) {
      alert('Please enter a checklist name');
      return;
    }

    try {
      const response = await fetch('/api/inspection-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_request_id: params.id,
          name: checklistForm.name,
          description: checklistForm.description,
          items: checklistForm.items.filter(item => item.description.trim() !== ''),
        }),
      });

      if (response.ok) {
        setShowAddChecklistDialog(false);
        setChecklistForm({
          name: '',
          description: '',
          items: [{ description: '', category: '' }],
        });
        await fetchInspection();
        showMessage('success', 'Checklist created successfully');
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to create checklist');
      }
    } catch (error) {
      console.error('Error creating checklist:', error);
      showMessage('error', 'Failed to create checklist');
    }
  };

  const fetchChecklistDetails = async (checklistId: number) => {
    setLoadingChecklist(true);
    try {
      const response = await fetch(`/api/inspection-checklists/${checklistId}`);
      const data = await response.json();
      
      if (data.checklist) {
        setSelectedChecklist(data.checklist);
        setChecklistItems(data.checklist.items || []);
      }
    } catch (error) {
      console.error('Error fetching checklist details:', error);
      alert('Failed to load checklist details');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleViewChecklist = async (checklist: any) => {
    await fetchChecklistDetails(checklist.id);
    setShowViewChecklistDialog(true);
  };

  const handleOpenEditChecklist = async (checklist: any) => {
    await fetchChecklistDetails(checklist.id);
    setEditChecklistForm({
      name: checklist.name,
      description: checklist.description || '',
      is_completed: checklist.is_completed || false,
    });
    setShowEditChecklistDialog(true);
  };

  const handleUpdateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChecklist) return;

    try {
      const response = await fetch(`/api/inspection-checklists/${selectedChecklist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editChecklistForm),
      });

      if (response.ok) {
        const message = editChecklistForm.is_completed 
          ? 'Checklist marked as completed! All pending items marked as passed.'
          : 'Checklist reopened! All items reverted to pending status.';
        setShowEditChecklistDialog(false);
        if (showViewChecklistDialog && selectedChecklist) {
          await fetchChecklistDetails(selectedChecklist.id);
        }
        setSelectedChecklist(null);
        await fetchInspection();
        showMessage('success', message);
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to update checklist');
      }
    } catch (error) {
      console.error('Error updating checklist:', error);
      showMessage('error', 'Failed to update checklist');
    }
  };

  const handleDeleteChecklist = async (checklistId: number) => {
    if (!confirm('Are you sure you want to delete this checklist? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/inspection-checklists/${checklistId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchInspection();
        showMessage('success', 'Checklist deleted');
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to delete checklist');
      }
    } catch (error) {
      console.error('Error deleting checklist:', error);
      showMessage('error', 'Failed to delete checklist');
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedChecklist || !newItemForm.description.trim()) {
      alert('Please enter an item description');
      return;
    }

    try {
      const response = await fetch(`/api/inspection-checklists/${selectedChecklist.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newItemForm.description,
          category: newItemForm.category || null,
        }),
      });

      if (response.ok) {
        setShowAddItemDialog(false);
        setNewItemForm({ description: '', category: '' });
        await fetchChecklistDetails(selectedChecklist.id);
        showMessage('success', 'Checklist item added');
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to add checklist item');
      }
    } catch (error) {
      console.error('Error adding checklist item:', error);
      showMessage('error', 'Failed to add checklist item');
    }
  };

  const handleOpenEditItem = (item: any) => {
    setSelectedItem(item);
    setEditItemForm({
      status: item.status || 'pending',
      is_compliant: item.is_compliant,
      findings: item.findings || '',
      corrective_action: item.corrective_action || '',
      inspector_notes: item.inspector_notes || '',
    });
    setShowEditItemDialog(true);
  };

  const handleUpdateChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem) {
      alert('No item selected');
      return;
    }

    try {
      const response = await fetch(`/api/inspection-checklists/items/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editItemForm),
      });

      if (response.ok) {
        setShowEditItemDialog(false);
        setSelectedItem(null);
        if (selectedChecklist) {
          await fetchChecklistDetails(selectedChecklist.id);
        }
        showMessage('success', 'Checklist item updated');
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to update checklist item');
      }
    } catch (error) {
      console.error('Error updating checklist item:', error);
      showMessage('error', 'Failed to update checklist item');
    }
  };

  const handleToggleChecklistComplete = async () => {
    if (!selectedChecklist) return;

    const newCompletionStatus = !selectedChecklist.is_completed;
    
    try {
      const response = await fetch(`/api/inspection-checklists/${selectedChecklist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_completed: newCompletionStatus,
        }),
      });

      if (response.ok) {
        const message = newCompletionStatus
          ? 'Checklist completed! All pending items marked as passed.'
          : 'Checklist reopened! All items reverted to pending.';
        await fetchChecklistDetails(selectedChecklist.id);
        await fetchInspection();
        showMessage('success', message);
      } else {
        const data = await response.json();
        showMessage('error', data.error || 'Failed to update checklist');
      }
    } catch (error) {
      console.error('Error updating checklist:', error);
      showMessage('error', 'Failed to update checklist');
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
      qa_approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
      pending_ordaqa_approval: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300', // legacy
      completed: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
      approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
      closed: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
      returned_to_designer: 'bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200',
    };
    const labels: Record<string, string> = {
      pending_request_approval: 'PENDING FORWARD',
      pending_part1_approval: 'PENDING PART I APPROVAL',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading inspection details...</p>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">Inspection not found</p>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  // Field-level "Updated" markers are only for Initiator/Designer (and admin) — not other roles.
  const canSeePart1CertifierEdits =
    inspection.initiator_id === permissions.userId || permissions.isAdmin();
  const part1EditSummary = canSeePart1CertifierEdits
    ? parsePart1CertifierEditSummary(inspection.part1_certifier_edit_summary)
    : null;
  // Section 20 designer-rep identity is never a Request Approver edit (false positives filtered)
  const PART1_DESIGNER_REP_KEYS = new Set([
    'designer_rep_name',
    'designer_rep_designation',
    'designer_rep_contact',
  ]);
  const part1ChangesByKey = new Map(
    (part1EditSummary?.changes || [])
      .filter((c) => c?.key && !PART1_DESIGNER_REP_KEYS.has(c.key))
      .map((c) => [c.key, c] as const)
  );
  const part1Changed = (...keys: string[]) => keys.some((k) => part1ChangesByKey.has(k));
  const part1Notes = (...keys: string[]) =>
    keys.map((k) => part1ChangesByKey.get(k)).filter(Boolean) as Part1FieldChange[];

  return (
    <div className="space-y-6">
      {/* Action message — fixed so it stays visible without scrolling */}
      {actionMessage && (
        <div
          role="status"
          className={`fixed top-4 left-1/2 z-50 w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg flex items-center justify-between transition-all ${
          actionMessage.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/95 dark:border-green-800 dark:text-green-300'
            : 'bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/95 dark:border-red-800 dark:text-red-300'
        }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span className="text-sm font-medium">{actionMessage.text}</span>
          </div>
          <button type="button" onClick={() => setActionMessage(null)} className="text-current opacity-60 hover:opacity-100 shrink-0 ml-3">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
      {inspection.status === 'returned_to_designer' &&
        inspection.request_approver_send_back_comment &&
        !permissions.isRequestApprover() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Sent back by Part I Approver</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-200/90 whitespace-pre-wrap">
            {inspection.request_approver_send_back_comment}
          </p>
          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/90">
            Update Part I as needed, then resubmit for Part I approval (employee 1021).
          </p>
        </div>
      )}
      {inspection.request_approver_forward_comment &&
        (permissions.isQaHead() ||
          permissions.isAdmin() ||
          permissions.isPart1Approver()) &&
        inspection.status !== 'pending_request_approval' &&
        inspection.status !== 'pending' &&
        inspection.status !== 'draft' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/90 px-4 py-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
          <p className="font-medium">Comment from Request Approver</p>
          <p className="mt-1 text-blue-900/90 dark:text-blue-200/90 whitespace-pre-wrap">
            {inspection.request_approver_forward_comment}
          </p>
          {inspection.request_approver_name && (
            <p className="mt-2 text-xs text-blue-800/80 dark:text-blue-300/90">
              Forwarded by {inspection.request_approver_name}
              {inspection.request_approval_date ? ` on ${fmtDate(inspection.request_approval_date)}` : ''}
            </p>
          )}
        </div>
      )}
      {inspection.status === 'returned_to_designer' &&
        inspection.qa_approver_send_back_comment &&
        !permissions.isRole('qa_approver') && (
        <div className="rounded-lg border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100">
          <p className="font-medium">Sent back by Team Head</p>
          <p className="mt-1 text-violet-900/90 dark:text-violet-200/90 whitespace-pre-wrap">
            {inspection.qa_approver_send_back_comment}
          </p>
          <p className="mt-2 text-xs text-violet-800/80 dark:text-violet-300/90">
            Update Part I as needed, then resubmit.
          </p>
        </div>
      )}
      {inspection.status === 'returned_to_designer' &&
        inspection.ordaqa_inspector_send_back_comment &&
        !permissions.isOrdaqaInspector() && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50/90 px-4 py-3 text-sm text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100">
          <p className="font-medium">Sent back by ORDAQA Inspector</p>
          <p className="mt-1 text-cyan-900/90 dark:text-cyan-200/90 whitespace-pre-wrap">
            {inspection.ordaqa_inspector_send_back_comment}
          </p>
          <p className="mt-2 text-xs text-cyan-800/80 dark:text-cyan-300/90">
            Update Part I as applicable for the designer, then resubmit.
          </p>
        </div>
      )}

      <Dialog open={sendBackDialogOpen} onOpenChange={setSendBackDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send back to initiator</DialogTitle>
            <DialogDescription>
              The IR will move to Returned to designer so the initiator can update Part I and resubmit. This is not a rejection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="send-back-comment">Comment for initiator</Label>
            <Textarea
              id="send-back-comment"
              rows={4}
              placeholder="Describe what needs to be corrected or clarified..."
              value={sendBackComment}
              onChange={(e) => setSendBackComment(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSendBackDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const trimmed = sendBackComment.trim();
                if (!trimmed) {
                  showMessage('error', 'Please enter a comment.');
                  return;
                }
                const ok = await handleWorkflowAction('request_send_back', { comments: trimmed });
                if (ok) {
                  setSendBackComment('');
                  setSendBackDialogOpen(false);
                }
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {inspection?.status === 'pending_part1_approval'
                ? 'Approve Part I and forward to QA Head'
                : 'Forward to Part I Approver'}
            </DialogTitle>
            <DialogDescription>
              {inspection?.status === 'pending_part1_approval'
                ? 'Part I will be approved and the IR will go to QA Head (Part II). You may optionally add a comment.'
                : 'The IR will be sent to the Part I Approver. You may optionally add a comment.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="forward-comment">
              {inspection?.status === 'pending_part1_approval'
                ? 'Comment for QA Head (optional)'
                : 'Comment for Part I Approver (optional)'}
            </Label>
            <Textarea
              id="forward-comment"
              rows={4}
              placeholder="Add notes or instructions..."
              value={forwardComment}
              onChange={(e) => setForwardComment(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setForwardDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const trimmed = forwardComment.trim();
                const action =
                  inspection?.status === 'pending_part1_approval' ? 'part1_approve' : 'request_approve';
                const ok = await handleWorkflowAction(action, {
                  comments: trimmed || undefined,
                });
                if (ok) {
                  setForwardComment('');
                  setForwardDialogOpen(false);
                }
              }}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {inspection?.status === 'pending_part1_approval' ? 'Approve Part I' : 'Forward Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qaSendBackDialogOpen} onOpenChange={setQaSendBackDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send back (Team Head – QA)</DialogTitle>
            <DialogDescription>
              Return this IR to the initiator for Part I corrections. The initiator updates Part I and resubmits for Request Approver approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="qa-send-back-comment">Comment</Label>
              <Textarea
                id="qa-send-back-comment"
                rows={4}
                placeholder="Describe what needs to be corrected or clarified..."
                value={qaSendBackComment}
                onChange={(e) => setQaSendBackComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setQaSendBackDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-orange-300 text-orange-900 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-200 dark:hover:bg-orange-950/40"
              onClick={async () => {
                const trimmed = qaSendBackComment.trim();
                if (!trimmed) {
                  showMessage('error', 'Please enter a comment.');
                  return;
                }
                const ok = await handleWorkflowAction('qa_approver_send_back', {
                  comments: trimmed,
                  send_back_to: 'initiator',
                });
                if (ok) {
                  setQaSendBackComment('');
                  setQaSendBackDialogOpen(false);
                }
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={part5SendBackDialogOpen} onOpenChange={setPart5SendBackDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send back Part V (ORDAQA Head)</DialogTitle>
            <DialogDescription>
              Return Sections 24–25 to the assigned ORDAQA Inspector for revision. They can edit and resubmit Part V for your approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="part5-send-back-comment">Comment for ORDAQA Inspector</Label>
            <Textarea
              id="part5-send-back-comment"
              rows={4}
              placeholder="Describe what needs to be revised in Part V..."
              value={part5SendBackComment}
              onChange={(e) => setPart5SendBackComment(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPart5SendBackDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-violet-300 text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/40"
              onClick={async () => {
                const trimmed = part5SendBackComment.trim();
                if (!trimmed) {
                  showMessage('error', 'Please enter a comment.');
                  return;
                }
                const ok = await handleWorkflowAction('ordaqa_head_part5_send_back', {
                  comments: trimmed,
                });
                if (ok) {
                  setPart5SendBackComment('');
                  setPart5SendBackDialogOpen(false);
                }
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={part4RejectDialogOpen} onOpenChange={setPart4RejectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send back (Team Head – QA)</DialogTitle>
            <DialogDescription>
              Return Part IV to the R&amp;QA Inspector for revision. They can update the report and resubmit for your approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="part4-reject-comment">Comments for R&amp;QA Inspector</Label>
            <Textarea
              id="part4-reject-comment"
              rows={4}
              placeholder="Describe what needs to be revised in Part IV..."
              value={part4RejectComment}
              onChange={(e) => setPart4RejectComment(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPart4RejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
              onClick={async () => {
                const trimmed = part4RejectComment.trim();
                if (!trimmed) {
                  showMessage('error', 'Please enter comments.');
                  return;
                }
                const ok = await handleWorkflowAction('reject_part4', {
                  comments: trimmed,
                });
                if (ok) {
                  setPart4RejectComment('');
                  setPart4RejectDialogOpen(false);
                }
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qaRejectDialogOpen} onOpenChange={setQaRejectDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject inspection request</DialogTitle>
            <DialogDescription>
              Permanently reject this IR as Team Head – QA. Enter comments explaining the rejection.
              The initiator (and assigned inspector(s), if any) will be notified. This cannot be undone from the workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="qa-reject-reason">Comment</Label>
            <Textarea
              id="qa-reject-reason"
              rows={4}
              placeholder="Comment"
              value={qaRejectReason}
              onChange={(e) => setQaRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setQaRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                const trimmed = qaRejectReason.trim();
                if (!trimmed) {
                  showMessage('error', 'Please enter a comment.');
                  return;
                }
                const ok = await handleWorkflowAction('qa_reject', { reason: trimmed });
                if (ok) {
                  setQaRejectReason('');
                  setQaRejectDialogOpen(false);
                }
              }}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-3xl font-bold tracking-tight">{inspection.title}</h2>
              {getStatusBadge(inspection.status)}
            </div>
            <p className="text-muted-foreground">{inspection.request_number}</p>
            {(() => {
              const custody = resolveInspectionCustody(inspection);
              if (custody.stage === 'Completed' || custody.stage === 'Rejected') {
                return (
                  <p className="text-xs text-muted-foreground mt-1">
                    {custody.stage === 'Completed' ? (
                      <>
                        <span className="font-medium text-foreground">Inspection Request completed</span>
                        {' · '}
                        Final approved by:{' '}
                        <span className="font-medium text-foreground">{custody.name || '—'}</span>
                      </>
                    ) : (
                      <span className="font-medium text-foreground">
                        {formatInspectionCustodyLine(custody)}
                      </span>
                    )}
                  </p>
                );
              }
              const who = custody.name ? `${custody.name} (${custody.role})` : custody.role;
              return (
                <p className="text-xs text-muted-foreground mt-1">
                  Currently with:{' '}
                  <span className="font-medium text-foreground">{who}</span>
                  {' · '}
                  <span className="font-medium text-foreground">{custody.stage}</span>
                  {' — '}
                  {custody.action}
                </p>
              );
            })()}
            {(() => {
              const st = String(inspection.status || '');
              const forwardedTo =
                inspection.request_approver_name?.trim() ||
                inspection.nominated_request_approver_name?.trim() ||
                null;
              const reachedPart1Queue =
                Boolean(forwardedTo) ||
                st === 'pending_part1_approval' ||
                Boolean(inspection.part1_approved_by) ||
                Boolean(inspection.part1_approved_by_name) ||
                ![
                  'pending',
                  'draft',
                  'pending_request_approval',
                  'rejected',
                ].includes(st);
              if (!reachedPart1Queue) return null;
              const pendingApproval = st === 'pending_part1_approval';
              // Only show a real Part I approval — never fall back to the role holder (1021) name
              const approvedBy =
                st === 'returned_to_designer' ||
                st === 'pending_request_approval' ||
                st === 'pending' ||
                st === 'draft' ||
                st === 'rejected'
                  ? null
                  : inspection.part1_approved_by_name?.trim() || null;
              return (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Part I forwarded by:{' '}
                  <span className="font-medium text-foreground">{forwardedTo || '—'}</span>
                  {' · '}
                  Part I approved by:{' '}
                  <span className="font-medium text-foreground">
                    {approvedBy || (pendingApproval ? 'Pending' : '—')}
                  </span>
                </p>
              );
            })()}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open(`/print/inspection/${inspection.id}`, '_blank')}
          >
            <Printer className="h-4 w-4" />
            Print PDF
          </Button>
          {/* Part I author / admin: draft–return only. Nominated field-21 certifier may edit while awaiting forward. */}
          {((inspection.initiator_id === permissions.userId || permissions.isAdmin()) &&
            ['pending', 'draft', 'returned_to_designer'].includes(inspection.status)) ||
          permissions.canEditPart1AsCertifier(inspection) ? (
              <Button variant="outline" asChild>
                <Link href={`/dashboard/inspections/new?edit=${inspection.id}`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Part I
                </Link>
              </Button>
            ) : null}
          {/* Request Approver / nominated DH Initiator: Forward / Send back / Reject */}
          {(inspection.status === 'pending_request_approval' || inspection.status === 'pending') &&
            permissions.canActAsRequestCertifier(inspection) && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setSendBackComment('');
                  setSendBackDialogOpen(true);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Send back
              </Button>
              <Button variant="outline" onClick={() => {
                const reason = prompt('Reason for rejection:');
                if (reason) handleWorkflowAction('request_reject', { reason });
              }}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => {
                setForwardComment('');
                setForwardDialogOpen(true);
              }}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Forward Request
              </Button>
            </>
          )}
          {/* Part I Approver (employee 1021): after RA forward — Approve / Reject only (no send back) */}
          {inspection.status === 'pending_part1_approval' && permissions.isPart1Approver() && (
            <>
              <Button variant="outline" onClick={() => {
                const reason = prompt('Reason for rejection:');
                if (reason) handleWorkflowAction('request_reject', { reason });
              }}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => {
                setForwardComment('');
                setForwardDialogOpen(true);
              }}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve Part I
              </Button>
            </>
          )}
          {/* QA Head: Fill Part II Step 1 (includes 19(f) No — Team Head selection; ORDAQA Part III still skipped) */}
          {inspection.status === 'request_approved' &&
            !inspection.nominated_team_head_id &&
            (permissions.isQaHead() || permissions.isAdmin()) && (
            <Button onClick={() => goToTab('part2')}>
              <Edit className="mr-2 h-4 w-4" />
              Fill Part II
            </Button>
          )}
          {(permissions.isQaHead() || permissions.isAdmin()) &&
            !!inspection.nominated_team_head_id &&
            ['request_approved', 'assigned', 'in_progress'].includes(inspection.status) && (
            <Button variant="outline" onClick={() => goToTab('part2')}>
              <Edit className="mr-2 h-4 w-4" />
              {memoReturnedAwaitingQaHead(inspection) ? 'Edit & Resubmit Part II' : 'Edit Part II'}
            </Button>
          )}
          {!inspectionSkipsPart2Part3(inspection) &&
            canEditPart3Section23(inspection) &&
            (permissions.isOrdaqaHead() || permissions.isAdmin()) &&
            !part3Section23HasSavedData(inspection) && (
            <Button onClick={() => goToTab('part3')}>
              <Edit className="mr-2 h-4 w-4" />
              Fill Part III
            </Button>
          )}
          {!inspectionSkipsPart2Part3(inspection) &&
            canEditPart3Section23(inspection) &&
            (permissions.isOrdaqaHead() || permissions.isAdmin()) &&
            part3Section23HasSavedData(inspection) && (
            <Button variant="outline" onClick={() => goToTab('part3')}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Part III
            </Button>
          )}
          {(permissions.userRole === 'inspector' || permissions.isAdmin()) &&
            canUserUpdatePart4(inspection, permissions.userId, permissions.userRole) &&
            !inspectionPart4Saved(inspection) && (
            <Button onClick={() => goToTab('part4')}>
              <Edit className="mr-2 h-4 w-4" />
              Fill Part IV
            </Button>
          )}
          {(permissions.userRole === 'inspector' || permissions.isAdmin()) &&
            canUserUpdatePart4(inspection, permissions.userId, permissions.userRole) &&
            inspectionPart4Saved(inspection) && (
            <Button variant="outline" onClick={() => goToTab('part4')}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Part IV
            </Button>
          )}
          {canUserTeamHeadEditPart4(inspection, permissions.userId, permissions.userRole) && (
            <Button variant="outline" onClick={() => goToTab('part4')}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Part IV
            </Button>
          )}
          {canUserUpdatePart5(inspection, permissions.userId, permissions.userRole) && (
            <Button onClick={() => goToTab('part5')}>
              <Edit className="mr-2 h-4 w-4" />
              Fill Part V
            </Button>
          )}
          {/* Team Head - QA: send back (nominated path before assign; skip-path any R&QA TH including after inspection_completed) */}
          {canUserQaApproverSendBack(
            inspection,
            permissions.userId,
            permissions.userRole,
            hasInspectorsAssignedInsp(inspection)
          ) && (
            <Button
              variant="outline"
              onClick={() => {
                setQaSendBackComment('');
                setQaSendBackDialogOpen(true);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Send back
            </Button>
          )}
          {/* Nominated Team Head (QA approver): Assign / edit inspectors (Part II Step 2) */}
          {canQaApproverManageInspectors(
            inspection,
            permissions.userId,
            permissions.userRole,
            permissions.isAdmin()
          ) &&
            !!inspection.nominated_team_head_id &&
            !inspectionPart4Saved(inspection) &&
            ((inspection.status === 'request_approved' && !hasInspectorsAssignedInsp(inspection)) ||
              (hasInspectorsAssignedInsp(inspection) &&
                ['assigned', 'in_progress'].includes(inspection.status))) && (
            <Button onClick={() => goToTab('part2', 'part2-assign-form')}>
              <User className="mr-2 h-4 w-4" />
              {hasInspectorsAssignedInsp(inspection) ? 'Edit Inspector Assignment' : 'Assign Inspector'}
            </Button>
          )}
          {/* Team Head - QA: Reject with comments during Part II (before inspector assignment) */}
          {canUserQaApproverRejectDuringPart2(
            inspection,
            permissions.userId,
            permissions.userRole,
            hasInspectorsAssignedInsp(inspection)
          ) &&
            !canUserQaApproverReject(
              inspection,
              permissions.userId,
              permissions.userRole
            ) && (
            <Button
              variant="outline"
              className="border-red-300 text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
              onClick={() => {
                setQaRejectReason('');
                setQaRejectDialogOpen(true);
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          )}
          {/* Administrator only: Start & Complete inspection (not R&QA inspector / Team Head – QA) */}
          {canUserStartInspection(inspection, permissions.userId, permissions.userRole) && (
            <Button onClick={() => handleWorkflowAction('start_inspection')}>
              Start Inspection
            </Button>
          )}
          {canUserCompleteInspection(inspection, permissions.userId, permissions.userRole) && (
            <Button onClick={() => handleWorkflowAction('complete_inspection')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete Inspection
            </Button>
          )}
          {canUserOrdqaHeadPart5SendBack(inspection, permissions.userRole) && (
            <Button
              variant="outline"
              onClick={() => {
                setPart5SendBackComment('');
                setPart5SendBackDialogOpen(true);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Send back Part V
            </Button>
          )}
          {canUserApproveOrdqaPart5(inspection, permissions.userRole) && (
            <Button onClick={() => handleWorkflowAction('approve_part5')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve Part V
            </Button>
          )}
          {/* Team Head - QA: Approve / Send back Part IV */}
          {canUserRejectPart4(inspection, permissions.userId, permissions.userRole) && (
            <Button
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
              onClick={() => {
                setPart4RejectComment('');
                setPart4RejectDialogOpen(true);
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Send back
            </Button>
          )}
          {canUserApprovePart4(inspection, permissions.userId, permissions.userRole) && (
            <Button onClick={() => handleWorkflowAction('approve_part4')}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve Part IV
            </Button>
          )}
          {/* Team Head - QA (qa_approver): Reject / Approve & Close after Part V approved (or Part IV when no Part V) */}
          {canUserQaApproverApproveAndClose(
            inspection,
            permissions.userId,
            permissions.userRole
          ) && (
            <>
              <Button
                variant="outline"
                className="border-red-300 text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                onClick={() => {
                  setQaRejectReason('');
                  setQaRejectDialogOpen(true);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => handleWorkflowAction('qa_approve')}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve &amp; Close
              </Button>
            </>
          )}
          {/* Admin: all workflow actions */}
          {permissions.isAdmin() && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4 mr-1" /> Admin Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Workflow Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(inspection.status === 'pending_request_approval' || inspection.status === 'pending') && (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setSendBackComment('');
                        setSendBackDialogOpen(true);
                      }}
                    >
                      Send back (with comment)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setForwardComment('');
                        setForwardDialogOpen(true);
                      }}
                    >
                      Forward Request
                    </DropdownMenuItem>
                  </>
                )}
                {inspection.status === 'pending_part1_approval' && (
                  <DropdownMenuItem
                    onClick={() => {
                      setForwardComment('');
                      setForwardDialogOpen(true);
                    }}
                  >
                    Approve Part I
                  </DropdownMenuItem>
                )}
                {['request_approved', 'assigned', 'in_progress', 'inspection_completed'].includes(inspection.status) && (
                  <DropdownMenuItem
                    onClick={() => {
                      setQaSendBackComment('');
                      setQaSendBackDialogOpen(true);
                    }}
                  >
                    Team Head – QA send back
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {inspection.status === 'completed' && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 px-4 py-2">
              ✓ IR Completed
            </Badge>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg shrink-0 backdrop-blur-sm">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-100">Venue</p>
                <p className="font-semibold text-sm text-white mt-0.5 break-words whitespace-normal leading-snug">
                  {inspection.venue || inspection.location || '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg shrink-0 backdrop-blur-sm">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-emerald-100">
                  {(inspection.assigned_inspectors?.length ?? 0) > 1 ? 'Inspectors' : 'Inspector'}
                </p>
                <p className="font-semibold text-sm text-white mt-0.5 line-clamp-2 leading-snug">
                  {formatAssignedInspectorsDisplay(inspection)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-800">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg shrink-0 backdrop-blur-sm">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-amber-100">Due Date</p>
                <p className="font-semibold text-sm text-white mt-0.5">{fmtDate(inspection.due_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-violet-500 to-purple-700 dark:from-violet-600 dark:to-purple-900">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg shrink-0 backdrop-blur-sm">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-violet-100">Inspection Stage</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(inspection.inspection_stage || inspection.inspection_type)
                    ? (inspection.inspection_stage || inspection.inspection_type || '').split(',').map((s: string, i: number) => (
                      <span
                        key={i}
                        className="inline-block rounded-md bg-white/20 px-2 py-0.5 text-xs font-normal text-white backdrop-blur-sm"
                      >
                        {formatInspectionStageItemLabel(s.trim())}
                      </span>
                    ))
                    : <span className="font-semibold text-sm text-white">—</span>
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-lg overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-800 dark:from-indigo-600 dark:to-indigo-950">
          <CardContent className="pt-5 pb-4 relative">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
            <div className="relative flex items-start gap-3">
              <div className="bg-white/20 p-2 rounded-lg shrink-0 backdrop-blur-sm">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-indigo-100">Mode</p>
                <p className="font-semibold text-sm text-white mt-0.5">{MODE_LABELS[inspection.inspection_mode || ''] || inspection.inspection_mode || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Progress */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs">
            {(() => {
              const skipOrdqa = inspectionSkipsPart2Part3(inspection);
              const needsOrdqa = inspectionRequiresOrdqaPart5(inspection);
              const part2Saved =
                !!inspection.nominated_team_head_id ||
                hasInspectorsAssignedInsp(inspection);
              const part23Done = hasInspectorsAssignedInsp(inspection);
              const part3OrdqaDone =
                !needsOrdqa || part3CompleteForOrdqaWorkflow(inspection);
              const p4Done = inspectionPart4Saved(inspection);
              const p4Unlocked =
                inspectionUsesLegacyOpenRqaPart4(inspection) || (part23Done && part3OrdqaDone);
              const p4Submitted =
                p4Unlocked &&
                p4Done &&
                (part4PendingTeamHeadApproval(inspection) || part4ApprovedByTeamHead(inspection));
              const part5Na = skipOrdqa || !needsOrdqa;
              const steps: { key: string; done: boolean; na?: boolean }[] = [
                // Tick once Part I is submitted to Request Approver (untick if returned to designer)
                {
                  key: 'Part I',
                  done: !['pending', 'draft', 'returned_to_designer'].includes(inspection.status),
                },
                // Tick after Request Approver clicks Forward Request (pending Part I approval or later)
                {
                  key: 'Forwarded',
                  done: !['pending', 'draft', 'pending_request_approval', 'returned_to_designer'].includes(
                    inspection.status
                  ),
                },
                {
                  key: needsOrdqa ? 'Part II/III' : 'Part II',
                  // Part II ticks once QA Head saves Part II; Part II/III also needs Part III done
                  done: needsOrdqa ? part2Saved && part3OrdqaDone : part2Saved,
                },
                // Tick when Part IV is submitted (pending Team Head or already approved)
                { key: 'Part IV', done: p4Submitted },
                ...(!part5Na
                  ? [
                      {
                        key: 'Part V',
                        done:
                          p4Unlocked &&
                          p4Done &&
                          part4ApprovedByTeamHead(inspection) &&
                          ordqaPart5Completed(inspection),
                      } as { key: string; done: boolean; na?: boolean },
                    ]
                  : []),
                { key: 'Completed', done: inspection.status === 'completed' },
              ];
              return steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      step.na
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-600'
                        : step.done
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.na ? '—' : step.done ? '✓' : i + 1}
                  </div>
                  <span
                    className={
                      step.na
                        ? 'text-muted-foreground'
                        : step.done
                          ? 'text-green-700 dark:text-green-400 font-medium'
                          : 'text-muted-foreground'
                    }
                  >
                    {step.key}
                  </span>
                  {i < steps.length - 1 && <span className="mx-1 text-gray-300 dark:text-gray-600">→</span>}
                </div>
              ));
            })()}
          </div>
          {(() => {
            const custody = resolveInspectionCustody(inspection);
            if (custody.stage === 'Completed' || custody.stage === 'Rejected') {
              return (
                <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
                  {custody.stage === 'Completed' ? (
                    <>
                      <span className="font-medium text-foreground">Inspection Request completed</span>
                      {' · '}
                      Final approved by:{' '}
                      <span className="font-medium text-foreground">{custody.name || '—'}</span>
                    </>
                  ) : (
                    <span className="font-medium text-foreground">
                      {formatInspectionCustodyLine(custody)}
                    </span>
                  )}
                </p>
              );
            }
            const who = custody.name ? `${custody.name} (${custody.role})` : custody.role;
            return (
              <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
                Currently with:{' '}
                <span className="font-medium text-foreground">{who}</span>
                {' · '}
                <span className="font-medium text-foreground">{custody.stage}</span>
                {' — '}
                {custody.action}
              </p>
            );
          })()}
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 h-auto">
          <TabsTrigger value="overview">Part I</TabsTrigger>
          <TabsTrigger value="part2">Part II</TabsTrigger>
          <TabsTrigger value="part3">Part III</TabsTrigger>
          <TabsTrigger value="part4">Part IV</TabsTrigger>
          <TabsTrigger value="part5">Part V</TabsTrigger>
          <TabsTrigger value="attachments">
            Attachments ({inspection.attachments.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({inspection.activities.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* IR Header */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Request for R&QA Inspection / Testing</CardTitle>
                <div className="text-right text-sm">
                  <span className="text-muted-foreground">IR No: </span>
                  <span className="font-bold">{inspection.request_number}</span>
                  <span className="mx-2 text-muted-foreground">|</span>
                  <span className="text-muted-foreground">Date: </span>
                  <span className="font-medium">
                    {inspection.request_date
                      ? fmtDate(inspection.request_date)
                      : fmtDate(inspection.created_at)}
                  </span>
                </div>
              </div>
              <CardDescription>
                Part I — Details of item(s) to be inspected
                {part1EditSummary && part1EditSummary.changes.length > 0 && (
                  <span className="ml-2 text-amber-700 dark:text-amber-300">
                    · Fields updated by {part1EditSummary.editedBy} are highlighted below
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    {/* Row 1: Programme */}
                    <tr className={part1RowClass(part1Changed('project_id'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium w-[220px] text-[navy] dark:text-blue-300">
                        1. Programme / Project
                        {part1Changed('project_id') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{inspection.project_name || '—'}</span>
                        {inspection.project_code && (
                          <Badge variant="outline" className="ml-2 align-middle font-mono text-xs">{inspection.project_code}</Badge>
                        )}
                        <Part1RowEditNote changes={part1Notes('project_id')} />
                      </td>
                    </tr>
                    {/* Row 2: Subsystem */}
                    <tr className={part1RowClass(part1Changed('subsystem_id'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        2. Sub System
                        {part1Changed('subsystem_id') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{inspection.subsystem_name || '—'}</span>
                        {inspection.subsystem_code && (
                          <Badge variant="outline" className="ml-2 align-middle font-mono text-xs">{inspection.subsystem_code}</Badge>
                        )}
                        <Part1RowEditNote changes={part1Notes('subsystem_id')} />
                      </td>
                    </tr>
                    {/* Row 3: Item Pertains To */}
                    <tr className={part1RowClass(part1Changed('item_pertains_to', 'item_pertains_to_other', 'test_type', 'test_type_other'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        3. Item Pertains to
                        {part1Changed('item_pertains_to', 'item_pertains_to_other', 'test_type', 'test_type_other') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-4">
                            <div>
                              <span className="text-xs text-muted-foreground mr-2">Unit:</span>
                              {(Array.isArray(inspection.item_pertains_to) ? inspection.item_pertains_to : parseJsonArray(inspection.item_pertains_to)).map((v: string) => (
                                <Badge key={v} variant="secondary" className="mr-1">{formatItemPertainsToToken(v)}</Badge>
                              ))}
                              {!(Array.isArray(inspection.item_pertains_to) ? inspection.item_pertains_to : parseJsonArray(inspection.item_pertains_to)).length && <span className="text-muted-foreground">—</span>}
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground mr-2">Test:</span>
                              {(Array.isArray(inspection.test_type) ? inspection.test_type : parseJsonArray(inspection.test_type)).map((v: string) => (
                                <Badge key={v} variant="secondary" className="mr-1">{formatTestTypeToken(v)}</Badge>
                              ))}
                              {!(Array.isArray(inspection.test_type) ? inspection.test_type : parseJsonArray(inspection.test_type)).length && !(inspection.test_type_other || '').toString().trim() && <span className="text-muted-foreground">—</span>}
                            </div>
                          </div>
                          {(inspection.test_type_other || '').toString().trim() && (
                            <p className="text-sm text-foreground pl-0">
                              <span className="text-xs text-muted-foreground">Other (test):</span>{' '}
                              {String(inspection.test_type_other).trim()}
                            </p>
                          )}
                        </div>
                        <Part1RowEditNote changes={part1Notes('item_pertains_to', 'item_pertains_to_other', 'test_type', 'test_type_other')} />
                      </td>
                    </tr>
                    {/* Row 4: SO Details */}
                    <tr className={part1RowClass(part1Changed('so_details', 'delivery_period', 'so_involves_dgaqa', 'so_involves_rqa'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        4. SO Details
                        {part1Changed('so_details', 'delivery_period', 'so_involves_dgaqa', 'so_involves_rqa') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-2">
                          <div>
                            <span>{inspection.so_details || '—'}</span>
                            {inspection.delivery_period && (
                              <span className="ml-6 text-muted-foreground">Delivery: <span className="text-foreground font-medium">{fmtDate(inspection.delivery_period)}</span></span>
                            )}
                          </div>
                          {(() => {
                            const soAtt = (inspection.attachments || []).find((a) =>
                              String(a.description || '').toLowerCase().includes('supply order')
                            );
                            return soAtt ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <a
                                  href={soAtt.file_path}
                                  download
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline truncate"
                                >
                                  {soAtt.file_name || 'Supply Order'}
                                </a>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No Supply Order attachment</p>
                            );
                          })()}
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={inspection.so_involves_dgaqa ? 'default' : 'secondary'}>
                              DGAQA: {inspection.so_involves_dgaqa ? 'Yes' : 'No'}
                            </Badge>
                            <Badge variant={inspection.so_involves_rqa ? 'default' : 'secondary'}>
                              R&QA: {inspection.so_involves_rqa ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                        </div>
                        <Part1RowEditNote changes={part1Notes('so_details', 'delivery_period', 'so_involves_dgaqa', 'so_involves_rqa')} />
                      </td>
                    </tr>
                    {/* Row 5: Source */}
                    <tr className={part1RowClass(part1Changed('source', 'oem_name'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        5. Source
                        {part1Changed('source', 'oem_name') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {formatSourceLabel(inspection.source)}
                        {inspection.oem_name && (
                          <span className="ml-6 text-muted-foreground">OEM: <span className="text-foreground font-medium">{inspection.oem_name}</span></span>
                        )}
                        <Part1RowEditNote changes={part1Notes('source', 'oem_name')} />
                      </td>
                    </tr>
                    {/* Row 6: LRU / SRU Nomenclature */}
                    <tr className={part1RowClass(part1Changed('lru_nomenclature', 'item', 'lru_id', 'sru_id'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        6. LRU / SRU Nomenclature
                        {part1Changed('lru_nomenclature', 'item', 'lru_id', 'sru_id') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium">
                        {inspection.lru_nomenclature || inspection.item || '—'}
                        <Part1RowEditNote changes={part1Notes('lru_nomenclature', 'item', 'lru_id', 'sru_id')} />
                      </td>
                    </tr>
                    {/* Row 7: Criticality */}
                    <tr className={part1RowClass(part1Changed('criticality'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        7. Criticality of Store
                        {part1Changed('criticality') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {(Array.isArray(inspection.criticality) ? inspection.criticality : parseJsonArray(inspection.criticality)).map((v: string) => {
                          const colors: Record<string, string> = {
                            mission: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
                            flight: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
                            safety: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
                            non_critical: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
                          };
                          const labels: Record<string, string> = { mission: 'Mission Critical', flight: 'Flight Critical', safety: 'Safety Critical', non_critical: 'Non Critical' };
                          return <Badge key={v} className={`mr-1 ${colors[v.toLowerCase()] || ''}`}>{labels[v] || v}</Badge>;
                        })}
                        {!(Array.isArray(inspection.criticality) ? inspection.criticality : parseJsonArray(inspection.criticality)).length && <span className="text-muted-foreground">—</span>}
                        <Part1RowEditNote changes={part1Notes('criticality')} />
                      </td>
                    </tr>
                    {/* Row 8-9: Part & Serial */}
                    <tr className={part1RowClass(part1Changed('part_number', 'serial_number'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        8. Part Number
                        {part1Changed('part_number', 'serial_number') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono">{inspection.part_number || '—'}</span>
                        <span className="mx-6 text-muted-foreground">|</span>
                        <span className="text-muted-foreground">9. Serial No: </span>
                        <span className="font-mono">{inspection.serial_number || '—'}</span>
                        <Part1RowEditNote changes={part1Notes('part_number', 'serial_number')} />
                      </td>
                    </tr>
                    {/* Row 10-11: Qty */}
                    <tr className={part1RowClass(part1Changed('quantity', 'quantity_per_set'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        10. No. of sets — Qty/set
                        {part1Changed('quantity', 'quantity_per_set') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {inspection.quantity != null && inspection.quantity_per_set != null ? (
                          <span>
                            {inspection.quantity} <span className="text-muted-foreground">—</span>{' '}
                            {inspection.quantity_per_set}
                          </span>
                        ) : (
                          '—'
                        )}
                        <Part1RowEditNote changes={part1Notes('quantity', 'quantity_per_set')} />
                      </td>
                    </tr>
                    <tr className={part1RowClass(part1Changed('quantity') && inspection.quantity_per_set == null)}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        11. Qty
                        {part1Changed('quantity') && inspection.quantity_per_set == null && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {inspection.quantity != null && inspection.quantity_per_set == null
                          ? inspection.quantity
                          : '—'}
                        {part1Changed('quantity') && inspection.quantity_per_set == null && (
                          <Part1RowEditNote changes={part1Notes('quantity')} />
                        )}
                      </td>
                    </tr>
                    {/* Row 12: Previous Stage */}
                    <tr className={part1RowClass(part1Changed('previous_stage_cleared'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        12. Previous Stage Cleared
                        {part1Changed('previous_stage_cleared') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {(() => {
                          const psc = parsePreviousStageCleared(inspection.previous_stage_cleared);
                          if (!psc.answer) return <span className="text-muted-foreground">—</span>;
                          if (psc.answer === 'no') {
                            return (
                              <Badge variant="secondary" className="capitalize">
                                No
                              </Badge>
                            );
                          }
                          if (psc.answer === 'na') {
                            return (
                              <Badge variant="secondary">
                                NA
                              </Badge>
                            );
                          }
                          return (
                            <div className="space-y-1">
                              <Badge variant="default" className="capitalize">
                                Yes
                              </Badge>
                              {psc.stages.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {psc.stages.map((s: string, i: number) => (
                                    <Badge key={i} variant="outline" className="text-xs font-normal max-w-full whitespace-normal text-left">
                                      {formatInspectionStageItemLabel(s)}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <Part1RowEditNote changes={part1Notes('previous_stage_cleared')} />
                      </td>
                    </tr>
                    {/* Row 13: Logbook */}
                    <tr className={part1RowClass(part1Changed('logbook_attached'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        13. Log Book Copy Attached
                        {part1Changed('logbook_attached') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={inspection.logbook_attached === 'yes' ? 'default' : 'secondary'} className={inspection.logbook_attached === 'na' ? undefined : 'capitalize'}>
                          {inspection.logbook_attached === 'na'
                            ? 'NA'
                            : inspection.logbook_attached === 'yes'
                              ? 'Yes'
                              : inspection.logbook_attached === 'no'
                                ? 'No'
                                : inspection.logbook_attached || '—'}
                        </Badge>
                        <Part1RowEditNote changes={part1Notes('logbook_attached')} />
                      </td>
                    </tr>
                    {/* Row 14: Inspection Stage */}
                    <tr className={part1RowClass(part1Changed('inspection_stage'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        14. Inspection Stage Offered
                        {part1Changed('inspection_stage') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {inspection.inspection_stage
                            ? inspection.inspection_stage.split(',').map((s: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs font-normal max-w-full whitespace-normal text-left">
                                {formatInspectionStageItemLabel(s.trim())}
                              </Badge>
                            ))
                            : <span className="text-muted-foreground">—</span>
                          }
                        </div>
                        <Part1RowEditNote changes={part1Notes('inspection_stage')} />
                      </td>
                    </tr>
                    {/* Row 15: Mode */}
                    <tr className={part1RowClass(part1Changed('inspection_mode'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        15. Mode of Inspection
                        {part1Changed('inspection_mode') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {MODE_LABELS[inspection.inspection_mode || ''] || inspection.inspection_mode || '—'}
                        <Part1RowEditNote changes={part1Notes('inspection_mode')} />
                      </td>
                    </tr>
                    {/* Row 16: Venue */}
                    <tr className={part1RowClass(part1Changed('venue', 'location'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        16. Venue
                        {part1Changed('venue', 'location') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {inspection.venue || inspection.location || '—'}
                        <Part1RowEditNote changes={part1Notes('venue', 'location')} />
                      </td>
                    </tr>
                    {/* Row 17: Inspection Date */}
                    <tr className={part1RowClass(part1Changed('inspection_date_from', 'inspection_date_to', 'inspection_datetime'))}>
                      <td className="bg-muted/50 px-4 py-2.5 font-medium">
                        17. Inspection Date
                        {part1Changed('inspection_date_from', 'inspection_date_to', 'inspection_datetime') && (
                          <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {inspection.inspection_date_from || inspection.inspection_datetime ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span>
                              <span className="text-muted-foreground text-xs">From:</span>{' '}
                              {formatReceivedDateTimeDisplay(inspection.inspection_date_from || inspection.inspection_datetime)}
                            </span>
                            {inspection.inspection_date_to && (
                              <>
                                <span>
                                  <span className="text-muted-foreground text-xs">To:</span>{' '}
                                  {formatReceivedDateTimeDisplay(inspection.inspection_date_to)}
                                </span>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                  {(() => {
                                    const a = parseYmdLocal(
                                      toDateOnlyYmd(inspection.inspection_date_from || inspection.inspection_datetime)
                                    );
                                    const b = parseYmdLocal(toDateOnlyYmd(inspection.inspection_date_to));
                                    if (!a || !b) return '—';
                                    return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                  })()} day(s)
                                </span>
                              </>
                            )}
                          </div>
                        ) : '—'}
                        <Part1RowEditNote changes={part1Notes('inspection_date_from', 'inspection_date_to', 'inspection_datetime')} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {inspection.description && (
                <div className={`mt-4 p-3 rounded-lg ${part1Changed('description') ? 'bg-amber-50/90 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800' : 'bg-muted/30'}`}>
                  <Label className="text-muted-foreground text-xs">
                    Additional Notes
                    {part1Changed('description') && (
                      <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">Updated</Badge>
                    )}
                  </Label>
                  <p className="mt-1 text-sm">{inspection.description}</p>
                  <Part1RowEditNote changes={part1Notes('description')} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Details (18-19) */}
          {inspection.document_details && Object.keys(parseJsonObj(inspection.document_details)).length > 0 && (
            <Card className={part1Changed('document_details') ? 'ring-1 ring-amber-300 dark:ring-amber-700' : undefined}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  18–19. Document Reference Details
                  {part1Changed('document_details') && (
                    <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0 align-middle">Updated</Badge>
                  )}
                </CardTitle>
                <CardDescription>Approved document numbers, revisions, and dates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium">Document</th>
                        <th className="px-4 py-2 text-center font-medium w-[90px]">Approved</th>
                        <th className="px-4 py-2 text-left font-medium">Doc No.</th>
                        <th className="px-4 py-2 text-center font-medium w-[70px]">Amd</th>
                        <th className="px-4 py-2 text-center font-medium w-[70px]">Rev</th>
                        <th className="px-4 py-2 text-left font-medium w-[120px]">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(() => { const docs = parseJsonObj(inspection.document_details); return DOC_TYPE_ORDER.filter(k => docs[k]).map(k => [k, docs[k]] as [string, any]); })().map(([key, doc]: [string, any]) => (
                        <tr key={key}>
                          <td className="px-4 py-2 font-medium">{DOC_TYPE_LABELS[key] || key}</td>
                          <td className="px-4 py-2 text-center">
                            <Badge
                              variant="outline"
                              className={
                                doc.approved === 'yes' ? 'border-green-500 text-green-700 bg-green-50' :
                                doc.approved === 'no' ? 'border-red-500 text-red-700 bg-red-50' :
                                doc.approved === 'draft' ? 'border-amber-500 text-amber-700 bg-amber-50' :
                                'border-gray-300 text-gray-500'
                              }
                            >
                              {doc.approved === 'yes' ? 'Yes' : doc.approved === 'no' ? 'No' : doc.approved === 'na' ? 'NA' : doc.approved === 'draft' ? 'Draft' : 'N/A'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{doc.doc_no || '—'}</td>
                          <td className="px-4 py-2 text-center">{doc.amd_no || '—'}</td>
                          <td className="px-4 py-2 text-center">{doc.rev_no || '—'}</td>
                          <td className="px-4 py-2">{doc.date || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Part1RowEditNote changes={part1Notes('document_details')} />
                {(() => {
                  const docs = parseJsonObj(inspection.document_details);
                  const hasDraft = Object.values(docs).some(
                    (d: any) => String(d?.approved || '').toLowerCase() === 'draft'
                  );
                  if (!hasDraft) return null;
                  return (
                    <p className="mt-3 text-sm italic text-amber-800 dark:text-amber-200">
                      Since the Doc (as applicable) doc is draft, the inspection is tentative only
                    </p>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Confirmations */}
          {inspection.confirmations && Object.keys(parseJsonObj(inspection.confirmations)).length > 0 && (
            <Card className={part1Changed('confirmations') ? 'ring-1 ring-amber-300 dark:ring-amber-700' : undefined}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  Confirmations
                  {part1Changed('confirmations') && (
                    <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0 align-middle">Updated</Badge>
                  )}
                </CardTitle>
                <CardDescription>Pre-inspection confirmations by the designer</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y">
                      {(() => {
                        const conf = parseJsonObj(inspection.confirmations);
                        const orderedKeys = [
                          ...Object.keys(CONFIRMATION_LABELS).filter((k) => k in conf),
                          ...Object.keys(conf).filter((k) => !(k in CONFIRMATION_LABELS)),
                        ];
                        return orderedKeys.map((key) => {
                          const val = conf[key];
                          const display =
                            val === 'yes' ? 'Yes' :
                            val === 'no' ? 'No' :
                            val === 'open' ? 'Open' :
                            val === 'closed' ? 'Closed' :
                            val === 'na' || val === 'n/a' ? 'N/A' :
                            String(val || '—');
                          return (
                        <tr key={key}>
                          <td className="px-4 py-2.5 flex-1">
                            <div>{CONFIRMATION_LABELS[key] || key}</div>
                            {key === 'instruments_available' && val === 'no' && (
                              <p className="mt-1 text-xs font-semibold text-red-700">
                                Note: Inspection stage may be liable for rejection
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center w-[100px]">
                            <Badge
                              variant="outline"
                              className={
                                val === 'yes' || val === 'closed' ? 'border-green-500 text-green-700 bg-green-50' :
                                val === 'no' ? 'border-red-500 text-red-700 bg-red-50' :
                                val === 'open' ? 'border-amber-500 text-amber-700 bg-amber-50' :
                                'border-gray-300 text-gray-500'
                              }
                            >
                              {display}
                            </Badge>
                          </td>
                        </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
                <Part1RowEditNote changes={part1Notes('confirmations')} />
              </CardContent>
            </Card>
          )}

          {/* Designer & Certifier (20-21) */}
          <Card className={part1Changed('designer_rep_name', 'designer_rep_designation', 'designer_rep_contact', 'design_coordinator_name', 'certified_by_name', 'certified_by_designation', 'nominated_request_approver_id') ? 'ring-1 ring-amber-300 dark:ring-amber-700' : undefined}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Designer Representative & Certification
                {part1Changed('designer_rep_name', 'designer_rep_designation', 'designer_rep_contact', 'design_coordinator_name', 'certified_by_name', 'certified_by_designation', 'nominated_request_approver_id') && (
                  <Badge className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0 align-middle">Updated</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Designer Rep (20) */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground">20. Designer Rep Name</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <p className="font-medium">{inspection.designer_rep_name || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Designation</Label>
                      <p className="font-medium">
                        {inspection.designer_rep_designation?.trim() ||
                          inspection.initiator_scientist_rank?.trim() ||
                          '—'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Contact</Label>
                      <p className="font-medium">{inspection.designer_rep_contact || '—'}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Design Coordinator</Label>
                      <p className="font-medium">{inspection.design_coordinator_name || '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Certifier / Request Approver (21) */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground">21. Designer DH/GD/TH Name (Certifier)</h4>
                  {(() => {
                    const certifierName =
                      inspection.request_approver_name?.trim() ||
                      inspection.certified_by_name?.trim() ||
                      inspection.nominated_request_approver_name?.trim() ||
                      '';
                    const certifierDesignation =
                      inspection.certified_by_designation?.trim() ||
                      inspection.request_approver_designation?.trim() ||
                      '';
                    const isSignedOff = Boolean(inspection.request_approver_name?.trim());

                    if (!certifierName) {
                      return (
                        <div className="text-sm text-muted-foreground italic py-2">
                          {inspection.status === 'pending_request_approval' ? (
                            <span className="text-amber-600 dark:text-amber-400">⏳ Pending Request Approver forward</span>
                          ) : inspection.status === 'pending_part1_approval' ? (
                            <span className="text-orange-600 dark:text-orange-400">⏳ Pending Part I approval</span>
                          ) : inspection.status === 'pending' || inspection.status === 'draft' ? (
                            <span>Submit IR for Request Approver forward to enable this section</span>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">Name</Label>
                            <p className="font-medium">{certifierName}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Designation</Label>
                            <p className="font-medium">{certifierDesignation || '—'}</p>
                          </div>
                          {isSignedOff && (
                            <>
                              <div>
                                <Label className="text-xs text-muted-foreground">Date</Label>
                                <p className="font-medium">{fmtDate(inspection.request_approval_date)}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Signature</Label>
                                {inspection.request_approver_signature_path ? (
                                  <img src={inspection.request_approver_signature_path} alt="Signature" className="h-12 mt-1 object-contain" />
                                ) : (
                                  <p className="font-medium italic text-green-700 dark:text-green-400">✓ Digitally Signed</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {!isSignedOff && inspection.status === 'pending_request_approval' && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 italic pt-2 border-t">
                            ⏳ Pending Request Approver forward
                          </p>
                        )}
                        {isSignedOff && inspection.status === 'pending_part1_approval' && (
                          <p className="text-xs text-orange-600 dark:text-orange-400 italic pt-2 border-t">
                            ⏳ Forwarded — pending Part I approval
                          </p>
                        )}
                        {isSignedOff && inspection.status !== 'pending_part1_approval' && (
                          <p className="text-xs text-green-700 dark:text-green-400 italic pt-2 border-t">
                            It is certified that the above LRU/SRU/Assembly/Part/material is ready for Inspection / Testing.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <Part1RowEditNote
                changes={part1Notes(
                  'designer_rep_name',
                  'designer_rep_designation',
                  'designer_rep_contact',
                  'design_coordinator_name',
                  'certified_by_name',
                  'certified_by_designation',
                  'nominated_request_approver_id'
                )}
              />

              {/* Part I Summary */}
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Initiated By</Label>
                  <p className="font-medium">{inspection.initiator_name}</p>
                  {inspection.initiator_employee_id && (
                    <p className="text-xs text-muted-foreground">{inspection.initiator_employee_id} • {inspection.initiator_designation}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Part I forwarded by</Label>
                  <p className="font-medium">
                    {inspection.request_approver_name?.trim() ||
                      inspection.nominated_request_approver_name?.trim() ||
                      '—'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Part I approved by</Label>
                  <p className="font-medium">
                    {(() => {
                      const st = String(inspection.status || '');
                      if (st === 'pending_part1_approval') return 'Pending';
                      if (
                        [
                          'pending',
                          'draft',
                          'pending_request_approval',
                          'returned_to_designer',
                          'rejected',
                        ].includes(st)
                      ) {
                        return '—';
                      }
                      return inspection.part1_approved_by_name?.trim() || '—';
                    })()}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="font-medium">{fmtDate(inspection.created_at)}</p>
                </div>
              </div>

              {inspection.rejection_reason && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <Label className="text-red-800 font-semibold text-xs">Rejection Reason</Label>
                  <p className="mt-1 text-sm text-red-700">{inspection.rejection_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground pt-2">
                <div>Created: {fmtDateTime(inspection.created_at)}</div>
                <div>Updated: {fmtDateTime(inspection.updated_at)}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════ Part II — R&QA Office Use (Section 22) ══════ */}
        <TabsContent value="part2" id="inspection-tab-part2" className="space-y-4 scroll-mt-20">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Part II — R&QA Office Use</CardTitle>
              <CardDescription>Section 22 — Head R&QA comments, nominations, and forwarding to ORDAQA</CardDescription>
            </CardHeader>
            <CardContent>
              {inspection.status === 'returned_to_designer' && (
                <div className="mb-4 rounded-md border border-orange-200 bg-orange-50/80 px-3 py-2 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950/25 dark:text-orange-200">
                  This request is with the initiator for Part I corrections. After resubmit and Part I approval (1021), QA Head will complete Part II again.
                </div>
              )}
              {inspectionSkipsPart2Part3(inspection) && (
                <div className="mb-4 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                  Part I 19(f) joint inspection is <strong>No</strong> — QA Head selects <strong>Team Head – QA</strong> below.
                  ORDAQA Parts III and V do not apply.
                </div>
              )}
              {(() => {
                const p3Memo = parseJsonObj(inspection.part3_data);
                if (
                  String(p3Memo.memo_returned ?? '').toLowerCase() === 'yes' &&
                  !inspection.forwarded_to_ordaqa &&
                  !inspectionSkipsPart2Part3(inspection)
                ) {
                  return (
                    <div className="mb-4 rounded-md border border-orange-200 bg-orange-50/80 px-3 py-2 text-sm text-orange-900 dark:border-orange-800 dark:bg-orange-950/25 dark:text-orange-200">
                      ORDAQA marked <strong>Memo to be Returned</strong> in Part III (Section 23). Review Part II and
                      re-enable <strong>Forward to ORDAQA</strong> when ready for ORDAQA to complete Section 23 again.
                    </div>
                  );
                }
                return null;
              })()}
              {(() => {
                const inspAssigned = hasInspectorsAssignedInsp(inspection);
                const qaApproverCanManageInspectors = canQaApproverManageInspectors(
                  inspection,
                  permissions.userId,
                  permissions.userRole,
                  permissions.isAdmin()
                );
                const showPart2FirstFill =
                  inspection.status === 'request_approved' &&
                  !inspection.nominated_team_head_id &&
                  (permissions.isQaHead() || permissions.isAdmin());
                const showPart2Summary =
                  !!inspection.nominated_team_head_id ||
                  !!inspection.part2_data ||
                  !!inspection.qa_approver_name;
                const memoAwaitingQa = memoReturnedAwaitingQaHead(inspection);
                const canQaEditPart2Step1 =
                  permissions.isAdmin() &&
                  !!inspection.nominated_team_head_id &&
                  ['request_approved', 'assigned', 'in_progress'].includes(inspection.status);
                const canQaHeadEditPart2Step1 =
                  permissions.isQaHead() &&
                  !!inspection.nominated_team_head_id &&
                  ['request_approved', 'assigned', 'in_progress'].includes(inspection.status) &&
                  (!inspAssigned || memoAwaitingQa);
                const showPart2Step2Assign =
                  qaApproverCanManageInspectors &&
                  inspection.status === 'request_approved' &&
                  !!inspection.nominated_team_head_id &&
                  !inspAssigned;
                const showPart2Step2EditInspectors =
                  qaApproverCanManageInspectors &&
                  inspAssigned &&
                  !!inspection.nominated_team_head_id &&
                  ['assigned', 'in_progress'].includes(inspection.status) &&
                  !inspectionPart4Saved(inspection);
                const disableOrdqaForward = inspectionSkipsPart2Part3(inspection);

                if (showPart2FirstFill) {
                  return (
                    <Part2Step1Form
                      inspectionId={inspection.id}
                      inspection={inspection}
                      disableForwardToOrdqa={disableOrdqaForward}
                      onComplete={fetchInspection}
                      onSuccess={(msg) => showMessage('success', msg)}
                    />
                  );
                }

                return (
                  <>
                    {showPart2Summary && <Part2Display inspection={inspection} />}

                    {showPart2Step2Assign && (
                      <>
                        <Separator className="my-4" />
                        <Part2Step2Form
                          inspection={inspection}
                          onComplete={fetchInspection}
                          onSuccess={(msg) => showMessage('success', msg)}
                          mode="assign"
                        />
                      </>
                    )}

                    {showPart2Step2EditInspectors && (
                      <>
                        <Separator className="my-4" />
                        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 mb-3">
                          <p className="text-sm font-medium text-foreground">Edit Inspector assignment (Team Head – QA)</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Update assigned Inspector / QA Rep(s) only. Other Part II fields remain unchanged.
                          </p>
                        </div>
                        <Part2Step2Form
                          inspection={inspection}
                          onComplete={fetchInspection}
                          onSuccess={(msg) => showMessage('success', msg)}
                          mode="edit"
                        />
                      </>
                    )}

                    {inspection.status === 'request_approved' &&
                      !!inspection.nominated_team_head_id &&
                      !inspAssigned &&
                      !showPart2Step2Assign &&
                      !permissions.isQaHead() &&
                      !permissions.isAdmin() && (
                        <div className="text-center py-6 mt-4 text-muted-foreground border rounded-lg bg-amber-50/50 dark:bg-amber-950/10">
                          <p className="font-medium">Waiting for Team Head to assign Inspector(s)</p>
                          <p className="text-sm mt-1">
                            Nominated Team Head: {inspection.nominated_team_head_name || '—'}
                            {inspection.nominated_team_head_employee_id && ` (${inspection.nominated_team_head_employee_id})`}
                          </p>
                        </div>
                      )}

                    {canQaEditPart2Step1 && (
                      <>
                        <Separator className="my-4" />
                        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 mb-3">
                          <p className="text-sm font-medium text-foreground">Edit Section 22 (Admin)</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Update Head R&amp;QA comments, return to designer, ORDAQA forwarding, and Team Head nomination.
                          </p>
                        </div>
                        <Part2Step1Form
                          inspectionId={inspection.id}
                          inspection={inspection}
                          lockTeamHeadSelection={inspAssigned && !memoAwaitingQa}
                          memoResubmit={memoAwaitingQa}
                          disableForwardToOrdqa={disableOrdqaForward}
                          onComplete={fetchInspection}
                          onSuccess={(msg) => showMessage('success', msg)}
                        />
                      </>
                    )}

                    {canQaHeadEditPart2Step1 && (
                      <>
                        <Separator className="my-4" />
                        <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 mb-3">
                          <p className="text-sm font-medium text-foreground">
                            {memoAwaitingQa
                              ? 'Edit & Resubmit Part II (QA Head)'
                              : 'Edit Section 22 (QA Head)'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {memoAwaitingQa
                              ? 'Update Head R&QA comments if needed, turn on Forward to ORDAQA, then resubmit so ORDAQA can complete Section 23 again.'
                              : 'Update Head R&QA comments, return to designer, ORDAQA forwarding, and Team Head nomination.'}
                          </p>
                        </div>
                        <Part2Step1Form
                          inspectionId={inspection.id}
                          inspection={inspection}
                          lockTeamHeadSelection={inspAssigned && !memoAwaitingQa}
                          memoResubmit={memoAwaitingQa}
                          disableForwardToOrdqa={disableOrdqaForward}
                          onComplete={fetchInspection}
                          onSuccess={(msg) => showMessage('success', msg)}
                        />
                      </>
                    )}

                    {!showPart2FirstFill &&
                      !showPart2Summary &&
                      inspection.status === 'request_approved' &&
                      !(permissions.isQaHead() || permissions.isAdmin()) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="font-medium">Waiting for QA Head to complete Part II</p>
                          <p className="text-sm mt-1">Part II Step 1 must be completed by QA Head first</p>
                        </div>
                      )}

                    {!showPart2FirstFill &&
                      !showPart2Summary &&
                      inspection.status !== 'request_approved' &&
                      inspection.status !== 'returned_to_designer' && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p className="font-medium">Part II is not yet available</p>
                          <p className="text-sm mt-1">
                            Request must be forwarded by approver first (current status:{' '}
                            {inspection.status.replace(/_/g, ' ')})
                          </p>
                        </div>
                      )}
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════ Part III — ORDAQA (CABS Cell) Office Use (Section 23) ══════ */}
        <TabsContent value="part3" id="inspection-tab-part3" className="space-y-4 scroll-mt-20">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Part III — ORDAQA (CABS Cell) Office Use</CardTitle>
              <CardDescription>
                Section 23 — ORDAQA Head (or admin) after the IR is forwarded to ORDAQA. Sections 24–25 are in Part V after Part IV.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspectionSkipsPart2Part3(inspection) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="font-medium">Part III — Not Applicable</p>
                  <p className="text-sm mt-1">
                    Part I 19(f) joint inspection is <strong>No</strong>. ORDAQA Part III does
                    not apply — after QA Head nominates Team Head – QA and inspectors are assigned,
                    proceed to <strong>Part IV</strong>.
                  </p>
                </div>
              ) : (
              (() => {
                const p3 = parseJsonObj(inspection.part3_data);
                const isForwarded = isForwardedToOrdqa(inspection);
                const showSection23 = part3Section23HasSavedData(inspection);
                const canEditSection23 = canEditPart3Section23(inspection);
                const canOrdaqaEdit =
                  isForwarded &&
                  canEditSection23 &&
                  (permissions.isOrdaqaHead() || permissions.isAdmin());
                const isReforwarded = ordaqaHeadReforwardActionRequired({
                  ...inspection,
                  has_memo_return_activity: (inspection.activities || []).some(
                    (a: { activity_type?: string }) =>
                      a.activity_type === 'part3_memo_returned' ||
                      a.activity_type === 'part2_reforwarded_to_ordaqa'
                  ),
                });

                const reforwardBanner = isReforwarded ? (
                  <div className="mb-4 rounded-md border border-orange-200 bg-orange-50/90 px-3 py-2.5 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-100">
                    <p className="font-semibold">Re-forwarded to ORDAQA Head by QA Head</p>
                    <p className="mt-1 text-orange-900/90 dark:text-orange-200/90">
                      This IR was returned (memo) and then re-forwarded by QA Head. Complete Part III (Section 23)
                      again{p3.reforwarded_at ? ` (re-forwarded ${fmtDateTime(String(p3.reforwarded_at))})` : ''}.
                    </p>
                  </div>
                ) : null;

                if (!isForwarded && !showSection23) {
                  if (jointInspectionRequestedInPart1(inspection)) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="font-medium">Part III — Awaiting ORDAQA forward</p>
                        <p className="text-sm mt-1">
                          Part I requested joint inspection with ORDAQA. QA Head must enable{' '}
                          <strong>Forward to ORDAQA</strong> in Part II before Section 23 can be completed.
                        </p>
                      </div>
                    );
                  }
                  if (inspection.qa_approver_id) {
                    return (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="font-medium">Part III — Not Applicable</p>
                        <p className="text-sm mt-1">This IR was not forwarded to ORDAQA for joint inspection</p>
                      </div>
                    );
                  }
                }

                // First fill (nothing saved yet) — form only, like Fill Part II
                if (canOrdaqaEdit && !showSection23) {
                  return (
                    <>
                      {reforwardBanner}
                      <Part3AssignForm
                      inspection={inspection}
                      inspectionId={inspection.id}
                      onComplete={fetchInspection}
                      onSuccess={(msg) => showMessage('success', msg)}
                    />
                    </>
                  );
                }

                // Saved summary + edit form below (ORDAQA Head), like Edit Part II for QA Head
                if (showSection23 && (p3.memo_returned === 'yes' || isForwarded)) {
                  const memoReturnedToQa = p3.memo_returned === 'yes';
                  const delegationType = p3.delegation_type;
                  const personLabel =
                    delegationType === 'delegated'
                      ? (inspection.ordaqa_inspector_name || 'Delegated user')
                      : (inspection.ordaqa_inspector_name || 'ORDAQA Inspector');
                  return (
                    <>
                      <Part3Section23Display data={p3} inspection={inspection} />
                      {memoReturnedToQa ? (
                        <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/50 p-4 text-sm text-muted-foreground dark:border-orange-900 dark:bg-orange-950/30">
                          <p className="font-medium text-foreground">Returned to QA Head</p>
                          <p className="mt-1">
                            Memo was marked for return. QA Head should review Part II and re-forward to ORDAQA when ready.
                          </p>
                        </div>
                      ) : isForwarded && inspection.ordaqa_inspector_id ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground mb-4">
                          <p className="font-medium text-foreground">Sections 24–25 (Part V)</p>
                          <p className="mt-1">
                            After <strong>Part IV</strong> is saved, the assignee ({personLabel}) completes Sections{' '}
                            <strong>24–25</strong> under the <strong>Part V</strong> tab.
                          </p>
                        </div>
                      ) : null}

                      {canOrdaqaEdit && (
                        <>
                          <Separator className="my-4" />
                          <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 mb-3">
                            <p className="text-sm font-medium text-foreground">Edit Section 23 (ORDAQA Head)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Update ORDAQA comments, received date/time, memo return, and assignee.
                            </p>
                          </div>
                          <Part3AssignForm
                            inspection={inspection}
                            inspectionId={inspection.id}
                            onComplete={fetchInspection}
                            onSuccess={(msg) => showMessage('success', msg)}
                          />
                        </>
                      )}
                    </>
                  );
                }

                if (isForwarded && canEditSection23) {
                  const custody = resolveInspectionCustody(inspection);
                  const who = custody.name ? `${custody.name} (${custody.role})` : custody.role;
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-medium">Awaiting ORDAQA Head</p>
                      <p className="text-sm mt-2 text-foreground">
                        Currently with: <span className="font-medium">{who}</span>
                        {' · '}
                        {custody.stage} — {custody.action}
                      </p>
                      <p className="text-sm mt-1">
                        ORDAQA Head must complete Section 23 (choose Assigned or Delegated and select the assignee).
                      </p>
                    </div>
                  );
                }

                if (isForwarded) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-medium">Part III — Awaiting prerequisites</p>
                      <p className="text-sm mt-1">
                        QA Head must forward this IR to ORDAQA in Part II, and R&amp;QA Team Head must assign
                        inspector(s) before ORDAQA Head completes Section 23.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="font-medium">Part III is not yet available</p>
                    <p className="text-sm mt-1">Part II must be completed and IR must be forwarded to ORDAQA</p>
                  </div>
                );
              })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════ Part IV — CABS R&QA Inspection Report (Sections 26-29) ══════ */}
        <TabsContent value="part4" id="inspection-tab-part4" className="space-y-4 scroll-mt-20">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Part IV — CABS R&QA Inspection Report</CardTitle>
              <CardDescription>Sections 26–29 — Inspection details, results, observations & sign-off</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const canEditPart4 = canUserUpdatePart4(
                  inspection,
                  permissions.userId,
                  permissions.userRole
                );
                const blockedByPart3 = part4BlockedByPart3(inspection);
                const isAssignedInspector =
                  isUserAssignedPart2Inspector(inspection, permissions.userId) &&
                  ['assigned', 'in_progress'].includes(inspection.status);
                const p4Pending = part4PendingTeamHeadApproval(inspection);
                const p4Approved = part4ApprovedByTeamHead(inspection);
                const p4Rejected = part4RejectedByTeamHead(inspection);
                const p4RejectComment = getPart4TeamHeadRejectComment(inspection);
                const canThApproveP4 = canUserApprovePart4(
                  inspection,
                  permissions.userId,
                  permissions.userRole
                );
                const canThEditP4 = canUserTeamHeadEditPart4(
                  inspection,
                  permissions.userId,
                  permissions.userRole
                );

                if (p4Pending) {
                  return (
                    <div className="space-y-4">
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        Part IV submitted — awaiting Team Head – QA approval.
                      </div>
                      <Part4Display inspection={inspection} canEditObservations={canThApproveP4} />
                      <div className="flex flex-wrap gap-2">
                        {canThApproveP4 && (
                          <>
                            <Button
                              variant="outline"
                              className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
                              onClick={() => {
                                setPart4RejectComment('');
                                setPart4RejectDialogOpen(true);
                              }}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Send back
                            </Button>
                            <Button onClick={() => handleWorkflowAction('approve_part4')}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve Part IV
                            </Button>
                          </>
                        )}
                      </div>
                      {canThEditP4 && (
                        <>
                          <Separator className="my-2" />
                          <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2 mb-3">
                            <p className="text-sm font-medium text-foreground">Edit Part IV (Team Head – QA)</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Update the R&amp;QA inspection report, then Approve or Send back Part IV.
                            </p>
                          </div>
                          <Part4Form
                            inspection={inspection}
                            onComplete={fetchInspection}
                            onSuccess={(msg) => showMessage('success', msg)}
                            submitLabel="Save Part IV updates"
                          />
                        </>
                      )}
                    </div>
                  );
                }

                if (canEditPart4) {
                  return (
                    <div className="space-y-4">
                      {p4Rejected && p4RejectComment && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                          <p className="font-medium">Part IV sent back by Team Head – QA</p>
                          <p className="mt-1 whitespace-pre-wrap text-amber-900/90 dark:text-amber-200/90">
                            {p4RejectComment}
                          </p>
                          <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-300/90">
                            Revise Part IV below, then submit again for Team Head – QA approval.
                          </p>
                        </div>
                      )}
                      <Part4Form
                        inspection={inspection}
                        onComplete={fetchInspection}
                        onSuccess={(msg) => showMessage('success', msg)}
                      />
                    </div>
                  );
                }
                if (inspectionPart4Saved(inspection)) {
                  return (
                    <div className="space-y-4">
                      {p4Approved && (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                          {(() => {
                            const th = resolvePart4TeamHeadSignoff(inspection);
                            return (
                              <>
                                <span className="font-medium">Approved by Team Head – QA:</span>{' '}
                                {th.name || '—'}
                                {th.designation ? ` (${th.designation})` : ''}
                                {th.approvedAt && (
                                  <span className="text-emerald-800/80 dark:text-emerald-300/90">
                                    {' '}
                                    · {fmtDate(th.approvedAt)}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                      <Part4Display inspection={inspection} />
                    </div>
                  );
                }
                if (blockedByPart3 && (isAssignedInspector || permissions.isAdmin())) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="font-medium">Complete Part III first</p>
                      <p className="text-sm mt-1">
                        This IR was forwarded to ORDAQA. ORDAQA Head must complete Part III Section 23
                        (assignee) before Part IV can be filled.
                      </p>
                    </div>
                  );
                }
                const skipPart23 = inspectionUsesLegacyOpenRqaPart4(inspection);
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="font-medium">Part IV is not yet available</p>
                    <p className="text-sm mt-1">
                      {skipPart23
                        ? permissions.userRole === 'inspector'
                          ? 'Part IV opens after Request Approver forward (Forwarded status)'
                          : 'Only an R&QA Inspector can fill Part IV when joint inspection was not requested in Part I'
                        : isAssignedInspector
                          ? 'You are assigned, but Part IV cannot be edited in the current status. Refresh the page or contact support if this persists.'
                          : hasInspectorsAssignedInsp(inspection)
                            ? 'Only inspectors assigned in Part II (shown above) can fill Part IV. Sign in as an assigned R&QA Inspector.'
                            : 'Inspector(s) must be assigned via Part II first'}
                    </p>
                  </div>
                );
              })()}

              {/* Final Approval Section */}
              <Separator className="my-4" />
              <h3 className="font-semibold text-base mb-3">Final Approvals</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 space-y-2">
                  {inspection.final_qa_approver_name ? (
                    <>
                  <h4 className="font-semibold text-sm text-muted-foreground">TH - QA Final Sign-off</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>{inspection.final_qa_approver_name}</strong> ({inspection.final_qa_approver_designation || '—'})</p>
                      <p className="text-muted-foreground">Date: {fmtDate(inspection.final_qa_approval_date)}</p>
                      {inspection.final_qa_approver_signature_path ? (
                        <img src={inspection.final_qa_approver_signature_path} alt="Final QA Signature" className="h-12 mt-1 object-contain" />
                      ) : (
                        <p className="text-green-700 dark:text-green-400 italic">✓ Approved</p>
                      )}
                    </div>
                    </>
                  ) : inspectionReadyForFinalTeamHeadApproval(inspection) ? (
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Awaiting <strong>Team Head – QA</strong> (R&amp;QA department, qa_approver role) to Approve &amp;
                      Close or Reject with a comment.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">TH - QA Final Sign-off pending</p>
                  )}
                </div>
                
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════ Part V — ORDAQA Sections 24–25 (after Part IV) ══════ */}
        <TabsContent value="part5" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Part V — ORDAQA (Sections 24–25)</CardTitle>
              <CardDescription>
                After Part IV — inspection remarks and clearance (assigned or delegated user from Part III Section 23)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const needsP5 = inspectionRequiresOrdqaPart5(inspection);
                const p3 = parseJsonObj(inspection.part3_data);
                const canFillP5 = canUserUpdatePart5(
                  inspection,
                  permissions.userId,
                  permissions.userRole
                );
                const hasAssignedPerson =
                  inspection.ordaqa_inspector_id != null &&
                  String(inspection.ordaqa_inspector_id).trim() !== '';
                const isAssignedPerson =
                  hasAssignedPerson &&
                  Number(inspection.ordaqa_inspector_id) === Number(permissions.userId) &&
                  Number(permissions.userId) > 0;
                const p5Submitted = ordqaPart5Submitted(inspection);
                const p5Approved = ordqaPart5Approved(inspection);

                if (!needsP5 || inspectionSkipsPart2Part3(inspection)) {
                  return (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <p className="font-medium">Part V — Not Applicable</p>
                      <p className="text-sm mt-1">
                        {inspectionSkipsPart2Part3(inspection)
                          ? 'Part I 19(f) joint inspection is No — ORDAQA Part V does not apply'
                          : 'Part I 19(f) joint inspection was not requested — ORDAQA Part V does not apply'}
                      </p>
                    </div>
                  );
                }

                if (!inspectionPart4Saved(inspection)) {
                  return (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <p className="font-medium">Complete Part IV first</p>
                      <p className="text-sm mt-1">
                        Sections 24–25 are filled after the R&amp;QA inspection report (Part IV) is saved.
                      </p>
                    </div>
                  );
                }

                if (!part4ApprovedByTeamHead(inspection)) {
                  return (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <p className="font-medium">
                        {part4PendingTeamHeadApproval(inspection)
                          ? 'Awaiting Team Head – QA approval of Part IV'
                          : 'Part IV must be approved before Part V'}
                      </p>
                      <p className="text-sm mt-1">
                        {part4RejectedByTeamHead(inspection)
                          ? 'Team Head – QA sent Part IV back. The R&QA Inspector must revise and resubmit.'
                          : 'Team Head – QA must Approve Part IV before Sections 24–25 can be filled.'}
                      </p>
                    </div>
                  );
                }

                if (p5Approved) {
                  return <Part5Display inspection={inspection} />;
                }

                if (p5Submitted) {
                  return (
                    <div className="space-y-4">
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        Part V saved — awaiting ORDAQA Head approval.
                      </div>
                      <Part5Display inspection={inspection} />
                      <div className="flex flex-wrap gap-2">
                        {canUserOrdqaHeadPart5SendBack(inspection, permissions.userRole) && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setPart5SendBackComment('');
                              setPart5SendBackDialogOpen(true);
                            }}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Send back to ORDAQA Inspector
                          </Button>
                        )}
                        {canUserApproveOrdqaPart5(inspection, permissions.userRole) && (
                          <Button onClick={() => handleWorkflowAction('approve_part5')}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve Part V
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                }

                // Ready to fill — assigned ORDAQA person / admin
                if (canFillP5 || isAssignedPerson) {
                  const p5Returned = ordqaPart5ReturnedToInspector(inspection);
                  const p5ReturnComment = getPart5HeadSendBackComment(inspection);
                  return (
                    <div className="space-y-4">
                      {p5Returned && p5ReturnComment && (
                        <div className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100">
                          <p className="font-medium">Part V sent back by ORDAQA Head</p>
                          <p className="mt-1 whitespace-pre-wrap text-violet-900/90 dark:text-violet-200/90">
                            {p5ReturnComment}
                          </p>
                          <p className="mt-2 text-xs text-violet-800/80 dark:text-violet-300/90">
                            Revise Sections 24–25 below, then save Part V again for ORDAQA Head approval.
                          </p>
                        </div>
                      )}
                      <Part5Form
                        key={`part5-form-${inspection.id}`}
                        inspection={inspection}
                        inspectionId={inspection.id}
                        onComplete={fetchInspection}
                      />
                    </div>
                  );
                }

                if (hasAssignedPerson) {
                  const delegationType = p3.delegation_type;
                  const personLabel =
                    delegationType === 'delegated'
                      ? (inspection.ordaqa_inspector_name || 'Delegated user')
                      : (inspection.ordaqa_inspector_name || 'ORDAQA Inspector');
                  return (
                    <div className="text-center py-8 text-muted-foreground border rounded-lg">
                      <p className="font-medium">Sections 24–25 — Awaiting assignee</p>
                      <p className="text-sm mt-1">Assigned to: {personLabel}</p>
                      <p className="text-xs mt-2">
                        Only the assigned ORDAQA Inspector can fill Part V.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg">
                    <p className="font-medium">Part V is not yet available</p>
                    <p className="text-sm mt-1">
                      ORDAQA Head must complete Part III Section 23 and assign an ORDAQA Inspector first.
                    </p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keep Checklists as a hidden secondary reference */}
        <TabsContent value="checklists" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inspection Checklists</CardTitle>
                  <CardDescription>
                    Track inspection items and compliance
                  </CardDescription>
                </div>
                {inspection.status === 'in_progress' && permissions.canCreate('checklist') && (
                  <Button size="sm" onClick={() => setShowAddChecklistDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Checklist
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {inspection.checklists.length > 0 ? (
                <div className="space-y-4">
                  {inspection.checklists.map((checklist) => (
                    <div key={checklist.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{checklist.name}</h4>
                          {checklist.description && (
                            <p className="text-sm text-muted-foreground mt-1">{checklist.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={checklist.is_completed ? 'default' : 'secondary'}>
                            {checklist.is_completed ? 'Completed' : 'In Progress'}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleViewChecklist(checklist)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {inspection.status === 'in_progress' && permissions.checkPermission('checklist', 'update') && (
                                <>
                                  <DropdownMenuItem onClick={() => handleOpenEditChecklist(checklist)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  {permissions.checkPermission('checklist', 'delete') && (
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => handleDeleteChecklist(checklist.id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No checklists created yet</p>
                  {inspection.status === 'in_progress' && (
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddChecklistDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Checklist
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attachments" className="space-y-4">
          {(() => {
            const irCompleted = ['completed', 'closed'].includes(inspection.status);
            // Inspectors (R&QA and ORDAQA) — view/download only; no upload/delete on IR attachments
            const isInspectorRole =
              permissions.userRole === 'inspector' ||
              permissions.userRole === 'ordaqa_inspector';
            const canManageAttachments =
              !isInspectorRole &&
              !irCompleted &&
              (permissions.isAdmin() ||
                (permissions.isInitiator() &&
                  inspection.initiator_id != null &&
                  Number(inspection.initiator_id) === permissions.userId));
            return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Attachments</CardTitle>
                  <CardDescription>
                    {canManageAttachments
                      ? 'Photos, documents, and evidence files (max 20 MB each)'
                      : irCompleted
                        ? 'This IR is completed — attachments are read-only'
                        : isInspectorRole
                          ? 'View and download only'
                          : 'Attachments are read-only for your role'}
                  </CardDescription>
                </div>
                {canManageAttachments && (
                <div className="flex items-center gap-2">
                  {uploadingFiles && (
                    <span className="text-xs text-muted-foreground animate-pulse">
                      Uploading {uploadProgress.done}/{uploadProgress.total}…
                    </span>
                  )}
                  <Input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    onChange={handleFileUpload}
                  />
                  <Button size="sm" disabled={uploadingFiles} onClick={() => document.getElementById('file-upload')?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingFiles ? 'Uploading…' : 'Upload Files'}
                  </Button>
                </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {inspection.attachments.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inspection.attachments.map((attachment) => (
                    <div key={attachment.id} className="p-4 border rounded-lg flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Paperclip className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.uploaded_by_name} • {fmtDate(attachment.created_at)}
                          {attachment.file_size ? ` • ${(attachment.file_size / 1024).toFixed(0)} KB` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <a href={attachment.file_path} download target="_blank">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Paperclip className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No attachments uploaded yet</p>
                  {canManageAttachments && (
                    <p className="text-xs text-muted-foreground mt-1">Click &quot;Upload Files&quot; to attach multiple files at once</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
            );
          })()}
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>
                Real-time inspection activity and updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspection.activities.length > 0 ? (
                <div className="space-y-4">
                  {inspection.activities.map((activity) => {
                    const isPart1EditActivity = activity.activity_type === 'part1_edited';
                    // Hide detailed field diffs from non-initiators
                    const activityDescription =
                      isPart1EditActivity && !canSeePart1CertifierEdits
                        ? 'Part I was updated by Request Approver.'
                        : activity.description;
                    return (
                    <div key={activity.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <ActivityIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="w-px h-full bg-border mt-2"></div>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex items-start gap-2 mb-1">
                          <p className="font-semibold text-sm whitespace-pre-wrap flex-1">
                            {activityDescription}
                          </p>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {activity.activity_type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {activity.user_name} • {fmtDateTime(activity.created_at)}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <ActivityIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No activity recorded yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Checklist Dialog */}
      <Dialog open={showAddChecklistDialog} onOpenChange={setShowAddChecklistDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Inspection Checklist</DialogTitle>
            <DialogDescription>
              Create a new checklist with items to track during this inspection
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateChecklist} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="checklist-name">Checklist Name *</Label>
                <Input
                  id="checklist-name"
                  value={checklistForm.name}
                  onChange={(e) => setChecklistForm({ ...checklistForm, name: e.target.value })}
                  placeholder="e.g., Safety Inspection Checklist"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checklist-description">Description</Label>
                <Textarea
                  id="checklist-description"
                  value={checklistForm.description}
                  onChange={(e) => setChecklistForm({ ...checklistForm, description: e.target.value })}
                  placeholder="Brief description of what this checklist covers"
                  rows={3}
                />
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Checklist Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddChecklistFormItem}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {checklistForm.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                          {checklistForm.items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-auto text-destructive hover:text-destructive"
                              onClick={() => handleRemoveChecklistItem(index)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Input
                            value={item.description}
                            onChange={(e) => handleChecklistItemChange(index, 'description', e.target.value)}
                            placeholder="Item description (e.g., Check fire extinguisher pressure)"
                            className="text-sm"
                          />
                          <Input
                            value={item.category}
                            onChange={(e) => handleChecklistItemChange(index, 'category', e.target.value)}
                            placeholder="Category (optional, e.g., Safety, Compliance)"
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Add at least one item to your checklist. Empty items will be ignored.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowAddChecklistDialog(false);
                  setChecklistForm({
                    name: '',
                    description: '',
                    items: [{ description: '', category: '' }],
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Create Checklist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Checklist Dialog */}
      <Dialog open={showViewChecklistDialog} onOpenChange={setShowViewChecklistDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist Details</DialogTitle>
            <DialogDescription>
              View checklist information and items
            </DialogDescription>
          </DialogHeader>
          
          {loadingChecklist ? (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading...</p>
            </div>
          ) : selectedChecklist ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedChecklist.name}</h3>
                  <div className="flex items-center gap-3">
                    <Badge variant={selectedChecklist.is_completed ? 'default' : 'secondary'}>
                      {selectedChecklist.is_completed ? 'Completed' : 'In Progress'}
                    </Badge>
                    {inspection?.status === 'in_progress' && permissions.canUpdate('checklist') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleChecklistComplete}
                      >
                        {selectedChecklist.is_completed ? 'Reopen Checklist' : 'Mark Complete'}
                      </Button>
                    )}
                  </div>
                </div>
                {selectedChecklist.description && (
                  <p className="text-sm text-muted-foreground">{selectedChecklist.description}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Checklist Items ({checklistItems.length})</h4>
                  {inspection?.status === 'in_progress' && permissions.checkPermission('checklist_item', 'create') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddItemDialog(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Item
                    </Button>
                  )}
                </div>
                {checklistItems.length > 0 ? (
                  <div className="space-y-2">
                    {checklistItems.map((item: any) => (
                      <div key={item.id} className="p-3 border rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            <Badge variant="outline" className="text-xs mt-0.5">#{item.item_number}</Badge>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{item.description}</p>
                              {item.category && (
                                <p className="text-xs text-muted-foreground mt-1">Category: {item.category}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={
                                item.status === 'passed' ? 'default' :
                                item.status === 'failed' ? 'destructive' :
                                'secondary'
                              }
                              className="text-xs"
                            >
                              {item.status || 'pending'}
                            </Badge>
                            {inspection?.status === 'in_progress' && permissions.checkPermission('checklist_item', 'update') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditItem(item)}
                                className="h-7 px-2"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {item.findings && (
                          <div className="pl-8 text-xs">
                            <span className="text-muted-foreground">Findings: </span>
                            <span>{item.findings}</span>
                          </div>
                        )}
                        {item.corrective_action && (
                          <div className="pl-8 text-xs">
                            <span className="text-muted-foreground">Corrective Action: </span>
                            <span>{item.corrective_action}</span>
                          </div>
                        )}
                        {item.inspector_notes && (
                          <div className="pl-8 text-xs">
                            <span className="text-muted-foreground">Notes: </span>
                            <span>{item.inspector_notes}</span>
                          </div>
                        )}
                        {item.checked_by_name && (
                          <p className="text-xs text-muted-foreground pl-8">
                            Checked by: {item.checked_by_name} on {fmtDateTime(item.checked_at)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No items in this checklist</p>
                )}
              </div>

              {selectedChecklist.completed_at && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Completed: {fmtDateTime(selectedChecklist.completed_at)}
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground">No checklist selected</p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewChecklistDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Checklist Dialog */}
      <Dialog open={showEditChecklistDialog} onOpenChange={setShowEditChecklistDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Checklist</DialogTitle>
            <DialogDescription>
              Update checklist information
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleUpdateChecklist} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-checklist-name">Checklist Name *</Label>
                <Input
                  id="edit-checklist-name"
                  value={editChecklistForm.name}
                  onChange={(e) => setEditChecklistForm({ ...editChecklistForm, name: e.target.value })}
                  placeholder="e.g., Safety Inspection Checklist"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-checklist-description">Description</Label>
                <Textarea
                  id="edit-checklist-description"
                  value={editChecklistForm.description}
                  onChange={(e) => setEditChecklistForm({ ...editChecklistForm, description: e.target.value })}
                  placeholder="Brief description of what this checklist covers"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="is-completed">Mark as Completed</Label>
                  <p className="text-sm text-muted-foreground">
                    Toggle to mark this checklist as completed
                  </p>
                </div>
                <Switch
                  id="is-completed"
                  checked={editChecklistForm.is_completed}
                  onCheckedChange={(checked) => setEditChecklistForm({ ...editChecklistForm, is_completed: checked })}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Note: To edit checklist items, please use the checklist items management section.
              </p>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowEditChecklistDialog(false);
                  setSelectedChecklist(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                <Edit className="mr-2 h-4 w-4" />
                Update Checklist
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Checklist Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Checklist Item</DialogTitle>
            <DialogDescription>
              Add a new item to {selectedChecklist?.name}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddChecklistItem} className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item-description">Item Description *</Label>
                <Textarea
                  id="item-description"
                  value={newItemForm.description}
                  onChange={(e) => setNewItemForm({ ...newItemForm, description: e.target.value })}
                  placeholder="e.g., Check fire extinguisher pressure gauge"
                  rows={3}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-category">Category (Optional)</Label>
                <Input
                  id="item-category"
                  value={newItemForm.category}
                  onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
                  placeholder="e.g., Safety, Compliance, Quality"
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowAddItemDialog(false);
                  setNewItemForm({ description: '', category: '' });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Checklist Item Dialog */}
      <Dialog open={showEditItemDialog} onOpenChange={setShowEditItemDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Checklist Item</DialogTitle>
            <DialogDescription>
              Update the status and details for this checklist item
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <form onSubmit={handleUpdateChecklistItem} className="space-y-4">
              <div className="space-y-4">
                {/* Item Info */}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Item #{selectedItem.item_number}: {selectedItem.description}
                  </p>
                  {selectedItem.category && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Category: {selectedItem.category}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="item-status">Status *</Label>
                  <Select
                    value={editItemForm.status}
                    onValueChange={(value) => {
                      setEditItemForm({ 
                        ...editItemForm, 
                        status: value,
                        is_compliant: value === 'passed' ? true : value === 'failed' ? false : null
                      });
                    }}
                  >
                    <SelectTrigger id="item-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="passed">Passed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="na">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Compliance */}
                <div className="space-y-2">
                  <Label>Compliance Status</Label>
                  <div className="flex items-center gap-4 p-3 border rounded-lg">
                    <p className="text-sm flex-1">
                      {editItemForm.is_compliant === true ? '✅ Compliant' :
                       editItemForm.is_compliant === false ? '❌ Non-Compliant' :
                       '⚪ Not Determined'}
                    </p>
                    <Badge variant={
                      editItemForm.is_compliant === true ? 'default' :
                      editItemForm.is_compliant === false ? 'destructive' :
                      'secondary'
                    }>
                      {editItemForm.is_compliant === true ? 'Yes' :
                       editItemForm.is_compliant === false ? 'No' :
                       'Pending'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Compliance is automatically set based on status (Passed = Compliant, Failed = Non-Compliant)
                  </p>
                </div>

                {/* Findings */}
                <div className="space-y-2">
                  <Label htmlFor="item-findings">Findings</Label>
                  <Textarea
                    id="item-findings"
                    value={editItemForm.findings}
                    onChange={(e) => setEditItemForm({ ...editItemForm, findings: e.target.value })}
                    placeholder="Describe what was found during inspection..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Document any observations, issues, or noteworthy points
                  </p>
                </div>

                {/* Corrective Action */}
                <div className="space-y-2">
                  <Label htmlFor="item-corrective">Corrective Action Required</Label>
                  <Textarea
                    id="item-corrective"
                    value={editItemForm.corrective_action}
                    onChange={(e) => setEditItemForm({ ...editItemForm, corrective_action: e.target.value })}
                    placeholder="What actions need to be taken to address any issues..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Specify what needs to be done to fix any problems found
                  </p>
                </div>

                {/* Inspector Notes */}
                <div className="space-y-2">
                  <Label htmlFor="item-notes">Inspector Notes</Label>
                  <Textarea
                    id="item-notes"
                    value={editItemForm.inspector_notes}
                    onChange={(e) => setEditItemForm({ ...editItemForm, inspector_notes: e.target.value })}
                    placeholder="Additional notes or comments..."
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowEditItemDialog(false);
                    setSelectedItem(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Update Item
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Part II — R&QA Office Use  (Section 22)
   ═══════════════════════════════════════════════════════ */

function Part2Display({ inspection }: { inspection: InspectionRequest }) {
  const d = parseJsonObj(inspection.part2_data);
  const assignedInspectors = resolveAssignedInspectorsForDisplay(inspection);
  const part2Submitted = !!(inspection.qa_approver_id || inspection.nominated_team_head_id || inspection.part2_date);
  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr><td className="bg-muted/50 px-4 py-2.5 font-medium w-[250px]" colSpan={2}><strong>22. Head R&QA Comments</strong></td></tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Head R&QA Comments</td>
              <td className="px-4 py-2.5 whitespace-pre-wrap">{d.head_rqa_comments || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Return to Designer</td>
              <td className="px-4 py-2.5">
                {!part2Submitted ? '—' : d.return_to_designer === 'yes' ? (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">Yes</Badge>
                ) : (
                  'No'
                )}
              </td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Forward to ORDAQA for Joint Inspection</td>
              <td className="px-4 py-2.5">
                {!part2Submitted ? '—' : inspection.forwarded_to_ordaqa ? (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">Yes — Forwarded</Badge>
                ) : (
                  'No'
                )}
              </td>
            </tr>
            <tr><td className="bg-muted/50 px-4 py-2.5 font-medium" colSpan={2}><strong>Nominated Officer/Staff for the Job</strong></td></tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Team Head</td>
              <td className="px-4 py-2.5">
                {inspection.nominated_team_head_name || d.nominated_team_head || '—'}
                {inspection.nominated_team_head_employee_id && <span className="text-muted-foreground ml-2">({inspection.nominated_team_head_employee_id})</span>}
              </td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Team Head – QA Comments</td>
              <td className="px-4 py-2.5 whitespace-pre-wrap">{d.team_head_comments || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">R&QA Rep (Inspector / QA Rep)</td>
              <td className="px-4 py-2.5">
                {assignedInspectors.length > 0 ? (
                  <div className="space-y-1">
                    {assignedInspectors.map((insp, i) => {
                      const highlightedById =
                        inspection.part4_completed_by != null &&
                        insp.id != null &&
                        Number(insp.id) === Number(inspection.part4_completed_by);
                      const highlighted =
                        highlightedById ||
                        shouldHighlightInspectorName(
                          insp.name,
                          inspection,
                          resolveStartCompleteInspectorName(inspection)
                        );
                      return (
                        <div key={insp.id ?? i}>
                          <span
                            className={
                              highlighted
                                ? 'font-semibold text-emerald-800 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded'
                                : 'font-medium'
                            }
                          >
                            {insp.name}
                          </span>
                          {insp.employee_id && <span className="text-muted-foreground ml-1">({insp.employee_id})</span>}
                          {insp.designation && <span className="text-muted-foreground ml-1">— {insp.designation}</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : part2Submitted ? (
                  <span className="text-amber-600 dark:text-amber-400">Pending — Team Head to assign</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Third Party Inspection Agency</td>
              <td className="px-4 py-2.5">{d.third_party_agency || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Outstation Inspection</td>
              <td className="px-4 py-2.5">
                {!part2Submitted ? (
                  '—'
                ) : d.outstation_inspection ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Yes</Badge>
                ) : (
                  'No'
                )}
              </td>
            </tr>
            {!!d.outstation_inspection && (
              <tr>
                <td className="bg-muted/50 px-4 py-2.5 font-medium">Email Sent</td>
                <td className="px-4 py-2.5">
                  {d.email_sent || '—'}
                  {d.email_sent_by ? ` — ${d.email_sent_by}` : ''}
                  {d.email_sent_date ? ` (${d.email_sent_date})` : ''}
                </td>
              </tr>
            )}
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Head R&QA Name & Signature</td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-medium">{inspection.qa_approver_name || '—'}</span>
                    {inspection.part2_date && <span className="text-muted-foreground ml-2">({fmtDate(inspection.part2_date)})</span>}
                  </div>
                  {inspection.qa_approver_signature_path ? (
                    <img src={inspection.qa_approver_signature_path} alt="QA Head Signature" className="h-10 object-contain" />
                  ) : inspection.qa_approver_name ? (
                    <span className="text-green-700 dark:text-green-400 italic text-xs">✓ Digitally Signed</span>
                  ) : null}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Part2Step1Form({
  inspectionId,
  inspection,
  lockTeamHeadSelection = false,
  memoResubmit = false,
  disableForwardToOrdqa = false,
  onComplete,
  onSuccess,
}: {
  inspectionId: number;
  inspection?: InspectionRequest | null;
  lockTeamHeadSelection?: boolean;
  /** After ORDAQA memo return — QA Head must re-enable Forward to ORDAQA and resubmit. */
  memoResubmit?: boolean;
  /** Part I 19(f) No — Team Head selection only; hide Forward to ORDAQA. */
  disableForwardToOrdqa?: boolean;
  onComplete: () => Promise<void> | void;
  onSuccess?: (message: string) => void;
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    head_rqa_comments: '',
    return_to_designer: 'no',
    forward_to_dgaqa: false,
    nominated_team_head_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [forwardSuccessOpen, setForwardSuccessOpen] = useState(false);
  const [forwardSuccessName, setForwardSuccessName] = useState('');

  useEffect(() => {
    const q = new URLSearchParams({
      status: 'active',
      department: 'R&QA',
      designation: 'TH',
      role: 'qa_approver',
    });
    fetch(`/api/users?${q}`)
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!inspection) return;
    const d = parseJsonObj(inspection.part2_data);
    setForm({
      head_rqa_comments: (inspection.part2_notes as string) || String(d.head_rqa_comments || ''),
      return_to_designer: memoResubmit ? 'no' : d.return_to_designer === 'yes' ? 'yes' : 'no',
      // After ORDAQA memo return, pre-enable Forward so QA Head can resubmit immediately
      forward_to_dgaqa: disableForwardToOrdqa
        ? false
        : memoResubmit
          ? true
          : !!inspection.forwarded_to_ordaqa,
      nominated_team_head_id: inspection.nominated_team_head_id ? String(inspection.nominated_team_head_id) : '',
    });
  }, [
    inspection?.id,
    inspection?.part2_data,
    inspection?.nominated_team_head_id,
    inspection?.forwarded_to_ordaqa,
    inspection?.part2_notes,
    memoResubmit,
    disableForwardToOrdqa,
  ]);

  const teamHeads = (() => {
    const list = [...users];
    const nominatedId = inspection?.nominated_team_head_id;
    if (nominatedId != null && !list.some((u) => u.id === nominatedId)) {
      list.unshift({
        id: nominatedId,
        employee_id: inspection?.nominated_team_head_employee_id,
        name: inspection?.nominated_team_head_name || 'Nominated Team Head',
      });
    }
    return list;
  })();
  const blockReturnToDesigner = inspection != null && inspection.status !== 'request_approved';

  const handleSubmit = async () => {
    // Memo resubmit may allow return-to-designer choice in UI; otherwise block when status is past forwarded
    const returnChoice =
      form.return_to_designer === 'yes' && (memoResubmit || !blockReturnToDesigner) ? 'yes' : 'no';
    if (returnChoice !== 'yes' && !form.nominated_team_head_id) {
      return alert('Please select a Team Head - QA');
    }
    if (returnChoice === 'yes' && !form.head_rqa_comments.trim()) {
      return alert('Head R&QA comments are required when returning the inspection request to the designer');
    }
    if (memoResubmit && !disableForwardToOrdqa && returnChoice !== 'yes' && !form.forward_to_dgaqa) {
      return alert('Turn on Forward to ORDAQA for Joint Inspection to resubmit Part II after memo return');
    }
    setLoading(true);
    try {
      const pickId = form.nominated_team_head_id
        ? parseInt(form.nominated_team_head_id, 10)
        : null;
      const selectedTH =
        pickId != null && Number.isFinite(pickId)
          ? teamHeads.find((u) => u.id === pickId) ?? users.find((u) => u.id === pickId)
          : undefined;
      const res = await fetch(`/api/inspection-requests/${inspectionId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_part2_step1',
          nominated_team_head_id: returnChoice === 'yes' ? (pickId || null) : pickId,
          forward_to_ordaqa:
            disableForwardToOrdqa || returnChoice === 'yes' ? false : form.forward_to_dgaqa,
          part2_notes: form.head_rqa_comments,
          part2_data: {
            head_rqa_comments: form.head_rqa_comments,
            return_to_designer: returnChoice,
            nominated_team_head: selectedTH?.name || '',
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await onComplete();
        if (returnChoice === 'yes') {
          setSaveMsg(data.message || 'Returned to designer');
        } else if (memoResubmit && form.forward_to_dgaqa) {
          setSaveMsg('');
          onSuccess?.(data.message || 'Part II resubmitted — forwarded to ORDAQA again');
        } else {
          const name = data.nominated_team_head_name || selectedTH?.name || 'Team Head - QA';
          setForwardSuccessName(name);
          setForwardSuccessOpen(true);
          setSaveMsg('');
          onSuccess?.(data.message || `Inspection request forwarded to ${name}`);
        }
      } else {
        setSaveMsg(data.error || 'Failed');
      }
    } catch { setSaveMsg('Error saving'); } finally { setLoading(false); }
  };

  const sel = "w-full px-3 py-2 text-sm rounded-md border border-input bg-background";

  return (
    <div id="part2-fill-form" className="space-y-5 scroll-mt-20">
      <Dialog open={forwardSuccessOpen} onOpenChange={setForwardSuccessOpen}>
        <DialogContent className="sm:max-w-md border-green-200 dark:border-green-800">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-green-800 dark:text-green-200">
                  Forwarded to Team Head
                </DialogTitle>
                <DialogDescription className="text-green-700 dark:text-green-300">
                  Inspection request has been forwarded to{' '}
                  <span className="font-semibold text-green-900 dark:text-green-100">
                    {forwardSuccessName}
                  </span>
                  . They will be notified to assign Inspector(s).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setForwardSuccessOpen(false)}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {saveMsg && (
        <div
          className={`px-3 py-2 rounded-md text-sm border ${
            /fail|error|forbidden|required|invalid|select|must/i.test(saveMsg)
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
          }`}
        >
          {saveMsg}
        </div>
      )}
      <h4 className="font-semibold text-sm text-muted-foreground">22. Head R&QA Comments</h4>
      <div className="space-y-2">
        <Label>Comments</Label>
        <Textarea rows={3} value={form.head_rqa_comments} onChange={e => setForm({...form, head_rqa_comments: e.target.value})} placeholder="Head R&QA comments on the inspection request..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Inspection Request to be returned to Designer?</Label>
          <select
            value={form.return_to_designer}
            onChange={e => {
              const v = e.target.value;
              setForm(prev => ({
                ...prev,
                return_to_designer: v,
                ...(v === 'yes' ? { forward_to_dgaqa: false } : memoResubmit ? { forward_to_dgaqa: true } : {}),
              }));
            }}
            className={sel}
            disabled={blockReturnToDesigner && !memoResubmit}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
          {blockReturnToDesigner && !memoResubmit && (
            <p className="text-xs text-muted-foreground">
              Return to designer is only available while the IR is in Forwarded status (before inspection start).
            </p>
          )}
          {memoResubmit && (
            <p className="text-xs text-muted-foreground">
              Keep <strong>No</strong> and use <strong>Forward to ORDAQA</strong> to resubmit. Choose <strong>Yes</strong> only to send back for Part I corrections.
            </p>
          )}
        </div>
        <div className={`flex flex-col gap-1.5 pt-6 ${form.return_to_designer === 'yes' || disableForwardToOrdqa ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-3">
            <Switch
              checked={
                disableForwardToOrdqa || form.return_to_designer === 'yes'
                  ? false
                  : form.forward_to_dgaqa
              }
              disabled={disableForwardToOrdqa || form.return_to_designer === 'yes'}
              onCheckedChange={v => setForm({ ...form, forward_to_dgaqa: v })}
              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
            />
            <Label className={form.return_to_designer === 'yes' || disableForwardToOrdqa ? 'text-muted-foreground cursor-not-allowed' : ''}>
              Forward to ORDAQA for Joint Inspection
              {memoResubmit && !disableForwardToOrdqa ? <span className="text-destructive"> *</span> : null}
            </Label>
          </div>
          {disableForwardToOrdqa && (
            <p className="text-xs text-muted-foreground pl-11">
              Not available — Part I 19(f) joint inspection is No.
            </p>
          )}
          {memoResubmit && !disableForwardToOrdqa && form.return_to_designer !== 'yes' && (
            <p className="text-xs text-muted-foreground pl-11">
              Required to resubmit after ORDAQA memo return. Pre-selected for you — click <strong>Resubmit Part II to ORDAQA</strong> when ready.
            </p>
          )}
        </div>
      </div>

      <Separator />
      <h4 className="font-semibold text-sm text-muted-foreground">
        Nominated Officer/Staff for the Job
        {form.return_to_designer === 'yes' && !blockReturnToDesigner ? (
          <span className="font-normal text-muted-foreground"> (optional when returning to designer)</span>
        ) : null}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`space-y-2 ${form.return_to_designer === 'yes' ? 'opacity-70' : ''}`}>
          <Label>
            Team Head - QA
            {form.return_to_designer === 'yes' ? '' : ' *'}
          </Label>
          <select
            value={form.nominated_team_head_id}
            onChange={e => setForm({ ...form, nominated_team_head_id: e.target.value })}
            className={sel}
            disabled={lockTeamHeadSelection}
          >
            <option value="">Select Team Head - QA...</option>
            {teamHeads.map(u => (
              <option key={u.id} value={u.id}>
                {[u.employee_id, u.name, u.designation].filter(Boolean).join(' — ')}
              </option>
            ))}
          </select>
          {teamHeads.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-300">Loading Team Head – QA list…</p>
          )}
          {lockTeamHeadSelection && (
            <p className="text-xs text-muted-foreground">Nominated Team Head is fixed while inspectors are assigned.</p>
          )}
          {!lockTeamHeadSelection && memoResubmit && (
            <p className="text-xs text-muted-foreground">
              All active R&amp;QA Team Heads (TH) are listed. Change if needed before resubmit.
            </p>
          )}
          {form.return_to_designer === 'yes' && (
            <p className="text-xs text-muted-foreground">
              Not required when returning the inspection request to the designer.
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={
          loading ||
          (form.return_to_designer !== 'yes' && !form.nominated_team_head_id) ||
          (form.return_to_designer === 'yes' && !form.head_rqa_comments.trim()) ||
          (memoResubmit && form.return_to_designer !== 'yes' && !form.forward_to_dgaqa)
        }
        className="mt-4"
      >
        {loading
          ? 'Saving...'
          : form.return_to_designer === 'yes'
            ? 'Return to designer'
            : memoResubmit
              ? 'Resubmit Part II to ORDAQA'
              : inspection?.nominated_team_head_id
                ? 'Save Part II updates'
                : 'Save Part II & Forward to TH'}
      </Button>
    </div>
  );
}

function Part2Step2Form({
  inspection,
  onComplete,
  onSuccess,
  mode = 'assign',
}: {
  inspection: InspectionRequest;
  onComplete: () => Promise<void> | void;
  onSuccess?: (message: string) => void;
  mode?: 'assign' | 'edit';
}) {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedInspectors, setSelectedInspectors] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const emailSentRef = useRef<HTMLSelectElement | null>(null);
  const emailSentByRef = useRef<HTMLInputElement | null>(null);
  const emailSentDateRef = useRef<HTMLInputElement | null>(null);
  const submitErrorRef = useRef<HTMLDivElement | null>(null);
  const d = parseJsonObj(inspection.part2_data);
  const [agencyForm, setAgencyForm] = useState({
    third_party_agency: String(d.third_party_agency || ''),
    outstation_inspection: !!d.outstation_inspection,
    email_sent: String(d.email_sent || 'no'),
    email_sent_by: String(d.email_sent_by || ''),
    email_sent_date: String(d.email_sent_date || ''),
    team_head_comments: String(d.team_head_comments || ''),
  });

  useEffect(() => {
    fetch('/api/users?status=active')
      .then(r => r.json())
      .then(d => setUsers(d.users || []))
      .catch(() => {});
    try {
      const raw = inspection.inspector_ids;
      const parsed =
        typeof raw === 'string'
          ? JSON.parse(raw || '[]')
          : Array.isArray(raw)
            ? raw
            : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSelectedInspectors(
          [...new Set(parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))]
        );
      } else if (inspection.inspector_id) {
        setSelectedInspectors([Number(inspection.inspector_id)]);
      }
    } catch {
      /* ignore */
    }
  }, [inspection.id, inspection.inspector_ids, inspection.inspector_id]);

  useEffect(() => {
    // Only hydrate from server when opening this IR — do not reset on poll/refresh
    // (otherwise Outstation Inspection toggles off before Save).
    const p2 = parseJsonObj(inspection.part2_data);
    setAgencyForm({
      third_party_agency: String(p2.third_party_agency || ''),
      outstation_inspection: !!p2.outstation_inspection,
      email_sent: String(p2.email_sent || 'no'),
      email_sent_by: String(p2.email_sent_by || ''),
      email_sent_date: String(p2.email_sent_date || ''),
      team_head_comments: String(p2.team_head_comments || ''),
    });
    setFieldErrors({});
  }, [inspection.id]);

  const inspectors = users.filter(u => u.role === 'inspector');

  const toggleInspector = (id: number) => {
    const n = Number(id);
    if (!Number.isFinite(n) || n <= 0) return;
    setSelectedInspectors((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  };

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validatePart2Step2 = (): { errors: Record<string, string>; firstKey: string | null; message: string } => {
    const errors: Record<string, string> = {};
    if (selectedInspectors.length === 0) {
      errors.inspectors = 'Select at least one Inspector / QA Rep';
    }
    if (agencyForm.outstation_inspection) {
      if (!agencyForm.email_sent || !['yes', 'no'].includes(agencyForm.email_sent)) {
        errors.email_sent = 'Email Sent is required';
      }
      if (!agencyForm.email_sent_by.trim()) {
        errors.email_sent_by = 'Name & Sign is required';
      }
      if (!agencyForm.email_sent_date.trim()) {
        errors.email_sent_date = 'Date & Time is required';
      }
    }
    const firstKey = Object.keys(errors)[0] || null;
    const message = firstKey
      ? firstKey.startsWith('email_') || firstKey === 'email_sent'
        ? `Outstation Inspection: ${errors[firstKey]}`
        : errors[firstKey]
      : '';
    return { errors, firstKey, message };
  };

  const focusFirstError = (firstKey: string | null) => {
    const el =
      firstKey === 'email_sent'
        ? emailSentRef.current
        : firstKey === 'email_sent_by'
          ? emailSentByRef.current
          : firstKey === 'email_sent_date'
            ? emailSentDateRef.current
            : submitErrorRef.current;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el && 'focus' in el && typeof (el as HTMLElement).focus === 'function') {
      try {
        (el as HTMLElement).focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    }
  };

  const handleSubmit = async () => {
    const { errors, firstKey, message } = validatePart2Step2();
    if (firstKey) {
      setFieldErrors(errors);
      setSaveMsg(message);
      // Defer scroll so the error banner near the button is painted first
      requestAnimationFrame(() => focusFirstError(firstKey));
      return;
    }
    setLoading(true);
    setSaveMsg('');
    setFieldErrors({});
    try {
      const res = await fetch(`/api/inspection-requests/${inspection.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_inspector',
          inspector_ids: selectedInspectors,
          part2_data: {
            third_party_agency: agencyForm.third_party_agency,
            outstation_inspection: agencyForm.outstation_inspection,
            email_sent: agencyForm.outstation_inspection ? agencyForm.email_sent : null,
            email_sent_by: agencyForm.outstation_inspection ? agencyForm.email_sent_by.trim() : null,
            email_sent_date: agencyForm.outstation_inspection ? agencyForm.email_sent_date : null,
            team_head_comments: agencyForm.team_head_comments.trim(),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Show toast before refresh so it stays visible for both Assign and Save Assignment.
        onSuccess?.('Assigned inspector saved');
        await onComplete();
        setSaveMsg('Assigned inspector saved');
      } else {
        setSaveMsg(data.error || 'Failed');
        requestAnimationFrame(() =>
          submitErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        );
      }
    } catch { setSaveMsg('Error saving'); } finally { setLoading(false); }
  };

  const sel = 'w-full px-3 py-2 text-sm rounded-md border border-input bg-background';
  const errInput = 'border-destructive focus-visible:ring-destructive';
  const isError = saveMsg && saveMsg !== 'Assigned inspector saved';

  return (
    <div id="part2-assign-form" className="space-y-5 scroll-mt-20">
      {saveMsg && !isError && (
        <div className="px-3 py-2 rounded-md border text-sm bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">
          {saveMsg}
        </div>
      )}

      <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
        <p className="text-sm font-medium text-foreground">Team Head – QA (after QA Head Part II)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Add your comments, then complete third-party / outstation details and inspector assignment.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Team Head – QA Comments</Label>
        <Textarea
          rows={3}
          value={agencyForm.team_head_comments}
          onChange={(e) => setAgencyForm({ ...agencyForm, team_head_comments: e.target.value })}
          placeholder="Comment"
        />
      </div>

      <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
        <p className="text-sm font-medium text-foreground">Third party / outstation — Part II (R&amp;QA Team Head)</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Fill third-party agency and outstation details as applicable.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Third Party Inspection Agency</Label>
        <Input
          value={agencyForm.third_party_agency}
          onChange={(e) => setAgencyForm({ ...agencyForm, third_party_agency: e.target.value })}
          placeholder="If applicable..."
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={agencyForm.outstation_inspection}
          onCheckedChange={(v) => {
            setAgencyForm((prev) => ({
              ...prev,
              outstation_inspection: v,
              email_sent: v ? prev.email_sent || 'no' : prev.email_sent,
            }));
            if (!v) setFieldErrors({});
          }}
          className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
        />
        <Label>Outstation Inspection</Label>
      </div>
      {agencyForm.outstation_inspection && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4 border-l-2 border-blue-200 dark:border-blue-800">
          <div className="space-y-2">
            <Label>
              Email Sent <span className="text-destructive">*</span>
            </Label>
            <select
              ref={emailSentRef}
              value={agencyForm.email_sent || 'no'}
              onChange={(e) => {
                setAgencyForm({ ...agencyForm, email_sent: e.target.value });
                clearFieldError('email_sent');
              }}
              className={`${sel} ${fieldErrors.email_sent ? errInput : ''}`}
              aria-invalid={!!fieldErrors.email_sent}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            {fieldErrors.email_sent && (
              <p className="text-xs text-destructive">{fieldErrors.email_sent}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              Name &amp; Sign <span className="text-destructive">*</span>
            </Label>
            <Input
              ref={emailSentByRef}
              value={agencyForm.email_sent_by}
              onChange={(e) => {
                setAgencyForm({ ...agencyForm, email_sent_by: e.target.value });
                clearFieldError('email_sent_by');
              }}
              className={fieldErrors.email_sent_by ? errInput : undefined}
              aria-invalid={!!fieldErrors.email_sent_by}
            />
            {fieldErrors.email_sent_by && (
              <p className="text-xs text-destructive">{fieldErrors.email_sent_by}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              Date &amp; Time <span className="text-destructive">*</span>
            </Label>
            <Input
              ref={emailSentDateRef}
              type="datetime-local"
              value={agencyForm.email_sent_date}
              onChange={(e) => {
                setAgencyForm({ ...agencyForm, email_sent_date: e.target.value });
                clearFieldError('email_sent_date');
              }}
              className={fieldErrors.email_sent_date ? errInput : undefined}
              aria-invalid={!!fieldErrors.email_sent_date}
            />
            {fieldErrors.email_sent_date && (
              <p className="text-xs text-destructive">{fieldErrors.email_sent_date}</p>
            )}
          </div>
        </div>
      )}

      <Separator />
      <h4 className="font-semibold text-sm text-muted-foreground">Assign Inspector / QA Rep(s) *</h4>
      <p className="text-xs text-muted-foreground">Select one or more inspectors for this inspection request.</p>

      <div
        className={`border rounded-lg max-h-60 overflow-y-auto ${
          fieldErrors.inspectors ? 'border-destructive' : ''
        }`}
      >
        {inspectors.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No inspectors available</p>
        ) : (
          inspectors.map(u => (
            <label key={u.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 ${selectedInspectors.includes(Number(u.id)) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
              <input
                type="checkbox"
                checked={selectedInspectors.includes(Number(u.id))}
                onChange={() => {
                  toggleInspector(Number(u.id));
                  clearFieldError('inspectors');
                }}
                className="rounded"
              />
              <span className="text-sm">{u.employee_id ? `${u.employee_id} - ` : ''}{u.name}</span>
              {(u.scientist_rank || u.designation) && (
                <span className="text-xs text-muted-foreground">({u.scientist_rank || u.designation})</span>
              )}
            </label>
          ))
        )}
      </div>
      {fieldErrors.inspectors && (
        <p className="text-xs text-destructive">{fieldErrors.inspectors}</p>
      )}

      {selectedInspectors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedInspectors.map(id => {
            const u = inspectors.find(x => x.id === id);
            return u ? (
              <Badge key={id} variant="secondary" className="gap-1">
                {u.name}
                <button onClick={() => toggleInspector(id)} className="ml-1 hover:text-destructive">×</button>
              </Badge>
            ) : null;
          })}
        </div>
      )}

      {isError && (
        <div
          ref={submitErrorRef}
          className="px-3 py-2 rounded-md border text-sm bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300"
          role="alert"
        >
          {saveMsg}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={loading || selectedInspectors.length === 0} className="mt-4">
        {loading
          ? 'Saving...'
          : mode === 'edit'
            ? `Save Inspector Assignment (${selectedInspectors.length})`
            : `Complete Part II — Assign ${selectedInspectors.length} Inspector(s)`}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Part V — ORDAQA Sections 24–25 (read-only)
   ═══════════════════════════════════════════════════════ */

function Part5Display({ inspection }: { inspection: InspectionRequest }) {
  const p3 = parseJsonObj(inspection.part3_data);
  const d = effectiveOrdqaPart5Data(inspection) as Record<string, any>;
  const remarks: any[] = Array.isArray(d.inspection_remarks) ? d.inspection_remarks : [];
  const { statusMap: threadStatus, refresh: refreshThreadStatus } = useObservationThreadStatus(inspection.id, true);
  const ordaqaSectionsSig =
    (d.ordaqa_sections_24_25_signature_path as string) ||
    inspection.part3_completed_by_signature_path ||
    null;
  const ordaqaRepReport = ordaqaRepReportDisplay(
    { ...d, delegation_type: p3.delegation_type, assigned_delegated_to: p3.assigned_delegated_to },
    inspection.ordaqa_inspector_name
  );
  const showOrdqaRepRow = p3.delegation_type === 'delegated' || Boolean(ordaqaRepReport);
  const signedBy = inspection.part3_completed_by_name;
  const signedDate = inspection.part3_date;
  const headApproved = ordqaPart5Approved(inspection);
  return (
    <div className="space-y-6">
      {headApproved && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
          <span className="font-medium">Approved by ORDAQA Head:</span>{' '}
          {inspection.ordaqa_approver_name || '—'}
          {inspection.ordaqa_approver_designation
            ? ` (${inspection.ordaqa_approver_designation})`
            : ''}
          {inspection.ordaqa_approval_date && (
            <span className="text-green-800/90 dark:text-green-300/90">
              {' '}
              — {fmtDate(inspection.ordaqa_approval_date)}
            </span>
          )}
        </div>
      )}
      {/* Section 24 — Inspection Remarks */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium" colSpan={5}>24. Inspection Remarks (Mechanical / Electrical / Other)</th>
            </tr>
            <tr className="bg-muted/30 text-xs">
              <th className="px-4 py-2 text-left w-[60px]">Sl. No</th>
              <th className="px-4 py-2 text-left">Observation</th>
              <th className="px-4 py-2 text-left">Action Required</th>
              <th className="px-4 py-2 text-left w-[120px]">Closed On</th>
              <th className="px-4 py-2 text-left w-[120px]">Signature</th>
              <th className="px-4 py-2 w-[70px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {remarks.length > 0 ? remarks.map((r: any, i: number) => {
              const remark = normalizeRemarkWithChatId({
                sl_no: String(r.sl_no ?? i + 1),
                observation: String(r.observation ?? ''),
                action_required: String(r.action_required ?? ''),
                closed_on: String(r.closed_on ?? ''),
                signature: String(r.signature ?? ''),
                chat_id: r.chat_id != null ? String(r.chat_id) : '',
              }) as ObservationRemarkRow;
              const chatKey = remark.chat_id || '';
              const closed = chatKey ? threadStatus[chatKey]?.isClosed : false;
              return (
              <tr key={i} className={closed ? 'opacity-50 bg-muted/30' : ''}>
                <td className="px-4 py-2.5">{r.sl_no || i + 1}</td>
                <td className="px-4 py-2.5 whitespace-pre-wrap">{r.observation || '—'}</td>
                <td className="px-4 py-2.5 whitespace-pre-wrap">{r.action_required || '—'}</td>
                <td className="px-4 py-2.5">{fmtDate(r.closed_on)}</td>
                <td className="px-4 py-2.5">{r.signature || '—'}</td>
                <td className="px-4 py-2.5">
                  <ObservationChatActions
                    inspectionRequestId={inspection.id}
                    part="part5"
                    remark={remark}
                    requestNumber={inspection.request_number}
                    initiatorName={inspection.initiator_name}
                    canClose={false}
                    threadMeta={chatKey ? threadStatus[chatKey] : null}
                    onRefreshThreadStatus={refreshThreadStatus}
                  />
                </td>
              </tr>
              );
            }) : (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-muted-foreground italic">No inspection remarks recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section 25 — Clearance Status */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr><td className="bg-muted/50 px-4 py-2.5 font-medium" colSpan={2}><strong>25. Clearance Status</strong></td></tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium w-[250px]">Status</td>
              <td className="px-4 py-2.5">
                <Badge className={d.clearance_status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' : d.clearance_status === 'rework' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'}>
                  {d.clearance_status === 'accepted' ? 'Accepted and Cleared' : d.clearance_status === 'rework' ? 'Rework' : 'Open'}
                </Badge>
              </td>
            </tr>
            
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">ORDAQA Approved Inspector</td>
              <td className="px-4 py-2.5">{d.dgaqa_inspector_name || '—'}</td>
            </tr>
            {showOrdqaRepRow && (
              <tr>
                <td className="bg-muted/50 px-4 py-2.5 font-medium">ORDAQA Rep (in case of delegation to R&QA)</td>
                <td className="px-4 py-2.5">{ordaqaRepReport || '—'}</td>
              </tr>
            )}
            {ordaqaSectionsSig && (
              <tr>
                <td className="bg-muted/50 px-4 py-2.5 font-medium align-top">Electronic signature (Sec. 24–25)</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-end gap-3">
                    <img src={ordaqaSectionsSig} alt="" className="h-14 max-w-[220px] object-contain border rounded bg-white p-1" />
                    <div className="text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">Signed by:</span>{' '}
                        {signedBy || '—'}
                      </div>
                      {signedDate && (
                        <div>
                          <span className="font-medium text-foreground">Date:</span> {fmtDate(signedDate)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {d.clearance_status === 'accepted' && (
        <p className="text-xs text-muted-foreground italic border-t pt-3">
          I hereby certify that material/part/installation/assembly/operation/stage has been fully inspected, tested and confirmed to the approved drawing/ATP and all technology requirements stipulated in relevant approved schedule. The stage is hereby recommended/not recommended for your further clearance/acceptance.
        </p>
      )}
    </div>
  );
}

function Part3Section23Display({ data, inspection }: { data: Record<string, any>; inspection: InspectionRequest }) {
  return (
    <div className="border rounded-lg overflow-hidden mb-4">
      <table className="w-full text-sm">
        <tbody className="divide-y">
          <tr><td className="bg-muted/50 px-4 py-2.5 font-medium" colSpan={2}><strong>23. ORDAQA Comments</strong></td></tr>
          <tr>
            <td className="bg-muted/50 px-4 py-2.5 font-medium w-[250px]">ORDAQA Comments</td>
            <td className="px-4 py-2.5 whitespace-pre-wrap">{data.ordaqa_comments || '—'}</td>
          </tr>
          <tr>
            <td className="bg-muted/50 px-4 py-2.5 font-medium">Received Date & Time</td>
            <td className="px-4 py-2.5">{formatReceivedDateTimeDisplay(data.received_date_time)}</td>
          </tr>
          <tr>
            <td className="bg-muted/50 px-4 py-2.5 font-medium">Memo to be Returned</td>
            <td className="px-4 py-2.5">
              <Badge className={data.memo_returned === 're_offer' ? 'bg-amber-100 text-amber-800' : data.memo_returned === 'yes' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                {data.memo_returned === 're_offer' ? 'Re-Offer' : data.memo_returned === 'yes' ? 'Yes' : 'No'}
              </Badge>
            </td>
          </tr>
          {data.memo_returned !== 'yes' && (
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">
                {data.delegation_type === 'assigned' ? 'Assigned to' : data.delegation_type === 'delegated' ? 'Delegated to' : 'Assigned / Delegated to'}
              </td>
              <td className="px-4 py-2.5">
                {data.delegation_type && <Badge className="mr-2 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">{data.delegation_type === 'assigned' ? 'Assigned' : 'Delegated'}</Badge>}
                {inspection.ordaqa_inspector_name || data.assigned_delegated_to || '—'}
              </td>
            </tr>
          )}
          {data.memo_returned === 'yes' && (
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Workflow</td>
              <td className="px-4 py-2.5">
                <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">Returned to QA Head</Badge>
              </td>
            </tr>
          )}
          <tr>
            <td className="bg-muted/50 px-4 py-2.5 font-medium">Oi/c ORDAQA CABS Cell</td>
            <td className="px-4 py-2.5">{data.oic_ordaqa_name || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Part III Section 23 — ORDAQA Head / admin: Section 23 fields + Assigned (ORDAQA Inspector list) vs Delegated (Inspector / QA). */
function Part3AssignForm({
  inspection,
  inspectionId,
  onComplete,
  onSuccess,
}: {
  inspection: InspectionRequest;
  inspectionId: number;
  onComplete: () => Promise<void> | void;
  onSuccess?: (message: string) => void;
}) {
  const { data: session } = useSession();
  const p0 = parseJsonObj(inspection.part3_data);
  const [form, setForm] = useState({
    ordaqa_comments: (p0.ordaqa_comments as string) || '',
    received_date_time: (p0.received_date_time as string) || getLocalDateTimeNow(),
    memo_returned: (p0.memo_returned as string) || 'no',
    oic_ordaqa_name: (p0.oic_ordaqa_name as string) || '',
  });
  const [delegationType, setDelegationType] = useState<'assigned' | 'delegated' | null>(() => {
    if (p0.delegation_type === 'delegated') return 'delegated';
    if (p0.delegation_type === 'assigned') return 'assigned';
    return null;
  });
  const [assigneeUserId, setAssigneeUserId] = useState(
    inspection.ordaqa_inspector_id != null ? String(inspection.ordaqa_inspector_id) : ''
  );
  const [ordaqaInspectors, setOrdaqaInspectors] = useState<any[]>([]);
  const [qaUsers, setQaUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const alreadySaved = part3Section23HasSavedData(inspection);

  const sel = "w-full px-3 py-2 text-sm rounded-md border border-input bg-background";

  const loggedInOicName = session?.user?.name?.trim() || '';

  useEffect(() => {
    if (!loggedInOicName) return;
    setForm((prev) => ({
      ...prev,
      oic_ordaqa_name: prev.oic_ordaqa_name.trim() ? prev.oic_ordaqa_name : loggedInOicName,
    }));
  }, [loggedInOicName]);

  useEffect(() => {
    const p = parseJsonObj(inspection.part3_data);
    setForm({
      ordaqa_comments: (p.ordaqa_comments as string) || '',
      received_date_time: (p.received_date_time as string) || getLocalDateTimeNow(),
      memo_returned: (p.memo_returned as string) || 'no',
      oic_ordaqa_name: (p.oic_ordaqa_name as string) || loggedInOicName,
    });
    setDelegationType(
      p.delegation_type === 'delegated'
        ? 'delegated'
        : p.delegation_type === 'assigned'
          ? 'assigned'
          : null
    );
    setAssigneeUserId(
      inspection.ordaqa_inspector_id != null ? String(inspection.ordaqa_inspector_id) : ''
    );
  }, [inspection.id, inspection.part3_data, inspection.ordaqa_inspector_id, loggedInOicName]);

  useEffect(() => {
    fetch('/api/users?role=ordaqa_inspector&status=active')
      .then((r) => r.json())
      .then((d) => setOrdaqaInspectors(d.users || []))
      .catch(() => {});
    fetch('/api/users?roles=inspector,qa_approver&status=active')
      .then((r) => r.json())
      .then((d) => setQaUsers(d.users || []))
      .catch(() => {});
  }, []);

  const availableUsers =
    delegationType === 'assigned' ? ordaqaInspectors : delegationType === 'delegated' ? qaUsers : [];

  const memoReturnYes = form.memo_returned === 'yes';

  const assigneeFieldLabel =
    delegationType === null
      ? 'Select Assigned or Delegated first'
      : delegationType === 'assigned'
        ? 'ORDAQA Inspector'
        : 'Delegated to (Inspector / QA Rep or Team Head - QA)';

  const handleMemoReturnedChange = (memo_returned: string) => {
    setForm((prev) => ({ ...prev, memo_returned }));
    if (memo_returned === 'yes') {
      setDelegationType(null);
      setAssigneeUserId('');
    }
  };

  const handleSave = async () => {
    if (!memoReturnYes) {
      if (delegationType === null) {
        setSaveMsg('Select Assigned or Delegated.');
        return;
      }
      if (!assigneeUserId) {
        setSaveMsg('Select an assignee.');
        return;
      }
    }
    if (!form.received_date_time.trim()) {
      setSaveMsg('Received date and time is required.');
      return;
    }
    let selected: { id: number; name?: string } | undefined;
    if (!memoReturnYes) {
      selected = availableUsers.find((u) => u.id === parseInt(assigneeUserId, 10));
      if (!selected) {
        setSaveMsg('Invalid assignee.');
        return;
      }
    }
    setLoading(true);
    setSaveMsg('');
    try {
      const part3_data: Record<string, string> = {
        ordaqa_comments: form.ordaqa_comments,
        received_date_time: form.received_date_time,
        memo_returned: form.memo_returned,
        oic_ordaqa_name: form.oic_ordaqa_name.trim() || loggedInOicName,
      };
      if (!memoReturnYes && selected) {
        part3_data.delegation_type = delegationType!;
        part3_data.assigned_delegated_to = selected.name || '';
      }
      const res = await fetch(`/api/inspection-requests/${inspectionId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'save_part3_assignment',
          ...(memoReturnYes ? {} : { ordaqa_inspector_id: selected!.id }),
          part3_data,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await onComplete();
        onSuccess?.(data.message || (alreadySaved ? 'Section 23 updated' : 'Section 23 saved'));
        setSaveMsg('');
      } else setSaveMsg(data.error || 'Failed');
    } catch {
      setSaveMsg('Error saving');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    form.received_date_time.trim().length > 0 &&
    (form.ordaqa_comments.trim().length > 0 ||
      form.oic_ordaqa_name.trim().length > 0 ||
      loggedInOicName.length > 0) &&
    (memoReturnYes || (delegationType !== null && !!assigneeUserId));

  return (
    <div id="part3-fill-form" className="space-y-4 scroll-mt-20">
      {saveMsg && (
        <div
          className={`px-3 py-2 rounded-md text-sm border ${
            /fail|error|forbidden|required|invalid|select|must/i.test(saveMsg)
              ? 'bg-destructive/10 border-destructive/30 text-destructive'
              : 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
          }`}
        >
          {saveMsg}
        </div>
      )}
      <h4 className="font-semibold text-sm text-muted-foreground">23. ORDAQA Comments</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>ORDAQA Comments</Label>
          <Textarea
            rows={3}
            value={form.ordaqa_comments}
            onChange={(e) => setForm({ ...form, ordaqa_comments: e.target.value })}
            placeholder="Comments from ORDAQA (CABS Cell)..."
          />
        </div>
        <div className="space-y-2">
          <Label>
            Received Date &amp; Time <span className="text-destructive">*</span>
          </Label>
          <DateTimeLocalInput
            required
            value={form.received_date_time}
            onChange={(received_date_time) => setForm({ ...form, received_date_time })}
          />
        </div>
        <div className="space-y-2">
          <Label>Memo to be Returned</Label>
          <select
            value={form.memo_returned}
            onChange={(e) => handleMemoReturnedChange(e.target.value)}
            className={sel}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
            <option value="re_offer">Re-Offer</option>
          </select>
          {memoReturnYes && (
            <p className="text-xs text-muted-foreground">
              The IR will be sent back to QA Head. Assigned / Delegated is not required.
            </p>
          )}
        </div>
      </div>

      <div
        className={`mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start ${memoReturnYes ? 'pointer-events-none opacity-50' : ''}`}
        aria-disabled={memoReturnYes}
      >
        <div className="min-w-0 space-y-2">
          <Label className={memoReturnYes ? 'text-muted-foreground' : 'text-foreground'}>
            Assigned / Delegated {!memoReturnYes && <span className="text-destructive">*</span>}
          </Label>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-0.5" role="radiogroup" aria-label="Assigned or Delegated">
            <label className={`flex items-center gap-2.5 text-sm font-normal ${memoReturnYes ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer text-foreground'}`}>
              <input
                type="radio"
                name={`p3-assign-${inspectionId}`}
                className="h-[18px] w-[18px] shrink-0 border border-input bg-background"
                style={{ accentColor: 'hsl(var(--foreground))' }}
                checked={delegationType === 'assigned'}
                disabled={memoReturnYes}
                onChange={() => {
                  setDelegationType('assigned');
                  setAssigneeUserId('');
                }}
              />
              <span>Assigned</span>
            </label>
            <label className={`flex items-center gap-2.5 text-sm font-normal ${memoReturnYes ? 'cursor-not-allowed text-muted-foreground' : 'cursor-pointer text-foreground'}`}>
              <input
                type="radio"
                name={`p3-assign-${inspectionId}`}
                className="h-[18px] w-[18px] shrink-0 border border-input bg-background"
                style={{ accentColor: 'hsl(var(--foreground))' }}
                checked={delegationType === 'delegated'}
                disabled={memoReturnYes}
                onChange={() => {
                  setDelegationType('delegated');
                  setAssigneeUserId('');
                }}
              />
              <span>Delegated</span>
            </label>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          <Label className={delegationType === null || memoReturnYes ? 'text-muted-foreground' : 'text-foreground'}>
            {memoReturnYes ? 'Assigned / Delegated (disabled)' : assigneeFieldLabel}
            {delegationType !== null && !memoReturnYes && <span className="text-destructive"> *</span>}
          </Label>
          {(delegationType === null || memoReturnYes) && (
            <select disabled className={`${sel} cursor-not-allowed bg-muted/50 text-muted-foreground`}>
              <option>{memoReturnYes ? 'Not required — memo returned to QA Head' : 'Select Assigned/Delegated first'}</option>
            </select>
          )}
          {delegationType !== null && !memoReturnYes && (
            <select value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)} className={sel}>
              <option value="">
                {delegationType === 'assigned'
                  ? 'Select ORDAQA Inspector...'
                  : 'Select Inspector / QA Rep or Team Head - QA...'}
              </option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.employee_id ? `${u.employee_id} - ` : ''}
                  {u.name}
                  {u.designation ? ` (${u.designation})` : ''}
                </option>
              ))}
            </select>
          )}
          {delegationType === 'assigned' && ordaqaInspectors.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">No active ORDAQA Inspector users.</p>
          )}
          {delegationType === 'delegated' && qaUsers.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">No active Inspector / Team Head - QA users.</p>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-2">
        <Label>Name of Oi/c ORDAQA CABS Cell</Label>
        <Input
          value={form.oic_ordaqa_name}
          onChange={(e) => setForm({ ...form, oic_ordaqa_name: e.target.value })}
          placeholder={loggedInOicName || 'Oi/c name...'}
        />
        <p className="text-xs text-muted-foreground">
          Defaults from your profile name; you can edit if needed.
        </p>
      </div>

      <Button
        type="button"
        onClick={() => void handleSave()}
        disabled={loading || !canSubmit}
        className="mt-1 bg-black text-white hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90"
      >
        {loading
          ? 'Saving...'
          : memoReturnYes
            ? 'Save & Return to QA Head'
            : alreadySaved
              ? 'Save Section 23 updates'
              : 'Save Section 23 & Assign'}
      </Button>
    </div>
  );
}

function Part5Form({
  inspection,
  inspectionId,
  onComplete,
}: {
  inspection: InspectionRequest;
  inspectionId: number;
  onComplete: () => Promise<void> | void;
}) {
  const [form, setForm] = useState(() => {
    const p3 = parseJsonObj(inspection.part3_data);
    const d = effectiveOrdqaPart5Data(inspection);
    return {
      clearance_status: (d.clearance_status as string) || 'open',
      dgaqa_inspector_name: (d.dgaqa_inspector_name as string) || '',
      dgaqa_rep: ordaqaRepReportDisplay(
        { ...d, delegation_type: p3.delegation_type, assigned_delegated_to: p3.assigned_delegated_to },
        inspection.ordaqa_inspector_name
      ),
    };
  });
  const [remarks, setRemarks] = useState(() => {
    const d = effectiveOrdqaPart5Data(inspection);
    const rows = d.inspection_remarks;
    if (Array.isArray(rows) && rows.length) {
      return rows.map((r: any, i: number) =>
        normalizeRemarkWithChatId({
          sl_no: String(r.sl_no ?? i + 1),
          observation: String(r.observation ?? ''),
          action_required: String(r.action_required ?? ''),
          closed_on: String(r.closed_on ?? ''),
          signature: String(r.signature ?? ''),
          chat_id: r.chat_id != null ? String(r.chat_id) : '',
        })
      );
    }
    return [{ sl_no: '1', observation: '', action_required: '', closed_on: '', signature: '', chat_id: '' }];
  });
  const { statusMap: threadStatus, refresh: refreshThreadStatus } = useObservationThreadStatus(inspectionId, true);
  const [locallyClosed, setLocallyClosed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [profileSigName, setProfileSigName] = useState('');

  useEffect(() => {
    fetch('/api/users/profile', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const u = d?.user;
        if (u?.name) setProfileSigName(String(u.name).trim());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!profileSigName) return;
    setRemarks((prev) =>
      prev.map((r) => ({
        ...r,
        signature: r.signature.trim() ? r.signature : profileSigName,
      }))
    );
    setForm((prev) => ({
      ...prev,
      dgaqa_inspector_name: prev.dgaqa_inspector_name.trim() ? prev.dgaqa_inspector_name : profileSigName,
    }));
  }, [profileSigName]);

  const addRow = () =>
    setRemarks([
      ...remarks,
      {
        sl_no: String(remarks.length + 1),
        observation: '',
        action_required: '',
        closed_on: '',
        signature: profileSigName || '',
        chat_id: '',
      },
    ]);
  const updateRow = (i: number, field: string, value: string) => {
    const copy = [...remarks];
    (copy[i] as any)[field] = value;
    setRemarks(copy);
  };
  const updateRowChatId = (i: number, chatId: string) => {
    const copy = [...remarks];
    (copy[i] as any).chat_id = chatId;
    setRemarks(copy);
  };
  const removeRow = (i: number) => { if (remarks.length > 1) setRemarks(remarks.filter((_, idx) => idx !== i)); };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inspection-requests/${inspectionId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          action: 'save_part5',
          part5_data: {
            ...form,
            inspection_remarks: remarks
              .filter((r) => r.observation)
              .map((r) => normalizeRemarkWithChatId({ ...r })),
          },
        }),
      });
      const data = await res.json();
      if (res.ok) { await onComplete(); setSaveMsg(data.message || 'Saved'); }
      else setSaveMsg(data.error || 'Failed');
    } catch { setSaveMsg('Error saving'); } finally { setLoading(false); }
  };

  const sel = "w-full px-3 py-2 text-sm rounded-md border border-input bg-background";

  return (
    <div className="space-y-6">
      {saveMsg && <div className="px-3 py-2 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm dark:bg-green-900/30 dark:border-green-800 dark:text-green-300">{saveMsg}</div>}
      <Separator />
      <p className="text-sm text-muted-foreground">
        <strong>Sections 24–25 (Part V)</strong> — complete below (assigned or delegated user from Part III Section 23). Part IV is already saved.
      </p>
      <h4 className="font-semibold text-sm text-muted-foreground">24. Inspection Remarks (Mechanical / Electrical / Other)</h4>
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs">
              <th className="px-3 py-2 text-left w-[60px]">Sl.</th>
              <th className="px-3 py-2 text-left">Observation</th>
              <th className="px-3 py-2 text-left">Action Required</th>
              <th className="px-3 py-2 text-left w-[130px]">Closed On</th>
              <th className="px-3 py-2 text-left w-[130px]">Signature</th>
              <th className="px-3 py-2 w-[70px]"></th>
              <th className="px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {remarks.map((r, i) => {
              const chatKey = String((r as ObservationRemarkRow).chat_id || '');
              const rowClosed = chatKey
                ? threadStatus[chatKey]?.isClosed || locallyClosed[chatKey]
                : false;
              return (
              <tr key={i} className={`border-t ${rowClosed ? 'opacity-50 bg-muted/30' : ''}`}>
                <td className="px-3 py-1"><Input value={r.sl_no} onChange={e => updateRow(i, 'sl_no', e.target.value)} className="h-8 text-xs" /></td>
                <td className="px-3 py-1">
                  <Input
                    value={r.observation}
                    onChange={e => updateRow(i, 'observation', e.target.value)}
                    readOnly={rowClosed}
                    className={`h-8 text-xs ${rowClosed ? 'bg-muted/40 cursor-default' : ''}`}
                    placeholder="Observation..."
                  />
                </td>
                <td className="px-3 py-1">
                  <Input
                    value={r.action_required}
                    onChange={e => updateRow(i, 'action_required', e.target.value)}
                    readOnly={rowClosed}
                    className={`h-8 text-xs ${rowClosed ? 'bg-muted/40 cursor-default' : ''}`}
                    placeholder="Action..."
                  />
                </td>
                <td className="px-3 py-1">
                  <CalendarDateInput
                    value={r.closed_on}
                    onChange={(v) => updateRow(i, 'closed_on', v)}
                    inputClassName="h-8 text-xs pr-8"
                    className="[&_button]:h-8 [&_button]:w-8 [&_input]:h-8"
                  />
                </td>
                <td className="px-3 py-1">
                  <Input
                    value={r.signature}
                    readOnly
                    className="h-8 text-xs bg-muted/40 cursor-default"
                    title="Filled from your profile — not editable"
                  />
                </td>
                <td className="px-3 py-1">
                  <ObservationChatActions
                    inspectionRequestId={inspectionId}
                    part="part5"
                    remark={r as ObservationRemarkRow}
                    requestNumber={inspection.request_number}
                    initiatorName={inspection.initiator_name}
                    canClose
                    threadMeta={chatKey ? threadStatus[chatKey] : null}
                    onRefreshThreadStatus={refreshThreadStatus}
                    onChatIdChange={(id) => updateRowChatId(i, id)}
                    onClosed={() => {
                      if (chatKey) setLocallyClosed((prev) => ({ ...prev, [chatKey]: true }));
                    }}
                  />
                </td>
                <td className="px-3 py-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(i)} disabled={rowClosed}><Minus className="h-3 w-3" /></Button></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={addRow}><Plus className="mr-1 h-3 w-3" /> Add Row</Button>

      <Separator />
      <h4 className="font-semibold text-sm text-muted-foreground">25. Clearance Status</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Clearance Status *</Label>
          <select value={form.clearance_status} onChange={e => setForm({...form, clearance_status: e.target.value})} className={sel}>
            <option value="open">Open</option>
            <option value="rework">Rework</option>
            <option value="accepted">Accepted and Cleared</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>ORDAQA Approved Inspector Name</Label>
          <Input
            value={form.dgaqa_inspector_name}
            readOnly
            className="bg-muted/40 cursor-default"
            title="Filled from your profile — not editable"
          />
          <p className="text-xs text-muted-foreground">Read-only: taken from your profile name (user master).</p>
        </div>
        <div className="space-y-2">
          <Label>ORDAQA Rep (in case of delegation to R&QA)</Label>
          <Input value={form.dgaqa_rep} onChange={e => setForm({...form, dgaqa_rep: e.target.value})} placeholder="ORDAQA representative..." />
        </div>
      </div>

      <p className="text-xs text-muted-foreground italic">
        I hereby certify that material/part/installation/assembly/operation/stage has been fully inspected, tested and confirmed to the approved drawing/ATP and all technology requirements stipulated in relevant approved schedule. The stage is hereby recommended/not recommended for your further clearance/acceptance.
      </p>

      <Button onClick={handleSubmit} disabled={loading} className="mt-2">
        {loading ? 'Submitting...' : 'Submit Part V for ORDAQA Head Approval'}
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Part IV — CABS R&QA Inspection Report  (Sections 26-29)
   ═══════════════════════════════════════════════════════ */

function Part4Display({
  inspection,
  canEditObservations = false,
}: {
  inspection: InspectionRequest;
  canEditObservations?: boolean;
}) {
  const d = parseJsonObj(inspection.part4_data);
  const assignedInspectors = resolveAssignedInspectorsForDisplay(inspection);
  const { statusMap: threadStatus, refresh: refreshThreadStatus } = useObservationThreadStatus(inspection.id, true);
  const YN = (v: string) => v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'na' ? 'N/A' : v || '—';
  return (
    <div className="space-y-6">
      {/* Section 26 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr><td className="bg-muted/50 px-4 py-2.5 font-medium" colSpan={2}><strong>26. Details of Inspection / Test Completed</strong></td></tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium w-[250px]">Details</td>
              <td className="px-4 py-2.5 whitespace-pre-wrap">{d.inspection_details || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Inspection / Test Start Date</td>
              <td className="px-4 py-2.5">{fmtDate(d.start_date)}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Inspection / Test Completion Date</td>
              <td className="px-4 py-2.5">{fmtDate(d.completion_date)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 27 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr><td className="bg-muted/50 px-4 py-2.5 font-medium" colSpan={2}><strong>27. Inspection Count</strong></td></tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium w-[250px]">No. of Items Offered</td>
              <td className="px-4 py-2.5">{d.items_offered || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Accepted</td>
              <td className="px-4 py-2.5">{d.items_accepted || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">No. of Observations</td>
              <td className="px-4 py-2.5">{d.observations_count || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Rejected</td>
              <td className="px-4 py-2.5">{d.items_rejected || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 28 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr><td className="bg-muted/50 px-4 py-2.5 font-medium" colSpan={2}><strong>28. Remarks / Observation by Inspector (R&QA Staff/Officer)</strong></td></tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium w-[350px]">a. Verification of observations in log book from previous stages</td>
              <td className="px-4 py-2.5">{YN(d.verification_logbook)}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">b. Instruments/Test Facilities Calibration details mentioned in log book</td>
              <td className="px-4 py-2.5">{YN(d.instruments_calibration)}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">c. Copy of log book entries attached</td>
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{YN(d.logbook_copy_attached)}</span>
                  {d.logbook_copy_attached === 'yes' && (() => {
                    const logAtt = (inspection.attachments || []).find(
                      (a: { id: number }) => Number(a.id) === Number(d.logbook_copy_attachment_id)
                    );
                    if (logAtt?.file_path) {
                      return (
                        <a
                          href={logAtt.file_path}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[220px]">{logAtt.file_name}</span>
                        </a>
                      );
                    }
                    if (d.logbook_copy_file_name) {
                      return <span className="text-xs text-muted-foreground">({d.logbook_copy_file_name})</span>;
                    }
                    return null;
                  })()}
                </div>
              </td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">d. Status of inspection carried out</td>
              <td className="px-4 py-2.5 whitespace-pre-wrap">{d.inspection_status || '—'}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">e. Inspection carried out as per guiding checklist</td>
              <td className="px-4 py-2.5">{YN(d.per_guiding_checklist)}</td>
            </tr>
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">f. Remarks</td>
              <td className="px-4 py-2.5 whitespace-pre-wrap">{d.remarks || '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 29 — Inspection Remarks */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium" colSpan={3}>29. Inspection Remarks (Mechanical / Electrical / Other)</th>
            </tr>
            <tr className="bg-muted/30 text-xs">
              <th className="px-4 py-2 text-left w-[60px]">Sl. No</th>
              <th className="px-4 py-2 text-left">Observation</th>
              <th className="px-4 py-2 text-left">Action Required</th>
              <th className="px-4 py-2 w-[70px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {d.part4_remarks && Array.isArray(d.part4_remarks) && d.part4_remarks.length > 0 ? (
              d.part4_remarks.map((r: any, i: number) => {
                const remark = normalizeRemarkWithChatId({
                  sl_no: String(r.sl_no ?? i + 1),
                  observation: String(r.observation ?? ''),
                  action_required: String(r.action_required ?? ''),
                  chat_id: r.chat_id != null ? String(r.chat_id) : '',
                }) as ObservationRemarkRow;
                const chatKey = remark.chat_id || '';
                const closed = chatKey ? threadStatus[chatKey]?.isClosed : false;
                return (
                <tr key={i} className={closed ? 'opacity-50 bg-muted/30' : ''}>
                  <td className="px-4 py-2.5">{r.sl_no || i + 1}</td>
                  <td className="px-4 py-2.5 whitespace-pre-wrap">{r.observation || '—'}</td>
                  <td className="px-4 py-2.5 whitespace-pre-wrap">{r.action_required || '—'}</td>
                  <td className="px-4 py-2.5">
                    <ObservationChatActions
                      inspectionRequestId={inspection.id}
                      part="part4"
                      remark={remark}
                      requestNumber={inspection.request_number}
                      initiatorName={inspection.initiator_name}
                      canClose={false}
                      canEdit={canEditObservations}
                      threadMeta={chatKey ? threadStatus[chatKey] : null}
                      onRefreshThreadStatus={refreshThreadStatus}
                    />
                  </td>
                </tr>
                );
              })
            ) : (
              <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground italic">No inspection remarks recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Section 30 — Inspector Name / Seal & Signature */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr><td className="bg-muted/50 px-4 py-2.5 font-medium" colSpan={2}><strong>30. Inspector Name / Seal & Signature with Date</strong></td></tr>
            {assignedInspectors.length > 0 ? (
              assignedInspectors.map((insp, i) => {
                const sig =
                  inspection.assigned_inspectors?.find((a) => a.id === insp.id)?.signature_path ??
                  (i === 0 ? inspection.inspector_signature_path : null);
                return (
                  <tr key={insp.id ?? i}>
                    <td className="bg-muted/50 px-4 py-2.5 font-medium w-[250px]">Inspector / QA Rep {i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div>
                          <strong>{insp.name}</strong>
                          {insp.employee_id && <span className="text-muted-foreground ml-1">({insp.employee_id})</span>}
                          {insp.designation && <span className="text-muted-foreground ml-1">— {insp.designation}</span>}
                        </div>
                        {sig ? (
                          <img src={sig} alt={`${insp.name} Signature`} className="h-10 object-contain" />
                        ) : (
                          <span className="text-green-700 dark:text-green-400 italic text-xs">✓ Signed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td className="bg-muted/50 px-4 py-2.5 font-medium w-[250px]">Inspector / QA Rep</td>
                <td className="px-4 py-2.5">{d.inspector_rep1_name || '—'}</td>
              </tr>
            )}
            <tr>
              <td className="bg-muted/50 px-4 py-2.5 font-medium">Signature/Seal of Team Head</td>
              <td className="px-4 py-2.5">
                {(() => {
                  const th = resolvePart4TeamHeadSignoff(inspection);
                  if (!th.approved) {
                    return (
                      <span className="text-muted-foreground italic text-sm">Pending Team Head approval</span>
                    );
                  }
                  return (
                    <div className="flex items-center gap-3">
                      <div>
                        <strong>{th.name}</strong>
                        {th.designation && (
                          <span className="text-muted-foreground ml-1">({th.designation})</span>
                        )}
                      </div>
                      {th.signaturePath ? (
                        <img src={th.signaturePath} alt="Team Head Signature" className="h-10 object-contain" />
                      ) : (
                        <span className="text-green-700 dark:text-green-400 italic text-xs">✓ Signed</span>
                      )}
                      {th.approvedAt && (
                        <span className="text-muted-foreground text-xs">{fmtDate(th.approvedAt)}</span>
                      )}
                    </div>
                  );
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {inspection.part4_completed_by_name && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground border-t pt-3">
          <span>Completed by: <strong>{inspection.part4_completed_by_name}</strong></span>
          <span>Date: <strong>{fmtDate(inspection.part4_date)}</strong></span>
        </div>
      )}
    </div>
  );
}

function Part4Form({
  inspection,
  onComplete,
  onSuccess,
  submitLabel,
}: {
  inspection: InspectionRequest;
  onComplete: () => Promise<void> | void;
  onSuccess?: (message: string) => void;
  submitLabel?: string;
}) {
  const { data: session } = useSession();
  const signerName = session?.user?.name?.trim() || '';
  const inspectionId = inspection.id;
  const lastIrIdRef = useRef<number | null>(null);
  const lastPart4SnapshotRef = useRef<string | null>(null);
  const { statusMap: threadStatus, refresh: refreshThreadStatus } = useObservationThreadStatus(inspectionId, true);
  const [locallyClosed, setLocallyClosed] = useState<Record<string, boolean>>({});
  const [saveMsg, setSaveMsg] = useState('');

  const [form, setForm] = useState(() => buildPart4FormState(inspection));

  useEffect(() => {
    if (lastIrIdRef.current !== inspection.id) {
      lastIrIdRef.current = inspection.id;
      lastPart4SnapshotRef.current = null;
    }
    const snap = serializePart4ForSync(inspection);
    if (lastPart4SnapshotRef.current === snap) return;
    lastPart4SnapshotRef.current = snap;
    setForm(buildPart4FormState(inspection));
  }, [inspection]);

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [logbookCopyPart4File, setLogbookCopyPart4File] = useState<File | null>(null);

  const addRemarkRow = () =>
    setForm({
      ...form,
      part4_remarks: [
        ...form.part4_remarks,
        {
          sl_no: String(form.part4_remarks.length + 1),
          observation: '',
          action_required: '',
          closed_on: '',
          signature: signerName,
          chat_id: '',
        },
      ],
    });
  const updateRemarkRow = (i: number, field: string, value: string) => {
    const copy = [...form.part4_remarks];
    (copy[i] as any)[field] = value;
    setForm({...form, part4_remarks: copy});
  };
  const updateRemarkChatId = (i: number, chatId: string) => {
    const copy = [...form.part4_remarks];
    (copy[i] as any).chat_id = chatId;
    setForm({ ...form, part4_remarks: copy });
  };
  const removeRemarkRow = (i: number) => setForm({...form, part4_remarks: form.part4_remarks.filter((_, idx) => idx !== i)});

  /** Allow only empty or non-negative integer strings (blocks "-", "-1", etc.). */
  const sanitizeNonNegativeInt = (raw: string): string => {
    if (raw === '') return '';
    const digits = raw.replace(/[^\d]/g, '');
    if (digits === '') return '';
    return String(parseInt(digits, 10));
  };

  const validatePart4 = () => {
    const errors: Record<string, string> = {};
    if (!form.inspection_details.trim()) errors.inspection_details = '26. Details of Inspection / Test is required';
    if (form.items_offered === '' || Number.isNaN(parseInt(form.items_offered, 10)) || parseInt(form.items_offered, 10) < 0) {
      errors.items_offered = '27. No. of Items Offered must be 0 or greater';
    }
    if (form.items_accepted === '' || Number.isNaN(parseInt(form.items_accepted, 10)) || parseInt(form.items_accepted, 10) < 0) {
      errors.items_accepted = '27. No. of Items Accepted must be 0 or greater';
    }
    if (
      form.observations_count !== '' &&
      (Number.isNaN(parseInt(form.observations_count, 10)) || parseInt(form.observations_count, 10) < 0)
    ) {
      errors.observations_count = '27. Observations must be 0 or greater';
    }
    if (!form.verification_logbook) errors.verification_logbook = '28(a). Verification of observations in log book is required';
    if (!form.instruments_calibration) errors.instruments_calibration = '28(b). Instruments/Test Facilities calibration details is required';
    if (!form.logbook_copy_attached) errors.logbook_copy_attached = '28(c). Copy of log book entries attached is required';
    const hasSavedLogbookCopy =
      form.logbook_copy_attachment_id != null &&
      Number(form.logbook_copy_attachment_id) > 0;
    if (form.logbook_copy_attached === 'yes' && !logbookCopyPart4File && !hasSavedLogbookCopy) {
      errors.logbook_copy_attached = '28(c). A file upload is required when Yes is selected';
    }
    if (!form.inspection_status.trim()) errors.inspection_status = '28(d). Status of inspection carried out is required';
    if (!form.per_guiding_checklist) errors.per_guiding_checklist = '28(e). Inspection per guiding checklist is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validatePart4()) return;
    setLoading(true);
    setSaveMsg('');
    try {
      const remarksWithSigner = form.part4_remarks.map((r) =>
        normalizeRemarkWithChatId({
          ...r,
          signature: signerName || r.signature,
        })
      );
      let part4Payload: Record<string, unknown> = { ...form, part4_remarks: remarksWithSigner };
      if (form.logbook_copy_attached !== 'yes') {
        part4Payload.logbook_copy_attachment_id = null;
        part4Payload.logbook_copy_file_name = '';
      } else if (logbookCopyPart4File) {
        const fd = new FormData();
        fd.append('file', logbookCopyPart4File);
        fd.append('entity_type', 'inspection_request');
        fd.append('entity_id', String(inspectionId));
        fd.append('description', 'Part IV — Log book copy');
        const up = await fetch('/api/attachments', { method: 'POST', body: fd });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) {
          setSaveMsg(upData.error || 'Failed to upload log book copy');
          setLoading(false);
          return;
        }
        const att = upData.attachment;
        if (att?.id) {
          part4Payload = {
            ...part4Payload,
            logbook_copy_attachment_id: att.id,
            logbook_copy_file_name: att.file_name || logbookCopyPart4File.name,
          };
        }
      }

      const res = await fetch(`/api/inspection-requests/${inspectionId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_part4', part4_data: part4Payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setLogbookCopyPart4File(null);
        onSuccess?.(data.message || 'Part IV saved');
        await onComplete();
      } else {
        setSaveMsg(data.error || 'Failed');
      }
    } catch {
      setSaveMsg('Error saving');
    } finally {
      setLoading(false);
    }
  };

  const sel = "w-full px-3 py-2 text-sm rounded-md border border-input bg-background";

  return (
    <div id="part4-fill-form" className="space-y-6 scroll-mt-20">
      {saveMsg && (
        <div className="px-3 py-2 rounded-md border text-sm bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300">
          {saveMsg}
        </div>
      )}
      {/* Section 26 */}
      <h4 className="font-semibold text-sm text-muted-foreground">26. Details of Inspection / Test Completed</h4>
      <div className="space-y-2">
        <Label>Details of Inspection / Test Completed *</Label>
        <Textarea rows={3} value={form.inspection_details} onChange={e => { setForm({...form, inspection_details: e.target.value}); setFieldErrors(prev => ({...prev, inspection_details: ''})); }} placeholder="Describe the inspection/test completed..." className={fieldErrors.inspection_details ? 'border-red-500' : ''} />
        {fieldErrors.inspection_details && <p className="text-xs text-red-500">{fieldErrors.inspection_details}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Inspection / Test Start Date</Label>
          <CalendarDateInput
            value={form.start_date}
            onChange={(start_date) => setForm({ ...form, start_date })}
          />
        </div>
        <div className="space-y-2">
          <Label>Inspection / Test Completion Date</Label>
          <CalendarDateInput
            value={form.completion_date}
            onChange={(completion_date) => setForm({ ...form, completion_date })}
          />
        </div>
      </div>

      {/* Section 27 */}
      <Separator />
      <h4 className="font-semibold text-sm text-muted-foreground">27. Inspection Count</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Items Offered *</Label>
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={form.items_offered}
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
            }}
            onChange={(e) => {
              const offered = sanitizeNonNegativeInt(e.target.value);
              const accepted = parseInt(form.items_accepted, 10) || 0;
              const offeredNum = parseInt(offered, 10) || 0;
              const newAccepted = accepted > offeredNum ? String(offeredNum) : form.items_accepted;
              const rejected = offeredNum - (parseInt(newAccepted, 10) || 0);
              setForm({
                ...form,
                items_offered: offered,
                items_accepted: newAccepted,
                items_rejected: rejected >= 0 ? String(rejected) : '0',
              });
              setFieldErrors((prev) => ({ ...prev, items_offered: '' }));
            }}
            placeholder="0"
            className={fieldErrors.items_offered ? 'border-red-500' : ''}
          />
          {fieldErrors.items_offered && <p className="text-xs text-red-500">{fieldErrors.items_offered}</p>}
        </div>
        <div className="space-y-2">
          <Label>Accepted *</Label>
          <Input
            type="number"
            min={0}
            step={1}
            max={form.items_offered || undefined}
            inputMode="numeric"
            value={form.items_accepted}
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
            }}
            onChange={(e) => {
              const accepted = sanitizeNonNegativeInt(e.target.value);
              const offeredNum = parseInt(form.items_offered, 10) || 0;
              const acceptedNum = parseInt(accepted, 10) || 0;
              if (acceptedNum > offeredNum && offeredNum > 0) return;
              const rejected = offeredNum - acceptedNum;
              setForm({
                ...form,
                items_accepted: accepted,
                items_rejected: rejected >= 0 ? String(rejected) : '0',
              });
              setFieldErrors((prev) => ({ ...prev, items_accepted: '' }));
            }}
            placeholder="0"
            className={fieldErrors.items_accepted ? 'border-red-500' : ''}
          />
          {fieldErrors.items_accepted && <p className="text-xs text-red-500">{fieldErrors.items_accepted}</p>}
          {parseInt(form.items_accepted, 10) > parseInt(form.items_offered, 10) &&
            parseInt(form.items_offered, 10) > 0 && (
            <p className="text-xs text-red-500">Accepted cannot exceed items offered</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Observations</Label>
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={form.observations_count}
            onKeyDown={(e) => {
              if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') e.preventDefault();
            }}
            onChange={(e) => {
              setForm({ ...form, observations_count: sanitizeNonNegativeInt(e.target.value) });
              setFieldErrors((prev) => ({ ...prev, observations_count: '' }));
            }}
            placeholder="0"
            className={fieldErrors.observations_count ? 'border-red-500' : ''}
          />
          {fieldErrors.observations_count && (
            <p className="text-xs text-red-500">{fieldErrors.observations_count}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Rejected</Label>
          <Input type="number" min={0} value={form.items_rejected} readOnly className="bg-muted/50" placeholder="0" />
          <p className="text-xs text-muted-foreground">Auto: Offered − Accepted</p>
        </div>
      </div>

      {/* Section 28 */}
      <Separator />
      <h4 className="font-semibold text-sm text-muted-foreground">28. Remarks / Observation by Inspector (R&QA Staff/Officer)</h4>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>a. Verification of observations in log book from previous stages *</Label>
            <select
              value={form.verification_logbook}
              onChange={e => { setForm({ ...form, verification_logbook: e.target.value }); setFieldErrors(prev => ({ ...prev, verification_logbook: '' })); }}
              className={`${sel}${fieldErrors.verification_logbook ? ' border-red-500' : ''}`}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="na">N/A</option>
            </select>
            {fieldErrors.verification_logbook && <p className="text-xs text-red-500">{fieldErrors.verification_logbook}</p>}
          </div>
          <div className="space-y-2">
            <Label>b. Instruments/Test Facilities Calibration details in log book *</Label>
            <select
              value={form.instruments_calibration}
              onChange={e => { setForm({ ...form, instruments_calibration: e.target.value }); setFieldErrors(prev => ({ ...prev, instruments_calibration: '' })); }}
              className={`${sel}${fieldErrors.instruments_calibration ? ' border-red-500' : ''}`}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="na">N/A</option>
            </select>
            {fieldErrors.instruments_calibration && <p className="text-xs text-red-500">{fieldErrors.instruments_calibration}</p>}
          </div>
          <div className="space-y-2">
            <Label>c. Copy of log book entries attached *</Label>
            <select
              value={form.logbook_copy_attached}
              onChange={e => {
                const v = e.target.value;
                setForm({
                  ...form,
                  logbook_copy_attached: v,
                  ...(v !== 'yes'
                    ? { logbook_copy_attachment_id: null, logbook_copy_file_name: '' }
                    : {}),
                });
                if (v !== 'yes') setLogbookCopyPart4File(null);
                setFieldErrors(prev => ({ ...prev, logbook_copy_attached: '' }));
              }}
              className={`${sel}${fieldErrors.logbook_copy_attached ? ' border-red-500' : ''}`}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            {form.logbook_copy_attached === 'yes' && (
              <div className="mt-1">
                {logbookCopyPart4File ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{logbookCopyPart4File.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(logbookCopyPart4File.size / 1024).toFixed(0)} KB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setLogbookCopyPart4File(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label
                    className={`flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors ${
                      fieldErrors.logbook_copy_attached && form.logbook_copy_attached === 'yes' && !logbookCopyPart4File
                        ? 'border-red-500 ring-1 ring-red-500'
                        : ''
                    }`}
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Attach log book copy (max 20MB) *</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          if (f.size > 20 * 1024 * 1024) {
                            alert('File size exceeds 20MB limit');
                            return;
                          }
                          setLogbookCopyPart4File(f);
                          setFieldErrors(prev => ({ ...prev, logbook_copy_attached: '' }));
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            )}
            {fieldErrors.logbook_copy_attached && <p className="text-xs text-red-500">{fieldErrors.logbook_copy_attached}</p>}
          </div>
          <div className="space-y-2">
            <Label>d. Status of inspection carried out *</Label>
            <Textarea
              rows={3}
              value={form.inspection_status}
              onChange={e => { setForm({ ...form, inspection_status: e.target.value }); setFieldErrors(prev => ({ ...prev, inspection_status: '' })); }}
              placeholder="Describe the status of inspection carried out..."
              className={fieldErrors.inspection_status ? 'border-red-500' : ''}
            />
            {fieldErrors.inspection_status && <p className="text-xs text-red-500">{fieldErrors.inspection_status}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>e. Inspection carried out as per guiding checklist *</Label>
            <select
              value={form.per_guiding_checklist}
              onChange={e => { setForm({ ...form, per_guiding_checklist: e.target.value }); setFieldErrors(prev => ({ ...prev, per_guiding_checklist: '' })); }}
              className={`${sel}${fieldErrors.per_guiding_checklist ? ' border-red-500' : ''}`}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
            {fieldErrors.per_guiding_checklist && <p className="text-xs text-red-500">{fieldErrors.per_guiding_checklist}</p>}
          </div>
          <div className="space-y-2">
            <Label>f. Remarks <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Any other points for attention of higher authorities or useful for future inspections..." />
          </div>
        </div>
      </div>

      {/* Section 29 — Inspection Remarks */}
      <Separator />
      <h4 className="font-semibold text-sm text-muted-foreground">29. Inspection Remarks (Mechanical / Electrical / Other)</h4>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-xs">
              <th className="px-3 py-2 text-left w-[60px]">Sl. No</th>
              <th className="px-3 py-2 text-left">Observation</th>
              <th className="px-3 py-2 text-left">Action Required</th>
              <th className="px-3 py-2 w-[70px]"></th>
              <th className="px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {form.part4_remarks.map((r, i) => {
              const chatKey = String((r as ObservationRemarkRow).chat_id || '');
              const rowClosed = chatKey
                ? threadStatus[chatKey]?.isClosed || locallyClosed[chatKey]
                : false;
              return (
              <tr key={i} className={rowClosed ? 'opacity-50 bg-muted/30' : ''}>
                <td className="px-3 py-1"><Input value={r.sl_no} onChange={e => updateRemarkRow(i, 'sl_no', e.target.value)} className="h-8 text-xs w-12" /></td>
                <td className="px-3 py-1">
                  <Textarea
                    rows={1}
                    value={r.observation}
                    onChange={e => updateRemarkRow(i, 'observation', e.target.value)}
                    readOnly={rowClosed}
                    className={`text-xs min-h-[32px] ${rowClosed ? 'bg-muted/40 cursor-default' : ''}`}
                    placeholder="Observation..."
                  />
                </td>
                <td className="px-3 py-1">
                  <Input
                    value={r.action_required}
                    onChange={e => updateRemarkRow(i, 'action_required', e.target.value)}
                    readOnly={rowClosed}
                    className={`h-8 text-xs ${rowClosed ? 'bg-muted/40 cursor-default' : ''}`}
                    placeholder="Action..."
                  />
                </td>
                <td className="px-3 py-1">
                  <ObservationChatActions
                    inspectionRequestId={inspectionId}
                    part="part4"
                    remark={r as ObservationRemarkRow}
                    requestNumber={inspection.request_number}
                    initiatorName={inspection.initiator_name}
                    canClose
                    threadMeta={chatKey ? threadStatus[chatKey] : null}
                    onRefreshThreadStatus={refreshThreadStatus}
                    onChatIdChange={(id) => updateRemarkChatId(i, id)}
                    onClosed={() => {
                      if (chatKey) setLocallyClosed((prev) => ({ ...prev, [chatKey]: true }));
                    }}
                  />
                </td>
                <td className="px-3 py-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRemarkRow(i)} disabled={rowClosed}><Minus className="h-3 w-3" /></Button></td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={addRemarkRow}>
        <Plus className="mr-1 h-3 w-3" /> Add Row
      </Button>

      {/* Section 30 — Inspector Name / Seal & Signature */}
      <Separator />
      <h4 className="font-semibold text-sm text-muted-foreground">30. Inspector Name / Seal & Signature with Date</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {resolveAssignedInspectorsForDisplay(inspection).map((insp, i) => (
          <div key={insp.id || i} className="space-y-2">
            <Label>Inspector / QA Rep {i + 1}</Label>
            <Input value={`${insp.name}${insp.employee_id ? ` (${insp.employee_id})` : ''}`} readOnly className="bg-muted/50" />
          </div>
        ))}
        <div className="space-y-2">
          <Label>Signature/Seal of Team Head</Label>
          {(() => {
            const th = resolvePart4TeamHeadSignoff(inspection);
            if (th.approved) {
              return (
                <Input
                  value={`${th.name}${th.designation ? ` (${th.designation})` : ''}`}
                  readOnly
                  className="bg-muted/50"
                />
              );
            }
            return (
              <p className="text-sm text-muted-foreground italic py-2">Pending Team Head approval</p>
            );
          })()}
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">
        Inspector names from Part II. Team Head name appears after Part IV Team Head approval.
      </p>

      <Button onClick={handleSubmit} disabled={loading} className="mt-2">
        {loading
          ? 'Saving...'
          : submitLabel
            ? submitLabel
            : part4RejectedByTeamHead(inspection)
              ? 'Resubmit Part IV for Team Head Approval'
              : 'Submit Part IV for Team Head Approval'}
      </Button>
    </div>
  );
}

