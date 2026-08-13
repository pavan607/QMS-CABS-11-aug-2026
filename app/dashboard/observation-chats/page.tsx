'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  ArrowLeft,
  Lock,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ObservationChatDialog } from '@/components/observation-chat-dialog';
import { roleCanViewObservationChats, type ObservationPart } from '@/lib/observation-chats-shared';
import { acknowledgeObservationChat } from '@/lib/observation-chat-client';
import { formatDateTimeDisplay } from '@/lib/inspection-display';

interface ThreadItem {
  id: number;
  inspection_request_id: number;
  part: ObservationPart;
  observation_key: string;
  observation_preview: string | null;
  is_closed: boolean;
  sent_to_initiator_at?: string | null;
  request_number: string;
  title: string;
  initiator_name: string;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

interface InspectionGroup {
  inspectionRequestId: number;
  requestNumber: string;
  title: string;
  initiatorName: string;
  observations: ThreadItem[];
  openCount: number;
  closedCount: number;
  unreadCount: number;
  latestActivity: string | null;
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return formatDateTimeDisplay(iso, '');
}

function groupThreadsByInspection(threads: ThreadItem[]): InspectionGroup[] {
  const map = new Map<number, InspectionGroup>();

  for (const t of threads) {
    const irId = t.inspection_request_id;
    let group = map.get(irId);
    if (!group) {
      group = {
        inspectionRequestId: irId,
        requestNumber: t.request_number,
        title: t.title,
        initiatorName: t.initiator_name,
        observations: [],
        openCount: 0,
        closedCount: 0,
        unreadCount: 0,
        latestActivity: null,
      };
      map.set(irId, group);
    }
    group.observations.push(t);
    if (t.is_closed) group.closedCount += 1;
    else group.openCount += 1;
    group.unreadCount += Number(t.unread_count) || 0;

    const candidate = t.last_message_at || t.sent_to_initiator_at || null;
    if (candidate && (!group.latestActivity || candidate > group.latestActivity)) {
      group.latestActivity = candidate;
    }
  }

  return [...map.values()]
    .map((g) => ({
      ...g,
      observations: [...g.observations].sort((a, b) => {
        if (a.is_closed !== b.is_closed) return a.is_closed ? 1 : -1;
        const aTime = a.last_message_at || a.sent_to_initiator_at || '';
        const bTime = b.last_message_at || b.sent_to_initiator_at || '';
        return bTime.localeCompare(aTime);
      }),
    }))
    .sort((a, b) => (b.latestActivity || '').localeCompare(a.latestActivity || ''));
}

export default function ObservationChatsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as { role?: string })?.role || '';
  const canViewChats = roleCanViewObservationChats(userRole);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<ThreadItem | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const openChat = (t: ThreadItem) => {
    setActiveChat(t);
    setThreads((prev) =>
      prev.map((item) =>
        item.id === t.id ? { ...item, unread_count: 0 } : item
      )
    );
    void acknowledgeObservationChat(t.id).then(() => void loadThreads());
  };

  const handleChatAcknowledged = () => {
    if (activeChat) {
      setThreads((prev) =>
        prev.map((item) =>
          item.id === activeChat.id ? { ...item, unread_count: 0 } : item
        )
      );
    }
    void loadThreads();
  };

  const loadThreads = async () => {
    if (!canViewChats) return;
    setLoading(true);
    try {
      const res = await fetch('/api/observation-chats', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        const list: ThreadItem[] = data.threads || [];
        setThreads(list);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated' && !canViewChats) {
      router.replace('/dashboard');
      return;
    }
    if (status === 'authenticated' && canViewChats) {
      void loadThreads();
    }
  }, [status, canViewChats]);

  const inspectionGroups = useMemo(() => groupThreadsByInspection(threads), [threads]);

  const toggleExpanded = (irId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(irId)) next.delete(irId);
      else next.add(irId);
      return next;
    });
  };

  const roleLabel =
    userRole === 'inspector'
      ? 'R&QA Inspector'
      : userRole === 'ordaqa_inspector'
        ? 'DGAQA Inspector'
        : userRole === 'initiator'
          ? 'Initiator'
          : userRole === 'request_approver'
            ? 'Request Approver'
            : userRole === 'qa_approver'
              ? 'Team Head – QA'
              : userRole === 'qa_head'
                ? 'QA Head'
                : userRole === 'ordaqa_head'
                  ? 'ORDAQA Head'
                  : 'User';

  const openThreads = threads.filter((t) => !t.is_closed);
  const closedThreads = threads.filter((t) => t.is_closed);
  const totalUnread = threads.reduce((sum, t) => sum + (Number(t.unread_count) || 0), 0);

  if (status !== 'authenticated' || !canViewChats) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Observation Chats</h2>
          <p className="text-sm text-muted-foreground">
            {roleLabel} — inspection requests and their observation threads
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold">{inspectionGroups.length}</p>
            <p className="text-xs text-muted-foreground">Inspection requests</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold">{threads.length}</p>
            <p className="text-xs text-muted-foreground">Observation threads</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold text-blue-600">{openThreads.length}</p>
            <p className="text-xs text-muted-foreground">Open for discussion</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold text-red-600">{totalUnread}</p>
            <p className="text-xs text-muted-foreground">Unread messages</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Inspection Requests &amp; Observations
          </CardTitle>
          <CardDescription className="text-xs">
            Expand an inspection request to view its observations, then click an observation to open chat
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Loading...</p>
          ) : inspectionGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              No observation chats yet. Chats appear when Part IV or Part V observations are submitted.
            </p>
          ) : (
            <div className="divide-y">
              {inspectionGroups.map((group) => {
                const expanded = expandedIds.has(group.inspectionRequestId);
                return (
                  <div key={group.inspectionRequestId}>
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        className="flex flex-1 items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors min-w-0"
                        onClick={() => toggleExpanded(group.inspectionRequestId)}
                      >
                        <span className="shrink-0 text-muted-foreground">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                        <div className="bg-[#1e3a5f]/10 dark:bg-sky-950/40 p-2 rounded-lg shrink-0">
                          <ClipboardList className="h-4 w-4 text-[#1e3a5f] dark:text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{group.requestNumber}</span>
                            {group.unreadCount > 0 && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-red-500">
                                {group.unreadCount} unread
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {group.observations.length} observation{group.observations.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium truncate mt-0.5">
                            {group.title || 'Inspection request'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Initiator: {group.initiatorName || '—'}
                            {group.latestActivity ? ` · Last activity ${formatTime(group.latestActivity)}` : ''}
                          </p>
                        </div>
                      </button>
                      <Link
                        href={`/dashboard/inspections/${group.inspectionRequestId}`}
                        className="flex items-center px-4 text-muted-foreground hover:text-[#1e3a5f] hover:bg-slate-50 dark:hover:bg-slate-900/30 border-l"
                        title="Open inspection request"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>

                    {expanded && (
                      <div className="border-t bg-muted/10">
                        {group.observations.map((t, idx) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`w-full flex items-center gap-3 pl-12 pr-6 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors border-b last:border-b-0 ${
                              t.is_closed ? 'opacity-60' : ''
                            }`}
                            onClick={() => openChat(t)}
                          >
                            <span className="text-muted-foreground/50 text-xs font-mono w-5 shrink-0">
                              {idx + 1}.
                            </span>
                            <div
                              className={`p-1.5 rounded-md shrink-0 ${
                                t.is_closed ? 'bg-muted' : 'bg-blue-50 dark:bg-blue-950/40'
                              }`}
                            >
                              {t.is_closed ? (
                                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {t.part === 'part4' ? 'Part IV — R&QA' : 'Part V — DGAQA'}
                                </Badge>
                                {t.is_closed && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Closed
                                  </Badge>
                                )}
                                {t.unread_count > 0 && !t.is_closed && (
                                  <Badge className="text-[10px] px-1.5 py-0 bg-red-500">
                                    {t.unread_count} new
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm truncate mt-0.5">
                                {t.observation_preview || 'Observation'}
                              </p>
                              {t.last_message && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {t.last_message}
                                </p>
                              )}
                              {t.last_message_at && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatTime(t.last_message_at)}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {activeChat && (
        <ObservationChatDialog
          open={!!activeChat}
          onOpenChange={(open) => {
            if (!open) {
              setActiveChat(null);
              void loadThreads();
            }
          }}
          onAcknowledged={handleChatAcknowledged}
          onMessageSent={handleChatAcknowledged}
          onObservationEdited={(preview) => {
            setActiveChat((prev) => (prev ? { ...prev, observation_preview: preview } : prev));
            setThreads((prev) =>
              prev.map((item) =>
                item.id === activeChat.id ? { ...item, observation_preview: preview } : item
              )
            );
          }}
          threadId={activeChat.id}
          inspectionRequestId={activeChat.inspection_request_id}
          part={activeChat.part}
          observationKey={activeChat.observation_key}
          observationPreview={activeChat.observation_preview || ''}
          isClosed={activeChat.is_closed}
          requestNumber={activeChat.request_number}
          canEdit={userRole === 'qa_approver' || userRole === 'administrator'}
        />
      )}
    </div>
  );
}
