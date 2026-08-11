'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  CheckSquare, TrendingUp, Activity, AlertCircle, Clock, Calendar,
  ArrowRight, Bell, FileText, Users, FolderKanban, Plus, Eye,
  ClipboardCheck, ShieldCheck, Pen, UserCheck, Crown, Shield, UserCog, Building2,
  BarChart3, MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatCalendarDateDisplay } from '@/lib/inspection-display';
import { roleCanViewObservationChats } from '@/lib/observation-chats-shared';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { employeeIsPart1Approver } from '@/lib/part1-approver';

interface DashboardStats {
  byStatus: Array<{ status: string; count: string }>;
  overdue: number;
  upcoming: number;
  completionRate: { completed: number; total: number; percentage: number };
  avgCompletionDays: string;
  recentRequests: Array<any>;
  actionItems: Record<string, number>;
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  pending_request_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  pending_part1_approval: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  request_approved: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  inspection_completed: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending_ordaqa_approval: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300', // legacy
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  closed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  returned_to_designer: 'bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  pending_request_approval: 'Pending Forward',
  pending_part1_approval: 'Pending Part I Approval',
  request_approved: 'Part I Approved / Forwarded',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  inspection_completed: 'Inspection Completed',
  pending_qa_approval: 'Pending QA Approval',
  qa_approved: 'QA Approved',
  pending_ordaqa_approval: 'Pending ORDAQA',
  completed: 'Completed',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
  returned_to_designer: 'Returned to Designer',
};

function formatStatusLabel(status?: string | null): string {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any; greeting: string }> = {
  administrator: { label: 'Administrator', color: 'bg-purple-600', icon: Crown, greeting: 'System overview at a glance.' },
  qa_head: { label: 'QA Head', color: 'bg-indigo-600', icon: ShieldCheck, greeting: 'Quality assurance oversight.' },
  qa_approver: { label: 'Team Head - QA', color: 'bg-blue-600', icon: ShieldCheck, greeting: 'Quality assurance overview.' },
  ordaqa_head: { label: 'ORDAQA Head', color: 'bg-violet-600', icon: Shield, greeting: 'ORDAQA oversight & approvals.' },
  os_director: {
    label: 'OS & Director',
    color: 'bg-amber-600',
    icon: Building2,
    greeting: 'Organisation-wide inspection overview.',
  },
  ordaqa_inspector: { label: 'Inspector / ORDAQA Rep', color: 'bg-cyan-600', icon: ClipboardCheck, greeting: 'Your assigned ORDAQA inspections.' },
  request_approver: { label: 'Team Head', color: 'bg-teal-600', icon: UserCheck, greeting: 'Your team\'s inspection status.' },
  inspector: { label: 'Inspector / QA Rep', color: 'bg-emerald-600', icon: ClipboardCheck, greeting: 'Your assigned inspections.' },
  initiator: { label: 'Initiator / Designer', color: 'bg-slate-600', icon: Pen, greeting: 'Your inspection requests.' },
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const permissions = usePermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [inspectionRequests, setInspectionRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [obsChatStats, setObsChatStats] = useState({ openCount: 0, unreadCount: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const rawRole = (session?.user as any)?.role || 'initiator';
  const userRole =
    rawRole === 'os' || rawRole === 'director' ? 'os_director' : rawRole;
  const userDesignation = (session?.user as any)?.designation || '';
  const employeeId = (session?.user as any)?.employee_id as string | undefined;
  const isPart1Approver = employeeIsPart1Approver(employeeId) || permissions.isPart1Approver();
  const roleConfig = ROLE_CONFIG[userRole] || ROLE_CONFIG.initiator;
  const RoleIcon = roleConfig.icon;

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/login');
    else if (status === 'authenticated') fetchData();
  }, [status]);

  const fetchObsChatStats = async () => {
    if (!roleCanViewObservationChats(userRole)) return;
    try {
      const res = await fetch('/api/observation-chats?exclude_closed=true', { cache: 'no-store' });
      const obsData = await res.json();
      if (res.ok) {
        setObsChatStats({
          openCount: obsData.openCount || 0,
          unreadCount: obsData.unreadCount || 0,
          total: obsData.threads?.length || 0,
        });
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (!roleCanViewObservationChats(userRole)) return;
    const onChatUpdate = () => void fetchObsChatStats();
    window.addEventListener('observation-chat-acknowledged', onChatUpdate);
    const interval = setInterval(fetchObsChatStats, 30000);
    return () => {
      window.removeEventListener('observation-chat-acknowledged', onChatUpdate);
      clearInterval(interval);
    };
  }, [status, userRole]);

  const fetchData = async () => {
    try {
      const [statsRes, listRes, notifRes, obsChatRes] = await Promise.all([
        fetch('/api/inspection-requests/stats'),
        fetch('/api/inspection-requests'),
        fetch('/api/notifications?unread_only=true&limit=5'),
        roleCanViewObservationChats(userRole)
          ? fetch('/api/observation-chats?exclude_closed=true')
          : Promise.resolve(null),
      ]);
      const statsData = await statsRes.json();
      const listData = await listRes.json();
      const notifData = await notifRes.json();
      if (statsData.stats) setStats(statsData.stats);
      if (Array.isArray(listData.requests)) {
        setInspectionRequests(
          listData.requests.filter((r: any) => r.status !== 'draft')
        );
      } else if (Array.isArray(statsData.stats?.recentRequests)) {
        setInspectionRequests(statsData.stats.recentRequests);
      }
      if (notifData.notifications) setNotifications(notifData.notifications);
      if (obsChatRes) {
        const obsData = await obsChatRes.json();
        if (obsChatRes.ok) {
          setObsChatStats({
            openCount: obsData.openCount || 0,
            unreadCount: obsData.unreadCount || 0,
            total: obsData.threads?.length || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#1e3a5f] border-t-transparent mx-auto" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const total =
    stats?.byStatus
      .filter((s) => s.status !== 'draft')
      .reduce((sum, s) => sum + parseInt(s.count), 0) || 0;
  const actions = stats?.actionItems || {};

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`${roleConfig.color} p-2.5 rounded-xl text-white mt-0.5`}>
            <RoleIcon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Welcome, {session?.user?.name?.trim() || session?.user?.email || 'there'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${roleConfig.color} text-white text-[11px] font-medium`}>
                {userDesignation || roleConfig.label}
              </Badge>
              <span className="text-sm text-muted-foreground">{roleConfig.greeting}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {(userRole === 'initiator' || userRole === 'administrator') && (
            <Button asChild className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white gap-2 h-9 text-sm">
              <Link href="/dashboard/inspections/new">
                <Plus className="h-4 w-4" /> New IR
              </Link>
            </Button>
          )}
          <Button variant="outline" asChild className="h-9 text-sm">
            <Link href="/dashboard/inspections">
              <Eye className="h-4 w-4 mr-2" /> View All IRs
            </Link>
          </Button>
        </div>
      </div>

      {/* Overdue Alert */}
      {stats && stats.overdue > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              {stats.overdue} overdue inspection{stats.overdue > 1 ? 's' : ''} require attention
            </p>
          </div>
          <Button variant="ghost" size="sm" className="text-red-700 hover:text-red-800 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30 h-8 text-xs" asChild>
            <Link href="/dashboard/inspections?highlight=overdue">View &rarr;</Link>
          </Button>
        </div>
      )}

      {/* Role-Specific Action Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {isPart1Approver && (
          <>
            <StatCard icon={CheckSquare} label="Total Inspections" value={total} sub="All requests" color="green" href="/dashboard/inspections" />
            <StatCard
              icon={Clock}
              label="Pending Part I Approval"
              value={actions.pending_part1_approval || actions.pending_approval || 0}
              sub="Awaiting your Part I approval"
              color="blue"
              highlight={!!(actions.pending_part1_approval || actions.pending_approval)}
              href="/dashboard/inspections?highlight=pending_part1"
            />
            <StatCard icon={UserCheck} label="Needs Assignment" value={actions.needs_assignment || 0} sub="No inspector assigned" color="saffron" highlight={!!actions.needs_assignment} href="/dashboard/inspections?highlight=needs_assignment" />
            <StatCard icon={AlertCircle} label="Overdue" value={stats?.overdue || 0} sub="Past due date" color="red" highlight={!!stats?.overdue} href="/dashboard/inspections?highlight=overdue" />
          </>
        )}
        {!isPart1Approver && userRole === 'administrator' && (
          <>
            <StatCard icon={CheckSquare} label="Total Inspections" value={total} sub="All requests" color="green" href="/dashboard/inspections" />
            <StatCard icon={Users} label="Active Users" value={actions.total_users || 0} sub="System users" color="violet" href="/dashboard/users" />
            <StatCard icon={FolderKanban} label="Active Projects" value={actions.total_projects || 0} sub="Ongoing" color="teal" href="/dashboard/projects" />
            <StatCard icon={AlertCircle} label="Needs Action" value={(actions.pending_approval || 0) + (actions.needs_assignment || 0)} sub={`${actions.pending_approval || 0} approvals, ${actions.needs_assignment || 0} assignments`} color="amber" href="/dashboard/inspections?highlight=action" />
          </>
        )}
        {!isPart1Approver && (userRole === 'qa_approver' || userRole === 'qa_head' || userRole === 'os_director') && (
          <>
            <StatCard icon={CheckSquare} label="Total Inspections" value={total} sub="All requests" color="green" href="/dashboard/inspections" />
            <StatCard icon={Clock} label="Pending Forward" value={actions.pending_approval || 0} sub={userRole === 'os_director' ? 'Awaiting request approval' : 'Awaiting your review'} color="blue" highlight={!!actions.pending_approval} href="/dashboard/inspections?highlight=pending_forward" />
            <StatCard icon={UserCheck} label="Needs Assignment" value={actions.needs_assignment || 0} sub="No inspector assigned" color="saffron" highlight={!!actions.needs_assignment} href="/dashboard/inspections?highlight=needs_assignment" />
            <StatCard icon={TrendingUp} label="Completion Rate" value={`${stats?.completionRate.percentage || 0}%`} sub={`${stats?.completionRate.completed || 0} of ${stats?.completionRate.total || 0} this month`} color="teal" />
          </>
        )}
        {!isPart1Approver && userRole === 'ordaqa_head' && (
          <>
            <StatCard icon={CheckSquare} label="ORDAQA Inspections" value={total} sub="Forwarded to ORDAQA" color="violet" href="/dashboard/inspections" />
            <StatCard
              icon={Activity}
              label="Active at ORDAQA"
              value={actions.active_ordaqa || 0}
              sub="Assigned or in progress"
              color="blue"
              href="/dashboard/inspections?highlight=in_progress"
            />
            <StatCard icon={Shield} label="Part V Pending" value={actions.needs_assignment || 0} sub="Awaiting your approval" color="saffron" highlight={!!actions.needs_assignment} href="/dashboard/inspections?highlight=action" />
            <StatCard icon={TrendingUp} label="Completion Rate" value={`${stats?.completionRate.percentage || 0}%`} sub={`${stats?.completionRate.completed || 0} of ${stats?.completionRate.total || 0} this month`} color="teal" />
          </>
        )}
        {!isPart1Approver && userRole === 'request_approver' && (
          <>
            <StatCard icon={CheckSquare} label="Total Inspections" value={total} sub="All requests" color="green" href="/dashboard/inspections" />
            <StatCard icon={Clock} label="Pending Forward" value={actions.pending_approval || 0} sub="Awaiting your review" color="blue" highlight={!!actions.pending_approval} href="/dashboard/inspections?highlight=pending_forward" />
            <StatCard icon={UserCheck} label="Needs Assignment" value={actions.needs_assignment || 0} sub="No inspector assigned" color="saffron" highlight={!!actions.needs_assignment} href="/dashboard/inspections?highlight=needs_assignment" />
            <StatCard icon={AlertCircle} label="Overdue" value={stats?.overdue || 0} sub="Past due date" color="red" highlight={!!stats?.overdue} href="/dashboard/inspections?highlight=overdue" />
          </>
        )}
        {!isPart1Approver && (userRole === 'inspector' || userRole === 'ordaqa_inspector') && (
          <>
            <StatCard
              icon={ClipboardCheck}
              label={userRole === 'inspector' ? 'Part IV Pending' : 'Part V Pending'}
              value={
                userRole === 'inspector'
                  ? (actions.pending_part4 || 0)
                  : (actions.pending_part5 || 0)
              }
              sub={userRole === 'inspector' ? 'Fill Part IV report' : 'Fill Part V (Sections 24–25)'}
              color="blue"
              highlight={
                userRole === 'inspector'
                  ? !!actions.pending_part4
                  : !!actions.pending_part5
              }
              href={
                userRole === 'inspector'
                  ? '/dashboard/inspections?highlight=pending_part4'
                  : '/dashboard/inspections?highlight=pending_part5'
              }
            />
            <StatCard icon={Activity} label="In Progress" value={actions.my_in_progress || 0} sub="Currently working" color="amber" href="/dashboard/inspections?highlight=in_progress" />
            <StatCard icon={AlertCircle} label="Overdue" value={stats?.overdue || 0} sub="Past due date" color="red" highlight={!!stats?.overdue} href="/dashboard/inspections?highlight=overdue" />
            <StatCard icon={TrendingUp} label="Completion Rate" value={`${stats?.completionRate.percentage || 0}%`} sub={`${stats?.completionRate.completed || 0} of ${stats?.completionRate.total || 0} this month`} color="green" />
          </>
        )}
        {!isPart1Approver && userRole === 'initiator' && (
          <>
            <StatCard icon={FileText} label="My Requests" value={total} sub="Total submitted" color="blue" href="/dashboard/inspections" />
            <StatCard
              icon={AlertCircle}
              label="Returned to Designer"
              value={actions.returned_to_designer || 0}
              sub="Update Part I and resubmit"
              color="red"
              highlight={!!actions.returned_to_designer}
              href="/dashboard/inspections?highlight=returned_to_designer"
            />
            <StatCard icon={FileText} label="Drafts" value={actions.my_drafts || 0} sub="Not yet submitted" color="teal" highlight={!!actions.my_drafts} href="/dashboard/inspections?highlight=drafts" />
            <StatCard icon={Clock} label="Pending" value={actions.my_pending || 0} sub="Awaiting action" color="violet" href="/dashboard/inspections?highlight=pending" />
          </>
        )}
      </div>

      {/* Quick Actions for Approver roles */}
      {(isPart1Approver || userRole === 'qa_approver' || userRole === 'qa_head' || userRole === 'request_approver' || userRole === 'administrator') && (actions.pending_approval > 0 || actions.needs_assignment > 0 || (actions.pending_part1_approval || 0) > 0) && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-l-4 border-l-amber-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/40 p-2 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Action Required</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {isPart1Approver && (actions.pending_part1_approval || actions.pending_approval) > 0 && (
                      <>{actions.pending_part1_approval || actions.pending_approval} pending Part I approval</>
                    )}
                    {!isPart1Approver && actions.pending_approval > 0 && `${actions.pending_approval} pending approval`}
                    {!isPart1Approver && actions.pending_approval > 0 && actions.needs_assignment > 0 && ' · '}
                    {!isPart1Approver && actions.needs_assignment > 0 && `${actions.needs_assignment} need inspector assignment`}
                    {isPart1Approver && (actions.needs_assignment || 0) > 0 && (
                      <> · {actions.needs_assignment} need inspector assignment</>
                    )}
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-xs" asChild>
                <Link href={isPart1Approver ? '/dashboard/inspections?highlight=pending_part1' : '/dashboard/inspections?action=review'}>
                  Review Now
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {userRole === 'initiator' && (actions.returned_to_designer || 0) > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-l-4 border-l-orange-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-900/40 p-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">Action Required</p>
                  <p className="text-xs text-orange-700 dark:text-orange-400">
                    {actions.returned_to_designer} inspection request
                    {actions.returned_to_designer === 1 ? '' : 's'} returned — update Part I and resubmit
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs" asChild>
                <Link href="/dashboard/inspections?highlight=returned_to_designer">
                  Review Now
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {userRole === 'inspector' && (actions.pending_part4 || 0) > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-l-4 border-l-emerald-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 dark:bg-emerald-900/40 p-2 rounded-lg">
                  <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Action Required</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {actions.pending_part4} inspection request
                    {actions.pending_part4 === 1 ? '' : 's'} awaiting Part IV
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs" asChild>
                <Link href="/dashboard/inspections?highlight=pending_part4">
                  Fill Part IV
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {userRole === 'ordaqa_inspector' && (actions.pending_part5 || 0) > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20 border-l-4 border-l-cyan-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-100 dark:bg-cyan-900/40 p-2 rounded-lg">
                  <ClipboardCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-cyan-900 dark:text-cyan-200">Action Required</p>
                  <p className="text-xs text-cyan-700 dark:text-cyan-400">
                    {actions.pending_part5} inspection request
                    {actions.pending_part5 === 1 ? '' : 's'} awaiting Part V
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white h-8 text-xs" asChild>
                <Link href="/dashboard/inspections?highlight=pending_part5">
                  Fill Part V
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {userRole === 'ordaqa_head' && (actions.pending_approval > 0 || actions.needs_assignment > 0) && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-l-4 border-l-violet-500">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-violet-100 dark:bg-violet-900/40 p-2 rounded-lg">
                  <Shield className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">Action Required</p>
                  <p className="text-xs text-violet-700 dark:text-violet-400">
                    {actions.pending_approval > 0 && `${actions.pending_approval} pending Part III`}
                    {actions.pending_approval > 0 && actions.needs_assignment > 0 && ' · '}
                    {actions.needs_assignment > 0 && `${actions.needs_assignment} Part V awaiting approval`}
                  </p>
                </div>
              </div>
              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white h-8 text-xs" asChild>
                <Link href="/dashboard/inspections?action=review">Review Now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observation Chats — all Parts 1–5 stakeholders */}
      {roleCanViewObservationChats(userRole) && (
        <Card
          className={`border-0 shadow-sm ${
            obsChatStats.unreadCount > 0
              ? 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/25 dark:to-orange-950/20 border-l-4 border-l-red-500 ring-1 ring-red-200/60 dark:ring-red-900/40'
              : 'bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20 border-l-4 border-l-sky-500'
          }`}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative bg-sky-100 dark:bg-sky-900/40 p-2 rounded-lg shrink-0">
                  <MessageSquare className={`h-4 w-4 ${obsChatStats.unreadCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400'}`} />
                  {obsChatStats.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {obsChatStats.unreadCount > 9 ? '9+' : obsChatStats.unreadCount}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${obsChatStats.unreadCount > 0 ? 'text-red-900 dark:text-red-200' : 'text-sky-900 dark:text-sky-200'}`}>
                      Observation Chats
                    </p>
                    {obsChatStats.unreadCount > 0 && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-red-500 hover:bg-red-500 text-white animate-pulse">
                        New messages
                      </Badge>
                    )}
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${obsChatStats.unreadCount > 0 ? 'text-red-700 dark:text-red-300 font-medium' : 'text-sky-700 dark:text-sky-400'}`}>
                    {obsChatStats.unreadCount > 0
                      ? `You have ${obsChatStats.unreadCount} new message${obsChatStats.unreadCount !== 1 ? 's' : ''} in observation chat${obsChatStats.unreadCount !== 1 ? 's' : ''}`
                      : obsChatStats.total === 0
                        ? 'No observation discussions yet'
                        : `${obsChatStats.openCount} open thread${obsChatStats.openCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className={`h-8 text-xs shrink-0 text-white ${
                  obsChatStats.unreadCount > 0
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
                asChild
              >
                <Link href="/dashboard/observation-chats">
                  {obsChatStats.unreadCount > 0 ? 'Read Messages' : 'View Chats'}{' '}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      <Card className="border-0 shadow-sm max-w-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Notifications</CardTitle>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{notifications.length}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-amber-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{(() => { try { const d = new Date(n.created_at); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; } catch { return n.created_at; } })()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No new notifications</p>
          )}
        </CardContent>
      </Card>

      {/* All IRs — clear table for every role */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Summary of inspection requests</CardTitle>
              <CardDescription className="text-xs">
                {inspectionRequests.length > 0
                  ? `Showing ${inspectionRequests.length} request${inspectionRequests.length === 1 ? '' : 's'} in your scope`
                  : 'No inspection requests in your scope'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-8 text-muted-foreground self-start sm:self-auto" asChild>
              <Link href="/dashboard/inspections">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {inspectionRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="border-y bg-muted/40 text-left">
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground whitespace-nowrap">IR No.</th>
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground">Project / Programme</th>
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground">Initiator</th>
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground">Inspector</th>
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground whitespace-nowrap">Due date</th>
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground whitespace-nowrap">Created</th>
                    <th className="px-4 py-2.5 font-semibold text-xs text-muted-foreground w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {inspectionRequests.map((r) => {
                    const inspectors =
                      (r.inspector_names && String(r.inspector_names).trim()) ||
                      r.inspector_name ||
                      '—';
                    const projectLabel =
                      r.project_name ||
                      r.programme_name ||
                      r.project_code ||
                      '—';
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="px-4 py-3 align-top">
                          <Link
                            href={`/dashboard/inspections/${r.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {r.request_number || `IR-${r.id}`}
                          </Link>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <p className="font-medium text-foreground leading-snug max-w-[320px]">
                            {projectLabel}
                          </p>
                          {r.project_code && r.project_name ? (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {r.project_code}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top whitespace-nowrap">
                          <Badge className={`text-[11px] font-medium ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-700'}`}>
                            {formatStatusLabel(r.status)}
                          </Badge>
                          {(() => {
                            const forwardedStatuses = new Set([
                              'pending_request_approval',
                              'pending_part1_approval',
                              'request_approved',
                              'assigned',
                              'in_progress',
                              'inspection_completed',
                              'pending_qa_approval',
                              'qa_approved',
                              'pending_ordaqa_approval',
                              'completed',
                              'approved',
                              'closed',
                              'returned_to_designer',
                              'pending',
                            ]);
                            const showPart1Route = forwardedStatuses.has(String(r.status || ''));
                            if (!showPart1Route) return null;
                            const forwardedTo =
                              r.request_approver_name ||
                              r.nominated_request_approver_name ||
                              null;
                            const approvedBy =
                              [
                                'pending_part1_approval',
                                'pending_request_approval',
                                'pending',
                                'draft',
                                'rejected',
                                'returned_to_designer',
                              ].includes(String(r.status || ''))
                                ? null
                                : r.part1_approved_by_name?.trim() || null;
                            if (!forwardedTo && !approvedBy && String(r.status) !== 'pending_part1_approval') {
                              return null;
                            }
                            return (
                              <div className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground leading-snug max-w-[180px]">
                                <p>
                                  <span className="font-medium text-foreground/80">Forwarded to:</span>{' '}
                                  {forwardedTo || '—'}
                                </p>
                                <p>
                                  <span className="font-medium text-foreground/80">Approved by:</span>{' '}
                                  {approvedBy || (String(r.status) === 'pending_part1_approval' ? 'Pending' : '—')}
                                </p>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 align-top text-sm whitespace-nowrap">
                          {r.initiator_name || '—'}
                        </td>
                        <td className="px-4 py-3 align-top text-sm max-w-[160px]">
                          <span className="line-clamp-2">{inspectors}</span>
                        </td>
                        <td className="px-4 py-3 align-top text-sm whitespace-nowrap tabular-nums">
                          {r.due_date ? formatCalendarDateDisplay(r.due_date) : '—'}
                        </td>
                        <td className="px-4 py-3 align-top text-sm whitespace-nowrap tabular-nums text-muted-foreground">
                          {r.created_at
                            ? formatCalendarDateDisplay(r.created_at)
                            : r.request_date
                              ? formatCalendarDateDisplay(r.request_date)
                              : '—'}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                            <Link href={`/dashboard/inspections/${r.id}`} aria-label={`Open ${r.request_number}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No inspection requests to display
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin-Only Quick Links */}
      {userRole === 'administrator' && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Administration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-4">
              <AdminLink href="/dashboard/users" icon={Users} label="Manage Users" desc="Add, edit users" />
              <AdminLink href="/dashboard/projects" icon={FolderKanban} label="Projects" desc="Manage projects" />
              <AdminLink href="/dashboard/inspection-types" icon={ClipboardCheck} label="Inspection Types" desc="Configure types" />
              <AdminLink href="/dashboard/reports" icon={BarChart3} label="Reports" desc="Generate reports" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, highlight, href }: {
  icon: any; label: string; value: number | string; sub: string; color: string; highlight?: boolean; href?: string;
}) {
  const colorMap: Record<string, { card: string; iconBg: string; iconText: string; valueText: string; labelText: string; subText: string; ring: string }> = {
    blue: {
      card: 'bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-blue-100', subText: 'text-blue-200/80',
      ring: 'ring-blue-300 dark:ring-blue-700',
    },
    green: {
      card: 'bg-gradient-to-br from-emerald-500 to-emerald-700 dark:from-emerald-600 dark:to-emerald-900',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-emerald-100', subText: 'text-emerald-200/80',
      ring: 'ring-emerald-300 dark:ring-emerald-700',
    },
    amber: {
      card: 'bg-gradient-to-br from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-800',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-amber-100', subText: 'text-amber-200/80',
      ring: 'ring-amber-300 dark:ring-amber-700',
    },
    saffron: {
      card: 'bg-gradient-to-br from-[#f0b429] via-[#e8940c] to-[#c2410c] dark:from-amber-600 dark:via-orange-600 dark:to-orange-900',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-amber-50', subText: 'text-amber-100/90',
      ring: 'ring-orange-300 dark:ring-orange-600',
    },
    red: {
      card: 'bg-gradient-to-br from-red-500 to-rose-700 dark:from-red-600 dark:to-rose-900',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-red-100', subText: 'text-red-200/80',
      ring: 'ring-red-300 dark:ring-red-700',
    },
    violet: {
      card: 'bg-gradient-to-br from-violet-500 to-purple-700 dark:from-violet-600 dark:to-purple-900',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-violet-100', subText: 'text-violet-200/80',
      ring: 'ring-violet-300 dark:ring-violet-700',
    },
    teal: {
      card: 'bg-gradient-to-br from-teal-500 to-teal-700 dark:from-teal-600 dark:to-teal-900',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-teal-100', subText: 'text-teal-200/80',
      ring: 'ring-teal-300 dark:ring-teal-700',
    },
    gray: {
      card: 'bg-gradient-to-br from-slate-500 to-slate-700 dark:from-slate-600 dark:to-slate-900',
      iconBg: 'bg-white/20', iconText: 'text-white',
      valueText: 'text-white', labelText: 'text-slate-100', subText: 'text-slate-200/80',
      ring: 'ring-slate-300 dark:ring-slate-700',
    },
  };
  const c = colorMap[color] || colorMap.blue;

  const card = (
    <Card className={`border-0 shadow-lg overflow-hidden ${c.card} ${highlight ? `ring-2 ${c.ring}` : ''} ${href ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}>
      <CardContent className="pt-5 pb-4 relative">
        <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/5 -translate-y-6 translate-x-6" />
        <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/5 translate-y-8 -translate-x-4" />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className={`${c.iconBg} p-2 rounded-lg backdrop-blur-sm`}>
              <Icon className={`h-4 w-4 ${c.iconText}`} />
            </div>
            {highlight && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/60 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" /></span>}
          </div>
          <p className={`text-2xl font-bold ${c.valueText}`}>{value}</p>
          <p className={`text-xs font-medium mt-0.5 ${c.labelText}`}>{label}</p>
          <p className={`text-[11px] mt-0.5 ${c.subText}`}>{sub}</p>
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{card}</Link> : card;
}

function AdminLink({ href, icon: Icon, label, desc }: { href: string; icon: any; label: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg group-hover:bg-[#1e3a5f]/10 transition-colors">
        <Icon className="h-4 w-4 text-slate-500 group-hover:text-[#1e3a5f] dark:group-hover:text-blue-400 transition-colors" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </Link>
  );
}
