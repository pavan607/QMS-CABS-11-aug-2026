'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { MessageSquare, CircleCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ObservationChatDialog } from '@/components/observation-chat-dialog';
import { generateObservationChatId, roleCanViewObservationChats } from '@/lib/observation-chats-shared';
import type { ObservationPart } from '@/lib/observation-chats-shared';
import { acknowledgeObservationChat } from '@/lib/observation-chat-client';

export interface ObservationRemarkRow {
  sl_no?: string;
  observation?: string;
  action_required?: string;
  closed_on?: string;
  signature?: string;
  chat_id?: string;
}

export interface ObservationThreadMeta {
  threadId: number;
  isClosed: boolean;
  unreadCount: number;
  sentToInitiator: boolean;
}

interface ObservationChatActionsProps {
  inspectionRequestId: number;
  part: ObservationPart;
  remark: ObservationRemarkRow;
  requestNumber?: string;
  initiatorName?: string;
  canClose?: boolean;
  canEdit?: boolean;
  onChatIdChange?: (chatId: string) => void;
  onClosed?: () => void;
  onRefreshThreadStatus?: () => void;
  threadMeta?: ObservationThreadMeta | null;
}

export function ObservationChatActions({
  inspectionRequestId,
  part,
  remark,
  requestNumber,
  canClose = false,
  canEdit = false,
  onChatIdChange,
  onClosed,
  onRefreshThreadStatus,
  threadMeta = null,
}: ObservationChatActionsProps) {
  const { data: session } = useSession();
  const canViewChats = roleCanViewObservationChats((session?.user as { role?: string })?.role || '');
  const observationText = String(remark.observation || '').trim();
  const hasObservation = observationText.length > 0;

  const [chatId, setChatId] = useState(() => remark.chat_id?.trim() || '');
  const [activeObservationKey, setActiveObservationKey] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [threadId, setThreadId] = useState<number | null>(threadMeta?.threadId ?? null);
  const [isClosed, setIsClosed] = useState(threadMeta?.isClosed ?? false);
  const [unreadCount, setUnreadCount] = useState(threadMeta?.unreadCount ?? 0);
  const [sentToInitiator, setSentToInitiator] = useState(threadMeta?.sentToInitiator ?? false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (remark.chat_id?.trim()) setChatId(remark.chat_id.trim());
  }, [remark.chat_id]);

  useEffect(() => {
    if (!threadMeta) return;
    setThreadId(threadMeta.threadId);
    setIsClosed(threadMeta.isClosed);
    setUnreadCount(threadMeta.unreadCount);
    setSentToInitiator(threadMeta.sentToInitiator);
  }, [threadMeta]);

  const ensureChatId = (): string => {
    const existing = chatId || remark.chat_id?.trim() || '';
    if (existing) return existing;
    const id = generateObservationChatId();
    setChatId(id);
    onChatIdChange?.(id);
    return id;
  };

  const markThreadRead = useCallback(async (id: number) => {
    try {
      await acknowledgeObservationChat(id);
      setUnreadCount(0);
      onRefreshThreadStatus?.();
    } catch {
      /* ignore */
    }
  }, [onRefreshThreadStatus]);

  const handleOpenChat = async () => {
    const key = ensureChatId();
    setActiveObservationKey(key);
    setChatOpen(true);
    const id = threadId ?? threadMeta?.threadId;
    if (id) await markThreadRead(id);
  };

  const handleClose = async () => {
    if (!canClose || isClosed || !hasObservation) return;
    setClosing(true);
    try {
      let id = threadId;
      if (!id) {
        const key = ensureChatId();
        const ensureRes = await fetch('/api/observation-chats/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inspection_request_id: inspectionRequestId,
            part,
            observation_key: key,
            observation_preview: observationText,
          }),
        });
        const ensureData = await ensureRes.json();
        if (!ensureRes.ok) throw new Error(ensureData.error || 'Failed to prepare observation');
        id = ensureData.thread?.id;
        if (id) setThreadId(id);
      }
      if (!id) return;

      const res = await fetch(`/api/observation-chats/${id}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close');
      setIsClosed(true);
      onClosed?.();
      onRefreshThreadStatus?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('observation-chat-acknowledged'));
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to close observation');
    } finally {
      setClosing(false);
    }
  };

  if (!canViewChats || !hasObservation) return null;

  const chatReady = sentToInitiator || !canClose;

  return (
    <>
      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={
            isClosed
              ? 'View closed observation chat'
              : canClose && !sentToInitiator
                ? 'Save Part IV/V to send this observation, then open chat'
                : unreadCount > 0
                  ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
                  : 'Open chat'
          }
          className={`relative h-7 w-7 ${
            isClosed
              ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
              : canClose && !sentToInitiator
                ? 'text-muted-foreground/40 cursor-not-allowed'
                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
          }`}
          disabled={!isClosed && !chatReady}
          onClick={() => void handleOpenChat()}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {unreadCount > 0 && !isClosed && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {canClose && !isClosed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Close observation"
            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            disabled={closing}
            onClick={() => void handleClose()}
          >
            {closing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CircleCheck className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </div>

      <ObservationChatDialog
        open={chatOpen}
        onOpenChange={(open) => {
          setChatOpen(open);
          if (!open) onRefreshThreadStatus?.();
        }}
        threadId={threadId}
        inspectionRequestId={inspectionRequestId}
        part={part}
        observationKey={activeObservationKey || chatId || remark.chat_id?.trim() || ''}
        observationPreview={observationText}
        isClosed={isClosed}
        requestNumber={requestNumber}
        canReply={canClose}
        canClose={canClose}
        canEdit={canEdit}
        onClosed={() => {
          setIsClosed(true);
          onClosed?.();
          onRefreshThreadStatus?.();
        }}
        onThreadReady={(id) => {
          setThreadId(id);
          void markThreadRead(id);
        }}
        onMessageSent={() => onRefreshThreadStatus?.()}
        onAcknowledged={() => {
          setUnreadCount(0);
          onRefreshThreadStatus?.();
        }}
      />
    </>
  );
}

export type ObservationThreadStatusMap = Record<string, ObservationThreadMeta>;

/** Load thread status (closed, sent, unread) for observation rows on an inspection. */
export function useObservationThreadStatus(
  inspectionRequestId: number,
  enabled: boolean
): { statusMap: ObservationThreadStatusMap; refresh: () => void } {
  const { data: session } = useSession();
  const canViewChats = roleCanViewObservationChats((session?.user as { role?: string })?.role || '');
  const [statusMap, setStatusMap] = useState<ObservationThreadStatusMap>({});
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!canViewChats || !enabled || !inspectionRequestId) return;
    let cancelled = false;

    const load = () => {
      fetch('/api/observation-chats', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const map: ObservationThreadStatusMap = {};
          for (const t of data.threads || []) {
            if (Number(t.inspection_request_id) === inspectionRequestId && t.observation_key) {
              map[t.observation_key] = {
                threadId: t.id,
                isClosed: !!t.is_closed,
                unreadCount: Number(t.unread_count) || 0,
                sentToInitiator: !!t.sent_to_initiator_at,
              };
            }
          }
          setStatusMap(map);
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [inspectionRequestId, enabled, tick, canViewChats]);

  return { statusMap, refresh };
}
