'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  MessageSquare,
  Send,
  Loader2,
  Paperclip,
  X,
  FileText,
  Download,
  CircleCheck,
  Pencil,
} from 'lucide-react';
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
  attachment_file_name?: string | null;
  attachment_file_path?: string | null;
  attachment_file_type?: string | null;
  attachment_file_size?: number | null;
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
  /** Optional initial hint; final permissions come from the API. */
  canReply?: boolean;
  canClose?: boolean;
  canEdit?: boolean;
  onThreadReady?: (threadId: number) => void;
  onMessageSent?: () => void;
  onAcknowledged?: () => void;
  onClosed?: () => void;
  onObservationEdited?: (preview: string) => void;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function formatChatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageAttachment(fileType?: string | null, fileName?: string | null): boolean {
  if (fileType?.startsWith('image/')) return true;
  const name = (fileName || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(name);
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
  canReply: canReplyHint = false,
  canClose: canCloseHint = false,
  canEdit: canEditHint = false,
  onThreadReady,
  onMessageSent,
  onAcknowledged,
  onClosed,
  onObservationEdited,
}: ObservationChatDialogProps) {
  const { data: session } = useSession();
  const userId = parseInt((session?.user as { id?: string })?.id || '0', 10);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<number | null>(threadId);
  const [closed, setClosed] = useState(isClosed);
  const [canReply, setCanReply] = useState(canReplyHint);
  const [canClose, setCanClose] = useState(canCloseHint);
  const [canEdit, setCanEdit] = useState(canEditHint);
  const [preview, setPreview] = useState(observationPreview);
  const [actionRequired, setActionRequired] = useState('');
  const [editing, setEditing] = useState(false);
  const [editObservation, setEditObservation] = useState(observationPreview);
  const [editActionRequired, setEditActionRequired] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setCanReply(!!data.can_reply);
      setCanClose(!!data.can_close);
      setCanEdit(!!data.can_edit);
      const nextPreview = String(data.thread?.observation_preview || observationPreview || '');
      const nextAction = String(data.action_required || '');
      setPreview(nextPreview);
      setActionRequired(nextAction);
      setEditObservation(nextPreview);
      setEditActionRequired(nextAction);
      await acknowledge(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [acknowledge, observationPreview]);

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
          if (typeof data.can_reply === 'boolean') setCanReply(data.can_reply);
          if (typeof data.can_close === 'boolean') setCanClose(data.can_close);
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
    setCanReply(canReplyHint);
    setCanClose(canCloseHint);
    setPendingFile(null);
    setDraft('');
    setError('');
    void ensureAndLoad();
  }, [open, threadId, isClosed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleFilePick = (file: File | null) => {
    if (!file) {
      setPendingFile(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError('File size exceeds 10MB limit');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setError('');
    setPendingFile(file);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && !pendingFile) || !activeThreadId || closed || !canReply) return;
    setSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('message', text);
      if (pendingFile) formData.append('file', pendingFile);

      const res = await fetch(`/api/observation-chats/${activeThreadId}/messages`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setMessages((prev) => [...prev, data.message]);
      setDraft('');
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (activeThreadId) await acknowledge(activeThreadId);
      onMessageSent?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleCloseObservation = async () => {
    if (!activeThreadId || closed || !canClose || closing) return;
    setClosing(true);
    setError('');
    try {
      const res = await fetch(`/api/observation-chats/${activeThreadId}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close');
      setClosed(true);
      onClosed?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('observation-chat-acknowledged'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close observation');
    } finally {
      setClosing(false);
    }
  };

  const handleSaveObservationEdit = async () => {
    if (!activeThreadId || !canEdit) return;
    const obs = editObservation.trim();
    if (!obs) {
      setError('Observation text is required');
      return;
    }
    setSavingEdit(true);
    setError('');
    try {
      const res = await fetch(`/api/observation-chats/${activeThreadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observation: obs,
          action_required: editActionRequired,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update observation');
      const nextPreview = String(data.thread?.observation_preview || obs);
      const nextAction = String(
        data.action_required != null ? data.action_required : editActionRequired.trim()
      );
      setPreview(nextPreview);
      setActionRequired(nextAction);
      setEditObservation(nextPreview);
      setEditActionRequired(nextAction);
      if (Array.isArray(data.messages)) setMessages(data.messages);
      setEditing(false);
      onObservationEdited?.(nextPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update observation');
    } finally {
      setSavingEdit(false);
    }
  };

  const partLabel = part === 'part4' ? 'Part IV — R&QA' : 'Part V — DGAQA';
  const canSend = canReply && (!!draft.trim() || !!pendingFile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-2 pr-6">
            <DialogTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#1e3a5f]" />
              Observation Chat
              {closed && (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  Closed
                </Badge>
              )}
              {!closed && !canReply && !canEdit && (
                <Badge variant="outline" className="text-[10px] font-normal">
                  View only
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {canEdit && !closed && !editing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setEditObservation(preview);
                    setEditActionRequired(actionRequired);
                    setEditing(true);
                    setError('');
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              )}
              {canClose && !closed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  disabled={closing}
                  onClick={() => void handleCloseObservation()}
                >
                  {closing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <CircleCheck className="h-3.5 w-3.5 mr-1" />
                  )}
                  Close
                </Button>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs space-y-0.5">
            {requestNumber && <span className="font-mono">{requestNumber}</span>}
            <span className="block text-muted-foreground">{partLabel}</span>
            {!editing && <span className="block line-clamp-2">{preview}</span>}
            {!editing && actionRequired ? (
              <span className="block text-muted-foreground line-clamp-2">
                Action required: {actionRequired}
              </span>
            ) : null}
          </DialogDescription>
          {editing && (
            <div className="mt-2 space-y-2 text-left">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Observation</label>
                <Textarea
                  rows={3}
                  value={editObservation}
                  onChange={(e) => setEditObservation(e.target.value)}
                  className="text-sm mt-1"
                  placeholder="Observation text"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Action required</label>
                <Textarea
                  rows={2}
                  value={editActionRequired}
                  onChange={(e) => setEditActionRequired(e.target.value)}
                  className="text-sm mt-1"
                  placeholder="Action required (optional)"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={savingEdit}
                  onClick={() => {
                    setEditing(false);
                    setEditObservation(preview);
                    setEditActionRequired(actionRequired);
                    setError('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={savingEdit || !editObservation.trim()}
                  onClick={() => void handleSaveObservationEdit()}
                >
                  {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogHeader>

        <div className="h-[320px] overflow-y-auto px-4 py-3 space-y-3 bg-background">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet.
            </p>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === userId;
              const hasAttachment = !!m.attachment_file_path;
              const showText =
                !!m.message?.trim() &&
                !(hasAttachment && m.message.trim() === `[Attachment] ${m.attachment_file_name || ''}`.trim());
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
                    {showText && (
                      <p className="whitespace-pre-wrap break-words">{m.message}</p>
                    )}
                    {hasAttachment && (
                      <div className={`mt-1.5 ${showText ? 'pt-1.5 border-t' : ''} ${isMine ? 'border-white/20' : 'border-border'}`}>
                        {isImageAttachment(m.attachment_file_type, m.attachment_file_name) ? (
                          <a
                            href={m.attachment_file_path!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={m.attachment_file_path!}
                              alt={m.attachment_file_name || 'Attachment'}
                              className="max-h-40 max-w-full rounded-md object-contain bg-black/10"
                            />
                          </a>
                        ) : null}
                        <a
                          href={m.attachment_file_path!}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={m.attachment_file_name || undefined}
                          className={`mt-1.5 inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline ${
                            isMine ? 'text-white/90' : 'text-foreground'
                          }`}
                        >
                          {isImageAttachment(m.attachment_file_type, m.attachment_file_name) ? (
                            <Download className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <FileText className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">{m.attachment_file_name || 'Download file'}</span>
                          {m.attachment_file_size != null && (
                            <span className={isMine ? 'text-white/60' : 'text-muted-foreground'}>
                              ({formatFileSize(Number(m.attachment_file_size))})
                            </span>
                          )}
                        </a>
                      </div>
                    )}
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
          ) : !canReply ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              {canEdit
                ? 'You can edit this observation sheet (Edit above). Chat replies are for the initiator and assigned inspectors.'
                : 'You can view this observation discussion. Only the initiator and assigned inspectors can reply.'}
            </p>
          ) : (
            <div className="space-y-2">
              {pendingFile && (
                <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{pendingFile.name}</span>
                  <span className="text-muted-foreground shrink-0">{formatFileSize(pendingFile.size)}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => {
                      setPendingFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    aria-label="Remove attachment"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-[60px] w-11"
                  disabled={sending}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a reply..."
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
                  disabled={sending || !canSend}
                  onClick={() => void handleSend()}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Attachments up to 10 MB</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
