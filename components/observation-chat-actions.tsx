'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CircleCheck, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ObservationChatDialog } from '@/components/observation-chat-dialog';
import { generateObservationChatId } from '@/lib/observation-chats-shared';
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
  initiatorName = 'Initiator',
  canClose = false,
  onChatIdChange,
  onClosed,
  onRefreshThreadStatus,
  threadMeta = null,
}: ObservationChatActionsProps) {
  const observationText = String(remark.observation || '').trim();
  const actionRequiredText = String(remark.action_required || '').trim();
  const hasObservation = observationText.length > 0;
  const canSendFields = hasObservation && actionRequiredText.length > 0;

  const [chatId, setChatId] = useState(() => remark.chat_id?.trim() || '');
  const [activeObservationKey, setActiveObservationKey] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [threadId, setThreadId] = useState<number | null>(threadMeta?.threadId ?? null);
  const [isClosed, setIsClosed] = useState(threadMeta?.isClosed ?? false);
  const [unreadCount, setUnreadCount] = useState(threadMeta?.unreadCount ?? 0);
  const [sentToInitiator, setSentToInitiator] = useState(threadMeta?.sentToInitiator ?? false);
  const [closing, setClosing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendSuccessOpen, setSendSuccessOpen] = useState(false);
  const [confirmBanner, setConfirmBanner] = useState<string | null>(null);
  const [lastSentPreview, setLastSentPreview] = useState({ observation: '', actionRequired: '' });
  const [sentInitiatorName, setSentInitiatorName] = useState(initiatorName);

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

  useEffect(() => {
    if (!confirmBanner) return;
    const t = setTimeout(() => setConfirmBanner(null), 5000);
    return () => clearTimeout(t);
  }, [confirmBanner]);

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

  const handleSendToInitiator = async () => {
    if (!canClose || isClosed || !canSendFields || sending || sentToInitiator) return;
    setSending(true);
    try {
      const key = ensureChatId();
      const res = await fetch('/api/observation-chats/send-to-initiator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspection_request_id: inspectionRequestId,
          part,
          observation_key: key,
          observation: observationText,
          action_required: String(remark.action_required || '').trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      if (data.thread?.id) setThreadId(data.thread.id);
      setSentToInitiator(true);
      setSentInitiatorName(data.initiator_name || initiatorName);
      setLastSentPreview({
        observation: observationText,
        actionRequired: String(remark.action_required || '').trim(),
      });
      setSendSuccessOpen(true);
      onRefreshThreadStatus?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to send observation to initiator');
    } finally {
      setSending(false);
    }
  };

  const handleSendSuccessOk = () => {
    setSendSuccessOpen(false);
    setConfirmBanner(
      `Observation sent to ${sentInitiatorName} successfully. Continue the conversation in chat.`
    );
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

  if (!hasObservation || isClosed) return null;

  return (
    <>
      {confirmBanner && (
        <div className="fixed top-16 left-1/2 z-[100] -translate-x-1/2 max-w-md w-[calc(100%-2rem)] rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 shadow-lg dark:border-green-800 dark:bg-green-950/90 dark:text-green-100">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{confirmBanner}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={
            isClosed
              ? 'Chat closed'
              : canClose && !sentToInitiator
                ? `Send observation to ${initiatorName} first`
                : unreadCount > 0
                  ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}`
                  : 'Open chat'
          }
          className={`relative h-7 w-7 ${
            isClosed || (canClose && !sentToInitiator)
              ? 'text-muted-foreground/40 cursor-not-allowed'
              : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
          }`}
          disabled={isClosed || (canClose && !sentToInitiator)}
          onClick={() => void handleOpenChat()}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {unreadCount > 0 && !isClosed && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {canClose && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={
                sentToInitiator
                  ? 'Already sent to initiator'
                  : isClosed
                    ? 'Cannot send — observation closed'
                    : !canSendFields
                      ? 'Fill observation and action required to send'
                      : `Send observation to ${initiatorName}`
              }
              className={`h-7 w-7 ${
                sentToInitiator || isClosed || !canSendFields
                  ? 'text-muted-foreground/40 cursor-not-allowed'
                  : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
              }`}
              disabled={isClosed || sending || sentToInitiator || !canSendFields}
              onClick={() => void handleSendToInitiator()}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={isClosed ? 'Observation closed' : 'Close observation'}
              className={`h-7 w-7 ${
                isClosed
                  ? 'text-muted-foreground/50'
                  : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
              }`}
              disabled={isClosed || closing}
              onClick={() => void handleClose()}
            >
              {closing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CircleCheck className="h-3.5 w-3.5" />
              )}
            </Button>
          </>
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

      <Dialog open={sendSuccessOpen} onOpenChange={setSendSuccessOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Observation Sent
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-1 text-left text-sm text-muted-foreground">
                <p>
                  The observation and action required will be sent to{' '}
                  <span className="font-medium text-foreground">{sentInitiatorName}</span>
                  {requestNumber ? (
                    <> for <span className="font-mono font-medium text-foreground">{requestNumber}</span></>
                  ) : null}
                  . Further discussion should continue in chat.
                </p>
                <div className="rounded-md border bg-muted/30 px-3 py-2.5 space-y-2 text-foreground">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Observation</p>
                    <p className="text-sm whitespace-pre-wrap">{lastSentPreview.observation}</p>
                  </div>
                  {lastSentPreview.actionRequired ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">Action Required</p>
                      <p className="text-sm whitespace-pre-wrap">{lastSentPreview.actionRequired}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="bg-[#1e3a5f] hover:bg-[#2a4d7a] text-white"
              onClick={handleSendSuccessOk}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export type ObservationThreadStatusMap = Record<string, ObservationThreadMeta>;

/** Load thread status (closed, sent, unread) for observation rows on an inspection. */
export function useObservationThreadStatus(
  inspectionRequestId: number,
  enabled: boolean
): { statusMap: ObservationThreadStatusMap; refresh: () => void } {
  const [statusMap, setStatusMap] = useState<ObservationThreadStatusMap>({});
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled || !inspectionRequestId) return;
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
  }, [inspectionRequestId, enabled, tick]);

  return { statusMap, refresh };
}
