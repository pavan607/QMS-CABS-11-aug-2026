'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, Check, CheckCheck, ExternalLink, Info,
  AlertTriangle, CheckCircle2, XCircle, Clock, FileText, Trash2, RotateCcw, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  entity_type?: string;
  entity_id?: number;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  info:                  { icon: Info,          color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/40' },
  success:               { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  warning:               { icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/40' },
  error:                 { icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-950/40' },
  request_submitted:     { icon: FileText,      color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/40' },
  request_assigned:      { icon: FileText,      color: 'text-sky-500',     bg: 'bg-sky-50 dark:bg-sky-950/40' },
  request_approved:      { icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  request_rejected:      { icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-950/40' },
  inspection_completed:  { icon: CheckCircle2,  color: 'text-teal-500',    bg: 'bg-teal-50 dark:bg-teal-950/40' },
  overdue_alert:         { icon: Clock,         color: 'text-orange-500',  bg: 'bg-orange-50 dark:bg-orange-950/40' },
  returned_to_designer:  { icon: AlertTriangle, color: 'text-orange-600',  bg: 'bg-orange-50 dark:bg-orange-950/40' },
  ir_resubmitted_after_return: { icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  forwarded_to_qa_head:       { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  forwarded_to_ordaqa:      { icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  memo_returned_to_qa_head: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  team_head_qa_nominated:     { icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  part2_inspector_assigned:   { icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  part2_inspector_replaced:   { icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  part4_saved:                { icon: FileText, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/40' },
  part4_pending_team_head_approval: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  part4_team_head_rejected:   { icon: RotateCcw, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  part4_team_head_approved:   { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  part4_team_head_edited:     { icon: FileText, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/40' },
  part4_forwarded_for_part5:  { icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  part3_completed:            { icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  ordaqa_delegated_to_rqa:    { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  part5_pending_ordaqa_approval: { icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  part5_head_send_back:        { icon: RotateCcw, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  part5_ordaqa_approved:       { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  part5_approved_start_inspection: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/40' },
  request_closed:             { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
};

function fmtTimeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const diffMs = Date.now() - d.getTime();
    // Clock skew / future timestamps
    if (diffMs < 60_000) return 'Just now';
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function NotificationDropdown() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const onChatAck = () => void fetchNotifications();
    window.addEventListener('observation-chat-acknowledged', onChatAck);
    return () => {
      clearInterval(interval);
      window.removeEventListener('observation-chat-acknowledged', onChatAck);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAsRead = async (ids: number[]) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_ids: ids }),
      });
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - ids.length));
    } catch { /* silent */ }
  };

  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
    setLoading(false);
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch('/api/notifications', { method: 'DELETE' });
      if (!res.ok) return;
      setNotifications([]);
      setUnreadCount(0);
    } catch { /* silent */ }
    setClearing(false);
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markAsRead([n.id]);
    if (n.entity_type === 'inspection_request' && n.entity_id) {
      setOpen(false);
      router.push(`/dashboard/inspections/${n.entity_id}`);
    }
    if (n.entity_type === 'observation_thread') {
      setOpen(false);
      router.push('/dashboard/observation-chats');
    }
  };

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
        disabled
        aria-hidden
        tabIndex={-1}
      >
        <Bell className="h-[18px] w-[18px]" />
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-white/70 hover:text-white hover:bg-white/10">
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-bold ring-2 ring-[#1e3a5f] dark:ring-[#0f1b2d]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="z-[100] w-[380px] p-0 max-h-[min(480px,85vh)] flex flex-col overflow-hidden"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h4 className="truncate text-sm font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent hover:text-destructive disabled:pointer-events-none disabled:opacity-50 dark:bg-popover"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                clearAll();
              }}
              disabled={loading || clearing || (notifications.length === 0 && unreadCount === 0)}
              title="Remove all notifications"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              <span>Clear all</span>
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md bg-secondary px-2.5 text-xs font-medium text-secondary-foreground shadow-sm hover:bg-secondary/80 disabled:pointer-events-none disabled:opacity-50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  markAllAsRead();
                }}
                disabled={loading || clearing}
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  className={`flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 border-b border-border/40 ${
                    !n.is_read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => handleClick(n)}
                >
                  <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-0.5 ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[13px] leading-snug ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <button
                          className="flex-shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          title="Mark as read"
                          onClick={(e) => { e.stopPropagation(); markAsRead([n.id]); }}
                        >
                          <Check className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground/70">{fmtTimeAgo(n.created_at)}</span>
                      {n.entity_type === 'inspection_request' && n.entity_id && (
                        <span className="text-[11px] text-blue-500 flex items-center gap-0.5">
                          <ExternalLink className="h-2.5 w-2.5" /> View
                        </span>
                      )}
                      {n.entity_type === 'observation_thread' && (
                        <span className="text-[11px] text-blue-500 flex items-center gap-0.5">
                          <MessageSquare className="h-2.5 w-2.5" /> Open chats
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {notifications.length > 0 && (
          <>
            <Separator className="shrink-0" />
            <div className="shrink-0 p-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => { setOpen(false); router.push('/dashboard'); }}
              >
                View all on Dashboard
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
