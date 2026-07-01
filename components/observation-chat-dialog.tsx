'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ObservationPart } from '@/lib/observation-chats-shared';
import { acknowledgeObservationChat } from '@/lib/observation-chat-client';

interface ChatMessage {
  id: number;
  sender_id: number;
  sender_name?: string;
  message: string;
  created_at: string;
}

interface ObservationChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: number | null;
  inspectionRequestId: number;
  part: ObservationPart;
  observationKey: string;
  observationPreview: string;
  isClosed?: boolean;
  requestNumber?: string;
  onThreadReady?: (threadId: number) => void;
  onMessageSent?: () => void;
  onAcknowledged?: () => void;
}

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export function ObservationChatDialog({
  open,
  onOpenChange,
  threadId,
  inspectionRequestId,
  part,
  observationKey,
  observationPreview,
  isClosed = false,
  requestNumber,
  onThreadReady,
  onMessageSent,
  onAcknowledged,
}: ObservationChatDialogProps) {
  const { data: session } = useSession();
  const userId = parseInt((session?.user as { id?: string })?.id || '0', 10);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<number | null>(threadId);
  const [closed, setClosed] = useState(isClosed);
  const bottomRef = useRef<HTMLDivElement>(null);

  const acknowledge = useCallback(
    async (id: number) => {
      try {
        await acknowledgeObservationChat(id);
        onAcknowledged?.();
      } catch {
        /* ignore */
      }
    },
    [onAcknowledged]
  );

  const loadThread = useCallback(async (id: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/observation-chats/${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load chat');
      setMessages(data.messages || []);
      setClosed(!!data.thread?.is_closed);
      await acknowledge(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [acknowledge]);

  const ensureAndLoad = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let id = activeThreadId;
      if (!id) {
        const res = await fetch('/api/observation-chats/ensure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inspection_request_id: inspectionRequestId,
            part,
            observation_key: observationKey,
            observation_preview: observationPreview,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to open chat');
        id = data.thread?.id;
        if (id) {
          setActiveThreadId(id);
          onThreadReady?.(id);
          setClosed(!!data.thread?.is_closed);
        }
      }
      if (id) await loadThread(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open chat');
    } finally {
      setLoading(false);
    }
  }, [
    activeThreadId,
    inspectionRequestId,
    part,
    observationKey,
    observationPreview,
    loadThread,
    onThreadReady,
  ]);

  useEffect(() => {
    if (!open) return;
    setActiveThreadId(threadId);
    setClosed(isClosed);
    void ensureAndLoad();
  }, [open, threadId, isClosed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeThreadId || closed) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/observation-chats/${activeThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setMessages((prev) => [...prev, data.message]);
      setDraft('');
      if (activeThreadId) await acknowledge(activeThreadId);
      onMessageSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const partLabel = part === 'part4' ? 'Part IV — R&QA' : 'Part V — DGAQA';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b bg-muted/30">
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#1e3a5f]" />
            Observation Chat
            {closed && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                Closed
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs space-y-0.5">
            {requestNumber && <span className="font-mono">{requestNumber}</span>}
            <span className="block text-muted-foreground">{partLabel}</span>
            <span className="block line-clamp-2">{observationPreview}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="h-[320px] overflow-y-auto px-4 py-3 space-y-3 bg-background">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Start the conversation with the initiator.
            </p>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === userId;
              return (
                <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      isMine
                        ? 'bg-[#1e3a5f] text-white'
                        : 'bg-muted border'
                    }`}
                  >
                    {!isMine && (
                      <p className="text-[10px] font-medium opacity-70 mb-0.5">{m.sender_name || 'User'}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-muted-foreground'}`}>
                      {formatChatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="text-xs text-red-600 px-4 pb-1">{error}</p>
        )}

        <div className="border-t px-4 py-3 bg-muted/20">
          {closed ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              This observation is closed. Chat is no longer available.
            </p>
          ) : (
            <div className="flex gap-2">
              <Textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message to the initiator..."
                className="text-sm min-h-[60px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className="shrink-0 h-[60px] w-11 bg-[#1e3a5f] hover:bg-[#2a4d7a]"
                disabled={sending || !draft.trim()}
                onClick={() => void handleSend()}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
