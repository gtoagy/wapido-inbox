'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { format, isValid, isToday, isYesterday, differenceInHours } from 'date-fns';
import { RefreshCw, Paperclip, Send, X, AlertCircle, MessageSquare, XCircle, ListTree, ArrowLeft, Info, Play, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaMessage } from '@/components/media-message';
import { TemplateSelectorDialog } from '@/components/template-selector-dialog';
import { InteractiveMessageDialog } from '@/components/interactive-message-dialog';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { MediaData } from '@kapso/whatsapp-cloud-api';

type Message = {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  createdAt: string;
  /** Conversación de origen (modo historial unificado). */
  conversationId?: string;
  status?: string;
  phoneNumber: string;
  hasMedia: boolean;
  mediaData?: {
    url: string;
    contentType?: string;
    filename?: string;
  } | (MediaData & { url: string });
  reactionEmoji?: string | null;
  reactedToMessageId?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  messageType?: string;
  caption?: string | null;
  metadata?: {
    mediaId?: string;
    caption?: string;
  };
};

function formatMessageTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isValid(date)) {
      return format(date, 'HH:mm');
    }
    return '';
  } catch {
    return '';
  }
}

function formatDateDivider(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (!isValid(date)) return '';

    if (isToday(date)) return 'Hoy';
    if (isYesterday(date)) return 'Ayer';
    return format(date, 'MMMM d, yyyy');
  } catch {
    return '';
  }
}

function shouldShowDateDivider(currentMsg: Message, prevMsg: Message | null): boolean {
  if (!prevMsg) return true;

  try {
    const currentDate = new Date(currentMsg.createdAt);
    const prevDate = new Date(prevMsg.createdAt);

    if (!isValid(currentDate) || !isValid(prevDate)) return false;

    return format(currentDate, 'yyyy-MM-dd') !== format(prevDate, 'yyyy-MM-dd');
  } catch {
    return false;
  }
}

function isWithin24HourWindow(messages: Message[]): boolean {
  // Find the last inbound message
  const inboundMessages = messages.filter(msg => msg.direction === 'inbound');

  if (inboundMessages.length === 0) {
    // No inbound messages yet - only templates allowed
    return false;
  }

  const lastInboundMessage = inboundMessages[inboundMessages.length - 1];

  try {
    const lastMessageDate = new Date(lastInboundMessage.createdAt);
    if (!isValid(lastMessageDate)) return false;

    const hoursSinceLastMessage = differenceInHours(new Date(), lastMessageDate);
    return hoursSinceLastMessage < 24;
  } catch {
    return false; // In case of error, only allow templates
  }
}

function getDisabledInputMessage(messages: Message[]): string {
  const inboundMessages = messages.filter(msg => msg.direction === 'inbound');

  if (inboundMessages.length === 0) {
    return "El usuario aún no ha enviado mensaje. Envía un template o espera a que responda.";
  }

  return "El último mensaje fue hace más de 24 horas. Envía un template o espera a que el usuario te escriba.";
}

type WorkflowExecution = {
  id: string;
  status: string;
};

// Conversación del contacto para el modo historial unificado. Deben venir
// ordenadas de más reciente a más antigua; la primera es la principal (a la que
// se envían los mensajes nuevos).
type ContactConversation = {
  id: string;
  lastActiveAt?: string;
};

type Props = {
  conversationId?: string;
  phoneNumber?: string;
  contactName?: string;
  onTemplateSent?: (phoneNumber: string) => Promise<void>;
  onBack?: () => void;
  isVisible?: boolean;
  conversationStatus?: string;
  onStatusChange?: () => void;
  onToggleInfo?: () => void;
  workflowExecution?: WorkflowExecution | null;
  onWorkflowAction?: () => void;
  /** Si se provee, muestra el historial unificado de todas estas conversaciones. */
  contactConversations?: ContactConversation[];
};

// Module-level cache: persists across re-renders and conversation switches
const messageCache = new Map<string, Message[]>();

// Pure: ordena mensajes y adjunta reacciones. A nivel módulo para reusarse
// tanto en el componente como en el prefetch.
function processMessages(raw: Message[]): Message[] {
  const reactions = raw.filter((msg: Message) => msg.messageType === 'reaction');
  const regularMessages = raw.filter((msg: Message) => msg.messageType !== 'reaction');
  const reactionMap = new Map<string, string>();
  reactions.forEach((reaction: Message) => {
    if (reaction.reactedToMessageId && reaction.reactionEmoji) {
      reactionMap.set(reaction.reactedToMessageId, reaction.reactionEmoji);
    }
  });
  return regularMessages
    .map((msg: Message) => {
      const reaction = reactionMap.get(msg.id);
      return reaction ? { ...msg, reactionEmoji: reaction } : msg;
    })
    .sort((a: Message, b: Message) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function fetchAndCacheMessages(conversationId: string): Promise<Message[]> {
  const response = await fetch(`/api/messages/${conversationId}`);
  const data = await response.json();
  const sorted = processMessages(data.data || []);
  messageCache.set(conversationId, sorted);
  return sorted;
}

// Mensajes de una conversación etiquetados con su conversationId (para el modo
// historial unificado, donde se concatenan varias conversaciones del contacto).
async function fetchTaggedMessages(conversationId: string): Promise<Message[]> {
  const response = await fetch(`/api/messages/${conversationId}`);
  const data = await response.json();
  return processMessages(data.data || []).map((m) => ({ ...m, conversationId }));
}

// Cuántas conversaciones del contacto se cargan por página (modo unificado).
const HISTORY_PAGE_SIZE = 5;

/**
 * Precarga los mensajes de una conversación en el caché (ej. on hover) para que
 * al abrir el chat aparezcan al instante. No-op si ya están cacheados.
 */
export async function prefetchMessages(conversationId: string): Promise<void> {
  if (!conversationId || messageCache.has(conversationId)) return;
  try {
    await fetchAndCacheMessages(conversationId);
  } catch {
    // best-effort: si falla, el fetch normal al abrir lo reintenta
  }
}

export function MessageView({ conversationId, phoneNumber, contactName, onTemplateSent, onBack, isVisible = false, conversationStatus, onStatusChange, onToggleInfo, workflowExecution, onWorkflowAction, contactConversations }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [canSendRegularMessage, setCanSendRegularMessage] = useState(true);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showInteractiveDialog, setShowInteractiveDialog] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousMessageCountRef = useRef(0);
  const [workflowActionLoading, setWorkflowActionLoading] = useState(false);

  // Modo historial unificado (varias conversaciones del contacto en un scroll).
  const isUnified = !!(contactConversations && contactConversations.length > 0);
  const totalConversations = contactConversations?.length ?? 0;
  const [loadedCount, setLoadedCount] = useState(HISTORY_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const hasMoreConversations = isUnified && loadedCount < totalConversations;

  const isWorkflowRunning = workflowExecution?.status === 'running';
  const isWorkflowHandoff = workflowExecution?.status === 'handoff';
  const isWorkflowWaiting = workflowExecution?.status === 'waiting';
  const showWorkflowBanner = isWorkflowRunning || isWorkflowHandoff || isWorkflowWaiting;
  const isInputDisabledByWorkflow = isWorkflowRunning;

  const handleWorkflowHandoff = async () => {
    if (!workflowExecution) return;
    setWorkflowActionLoading(true);
    try {
      await fetch(`/api/workflow/${workflowExecution.id}/handoff`, { method: 'POST' });
      onWorkflowAction?.();
    } catch (error) {
      console.error('Error en handoff:', error);
    } finally {
      setWorkflowActionLoading(false);
    }
  };

  const handleWorkflowResume = async () => {
    if (!workflowExecution) return;
    setWorkflowActionLoading(true);
    try {
      await fetch(`/api/workflow/${workflowExecution.id}/resume`, { method: 'POST' });
      onWorkflowAction?.();
    } catch (error) {
      console.error('Error al reanudar:', error);
    } finally {
      setWorkflowActionLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      if (contactConversations && contactConversations.length > 0) {
        // Historial unificado: combinar las primeras `loadedCount` conversaciones
        // (las más recientes) en un solo hilo ordenado cronológicamente.
        const ids = contactConversations.slice(0, loadedCount).map((c) => c.id);
        const results = await Promise.all(ids.map(fetchTaggedMessages));
        const combined = results
          .flat()
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(combined);
        previousMessageCountRef.current = combined.length;
      } else {
        const sortedMessages = await fetchAndCacheMessages(conversationId);
        setMessages(sortedMessages);
        previousMessageCountRef.current = sortedMessages.length;
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conversationId, contactConversations, loadedCount]);

  // Ref a fetchMessages para usarlo en efectos sin re-disparar por su identidad.
  const fetchMessagesRef = useRef(fetchMessages);
  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  // Carga inicial (montaje o cambio de conversación/contacto).
  useEffect(() => {
    if (!conversationId) return;
    if (isUnified) {
      setLoading(true);
      fetchMessagesRef.current();
      return;
    }
    const cached = messageCache.get(conversationId);
    if (cached && cached.length > 0) {
      // Show cached messages instantly, fetch fresh in background
      setMessages(cached);
      setLoading(false);
      fetchMessagesRef.current();
    } else {
      setLoading(true);
      fetchMessagesRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isUnified]);

  // Cargar conversaciones anteriores: sin skeleton, preservando la posición de
  // scroll (el contenido nuevo se agrega arriba).
  const prevLoadedRef = useRef(loadedCount);
  useEffect(() => {
    if (loadedCount === prevLoadedRef.current) return;
    prevLoadedRef.current = loadedCount;
    const viewport = messagesContainerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLElement | null;
    const prevHeight = viewport?.scrollHeight ?? 0;
    setLoadingMore(true);
    fetchMessagesRef.current().finally(() => {
      setLoadingMore(false);
      requestAnimationFrame(() => {
        if (viewport) viewport.scrollTop += viewport.scrollHeight - prevHeight;
      });
    });
  }, [loadedCount]);

  useEffect(() => {
    // Only auto-scroll if user is near bottom
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [messages, isNearBottom]);

  useEffect(() => {
    setCanSendRegularMessage(isWithin24HourWindow(messages));
  }, [messages]);

  // Track if user is near bottom of scroll.
  // Depende de `loading`: el ScrollArea real solo existe cuando !loading, así que
  // hay que (re)enganchar el listener al terminar la carga, no solo al montar
  // (si no, isNearBottom queda fijo en true y el auto-scroll tira al fondo).
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setIsNearBottom(distanceFromBottom < 100);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [loading]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const handleLoadEarlier = () => {
    setLoadedCount((n) => Math.min(n + HISTORY_PAGE_SIZE, totalConversations));
  };

  const handleToggleStatus = async () => {
    if (!conversationId || updatingStatus) return;
    const newStatus = conversationStatus === 'ended' ? 'active' : 'ended';
    setUpdatingStatus(true);
    try {
      const url = `/api/conversations/${conversationId}/status`;
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange?.();
    } catch (error) {
      console.error('Error updating conversation status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Auto-polling for messages (every 3 seconds) — el chat abierto se siente
  // más vivo; solo hay un MessageView montado a la vez.
  useAutoPolling({
    interval: 3000,
    enabled: !!conversationId,
    onPoll: fetchMessages
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!messageInput.trim() && !selectedFile) || !phoneNumber || sending) return;

    setSending(true);
    try {
      const formData = new FormData();
      formData.append('to', phoneNumber);
      if (messageInput.trim()) {
        formData.append('body', messageInput);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await fetch('/api/messages/send', {
        method: 'POST',
        body: formData
      });

      setMessageInput('');
      handleRemoveFile();
      await fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTemplateSent = async () => {
    await fetchMessages();

    // Notify parent to refresh conversation list and select this conversation
    if (phoneNumber && onTemplateSent) {
      await onTemplateSent(phoneNumber);
    }
  };

  if (!conversationId) {
    return (
      <div className={cn(
        "flex-1 flex items-center justify-center bg-muted/50",
        !isVisible && "hidden md:flex"
      )}>
        <p className="text-muted-foreground">Selecciona una conversación de la lista para ver mensajes y detalles.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn(
        "flex-1 flex flex-col bg-chat-surface",
        !isVisible && "hidden md:flex"
      )}>
        <div className="p-3 border-b border-border bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-muted-foreground hover:bg-background"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-[900px] mx-auto space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={cn('flex mb-2', i % 2 === 0 ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[70%] rounded-lg px-3 py-2 shadow-sm',
                  i % 2 === 0 ? 'rounded-br-none' : 'rounded-bl-none'
                )}>
                  <Skeleton className="h-4 mb-2" style={{ width: `${Math.random() * 150 + 150}px` }} />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex-1 flex flex-col bg-chat-surface",
      !isVisible && "hidden md:flex"
    )}>
      <div className="p-3 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {onBack && (
              <Button
                onClick={onBack}
                variant="ghost"
                size="icon"
                className="md:hidden text-muted-foreground hover:bg-background flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-medium text-foreground truncate">{contactName || phoneNumber || 'Conversación'}</h2>
              {contactName && phoneNumber && (
                <p className="text-xs text-muted-foreground truncate">{phoneNumber}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleToggleStatus}
              disabled={updatingStatus}
              variant="ghost"
              size="sm"
              className={cn(
                "text-xs",
                conversationStatus === 'ended'
                  ? "text-primary hover:bg-primary/10"
                  : "text-destructive hover:bg-destructive/10"
              )}
            >
              {conversationStatus === 'ended' ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reabrir
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cerrar
                </>
              )}
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-background"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            {onToggleInfo && (
              <Button
                onClick={onToggleInfo}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-background"
                title="Info"
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <ScrollArea ref={messagesContainerRef} className="flex-1 h-0 p-4">
        <div className="max-w-[900px] mx-auto">
        {/* Historial unificado: control para traer conversaciones anteriores */}
        {isUnified && hasMoreConversations && (
          <div className="flex justify-center my-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadEarlier}
              disabled={loadingMore}
              className="text-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loadingMore && 'animate-spin')} />
              {loadingMore ? 'Cargando…' : 'Cargar conversaciones anteriores'}
            </Button>
          </div>
        )}
        {isUnified && !hasMoreConversations && !loadingMore && messages.length > 0 && (
          <p className="text-center text-xs text-muted-foreground my-3">
            Inicio del historial del contacto
          </p>
        )}
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground">Inicio del historial</p>
        ) : (
          messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showConversationDivider =
              isUnified && message.conversationId !== prevMessage?.conversationId;
            const showDateDivider =
              shouldShowDateDivider(message, prevMessage) || showConversationDivider;

            return (
              <div key={message.id}>
                {showConversationDivider && (
                  <div className="flex items-center gap-2 mt-5 mb-1">
                    <div className="h-px flex-1 bg-border" />
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {message.conversationId === conversationId && (
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      )}
                      Conversación {message.conversationId?.slice(0, 8)}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                )}
                {showDateDivider && (
                  <div className="flex justify-center my-4">
                    <Badge variant="secondary" className="shadow-sm">
                      {formatDateDivider(message.createdAt)}
                    </Badge>
                  </div>
                )}

                <div
                  className={cn(
                    'flex mb-2',
                    message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-lg px-3 py-2 relative shadow-sm',
                      message.direction === 'outbound'
                        ? 'bg-bubble-outgoing text-bubble-outgoing-foreground rounded-br-none'
                        : 'bg-bubble-incoming text-bubble-incoming-foreground rounded-bl-none'
                    )}
                  >
                    {message.hasMedia && message.mediaData?.url ? (
                      <div className="mb-2">
                        {message.messageType === 'sticker' ? (
                          <img
                            src={message.mediaData.url}
                            alt="Sticker"
                            className="max-w-[150px] max-h-[150px] h-auto"
                          />
                        ) : message.mediaData.contentType?.startsWith('image/') || message.messageType === 'image' ? (
                          <img
                            src={message.mediaData.url}
                            alt="Media"
                            className="rounded max-w-full h-auto max-h-96"
                          />
                        ) : message.mediaData.contentType?.startsWith('video/') || message.messageType === 'video' ? (
                          <video
                            src={message.mediaData.url}
                            controls
                            className="rounded max-w-full h-auto max-h-96"
                          />
                        ) : message.mediaData.contentType?.startsWith('audio/') || message.messageType === 'audio' ? (
                          <audio src={message.mediaData.url} controls className="w-full" />
                        ) : (
                          <a
                            href={message.mediaData.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              'flex items-center gap-2 text-sm underline cursor-pointer hover:opacity-80',
                              message.direction === 'outbound' ? 'text-primary' : 'text-primary'
                            )}
                          >
                            📎 {message.mediaData.filename || message.filename || 'Descargar archivo'}
                          </a>
                        )}
                      </div>
                    ) : message.metadata?.mediaId && message.messageType ? (
                      <div className="mb-2">
                        <MediaMessage
                          mediaId={message.metadata.mediaId}
                          messageType={message.messageType}
                          caption={message.caption}
                          filename={message.filename}
                          isOutbound={message.direction === 'outbound'}
                        />
                      </div>
                    ) : null}

                    {message.caption && (
                      <p className="text-sm break-words whitespace-pre-wrap mb-1">
                        {message.caption}
                      </p>
                    )}

                    {message.content && message.content !== '[Image attached]' && (
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatMessageTime(message.createdAt)}
                      </span>

                      {message.messageType && (
                        <span className="text-[11px] text-muted-foreground opacity-60">
                          · {message.messageType}
                        </span>
                      )}

                      {message.direction === 'outbound' && message.status && (
                        <>
                          {message.status === 'failed' ? (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          ) : (
                            <span className={cn(
                              "text-xs",
                              message.status === 'read' ? "text-info" : "text-muted-foreground"
                            )}>
                              {message.status === 'read' ? '✓✓' :
                               message.status === 'delivered' ? '✓✓' :
                               message.status === 'sent' ? '✓' : ''}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {message.direction === 'outbound' && message.status === 'failed' && (
                      <div className="mt-1">
                        <span className="text-[11px] text-destructive flex items-center gap-1">
                          No entregado
                        </span>
                      </div>
                    )}

                    {message.reactionEmoji && (
                      <div className="absolute -bottom-2 -right-2 bg-background rounded-full px-1.5 py-0.5 text-sm shadow-sm border">
                        {message.reactionEmoji}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {showWorkflowBanner && (
        <div className={cn(
          "border-t border-border px-4 py-2",
          isWorkflowHandoff ? "bg-warning-light" : "bg-muted"
        )}>
          <div className="max-w-[900px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isWorkflowHandoff ? (
                <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
              ) : (
                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <span className={cn(
                "text-sm font-medium",
                isWorkflowHandoff ? "text-warning" : "text-muted-foreground"
              )}>
                {isWorkflowRunning && "Workflow activo"}
                {isWorkflowHandoff && "Modo manual — el workflow esta pausado"}
                {isWorkflowWaiting && "Workflow en espera"}
              </span>
            </div>
            {isWorkflowHandoff ? (
              <Button
                onClick={handleWorkflowResume}
                disabled={workflowActionLoading}
                variant="outline"
                size="sm"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Reanudar Workflow
              </Button>
            ) : (
              <Button
                onClick={handleWorkflowHandoff}
                disabled={workflowActionLoading}
                variant="outline"
                size="sm"
              >
                <Hand className="h-3.5 w-3.5 mr-1.5" />
                Tomar Control
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-border bg-background">
        {canSendRegularMessage ? (
          <>
            {selectedFile && (
              <div className="p-3 border-b border-border bg-card">
                <div className="flex items-start gap-3">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-background rounded flex items-center justify-center">
                      <Paperclip className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button
                    onClick={handleRemoveFile}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="p-3 max-w-[900px] mx-auto w-full flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || isInputDisabledByWorkflow}
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-muted/30"
                title="Subir archivo"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                onClick={() => setShowInteractiveDialog(true)}
                disabled={sending || isInputDisabledByWorkflow}
                size="icon"
                variant="ghost"
                className="text-muted-foreground hover:text-primary hover:bg-background"
                title="Enviar mensaje interactivo"
              >
                <ListTree className="h-5 w-5" />
              </Button>
              <Input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={isInputDisabledByWorkflow ? "El workflow esta activo..." : "Escribe un mensaje..."}
                disabled={sending || isInputDisabledByWorkflow}
                className="flex-1 bg-card border-border focus-visible:ring-primary rounded-lg"
              />
              <Button
                type="submit"
                disabled={sending || isInputDisabledByWorkflow || (!messageInput.trim() && !selectedFile)}
                size="icon"
                className="bg-primary hover:bg-primary/90 rounded-full"
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </>
        ) : (
          <div className="p-3 max-w-[900px] mx-auto w-full">
            <div className="bg-warning-light border border-warning/40 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground mb-3">
                    {getDisabledInputMessage(messages)}
                  </p>
                  <Button
                    onClick={() => setShowTemplateDialog(true)}
                    className="bg-primary hover:bg-primary/90"
                    size="sm"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Enviar Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <TemplateSelectorDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        phoneNumber={phoneNumber || ''}
        onTemplateSent={handleTemplateSent}
      />

      <InteractiveMessageDialog
        open={showInteractiveDialog}
        onOpenChange={setShowInteractiveDialog}
        conversationId={conversationId}
        phoneNumber={phoneNumber}
        onMessageSent={fetchMessages}
      />
    </div>
  );
}
