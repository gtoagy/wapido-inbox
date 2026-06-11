'use client';

import { useEffect, useState, forwardRef, useImperativeHandle, useCallback, useMemo, useRef } from 'react';
import { format, isValid, isToday, isYesterday } from 'date-fns';
import { MessagesSquare, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewSwitcher } from '@/components/view-switcher';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { prefetchMessages } from '@/components/message-view';
import { AssignmentBadge } from '@/components/assignment-badge';

type Conversation = {
  id: string;
  phoneNumber: string;
  status: string;
  lastActiveAt: string;
  phoneNumberId: string;
  metadata?: Record<string, unknown>;
  contactName?: string;
  messagesCount?: number;
  lastMessage?: {
    content: string;
    direction: string;
    type?: string;
  };
};

function msTime(value?: string): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatConversationDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (!isValid(date)) return '';

    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ayer';
    return format(date, 'MMM d');
  } catch {
    return '';
  }
}

function getAvatarInitials(contactName?: string, phoneNumber?: string): string {
  if (contactName) {
    const words = contactName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return contactName.slice(0, 2).toUpperCase();
  }

  if (phoneNumber) {
    const digits = phoneNumber.replace(/\D/g, '');
    return digits.slice(-2);
  }

  return '??';
}

type Props = {
  onSelectConversation: (conversation: Conversation, contactConversations: Conversation[]) => void;
  selectedConversationId?: string;
  isHidden?: boolean;
};

export type ConversationListRef = {
  refresh: () => Promise<Conversation[]>;
  selectByPhoneNumber: (phoneNumber: string) => void;
};

// Agrupa conversaciones por contacto (teléfono). Devuelve una entrada por
// contacto con la conversación más reciente como representativa.
type ContactGroup = { rep: Conversation; all: Conversation[]; count: number };

function groupByContact(conversations: Conversation[]): ContactGroup[] {
  const byContact = new Map<string, Conversation[]>();
  for (const conv of conversations) {
    const key = conv.phoneNumber || conv.id;
    const arr = byContact.get(key);
    if (arr) arr.push(conv);
    else byContact.set(key, [conv]);
  }
  return Array.from(byContact.values())
    .map((convs) => {
      const all = convs.slice().sort((a, b) => msTime(b.lastActiveAt) - msTime(a.lastActiveAt));
      return { rep: all[0], all, count: all.length };
    })
    .sort((a, b) => msTime(b.rep.lastActiveAt) - msTime(a.rep.lastActiveAt));
}

export const ConversationList = forwardRef<ConversationListRef, Props>(
  ({ onSelectConversation, selectedConversationId, isHidden = false }, ref) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('active');
  const [workflowStatusMap, setWorkflowStatusMap] = useState<Map<string, string>>(new Map());

  const conversationsRef = useRef<Conversation[]>([]);

  const fetchWorkflowStatuses = useCallback(async (convs?: Conversation[]) => {
    const target = convs ?? conversationsRef.current;
    // Only check active conversations — ended ones won't have running workflows
    const activeConvs = target.filter(c => c.status === 'active');
    if (activeConvs.length === 0) return;

    const newMap = new Map<string, string>();
    await Promise.allSettled(
      activeConvs.map(async (conv) => {
        try {
          const res = await fetch(`/api/conversations/${conv.id}/workflow`);
          const data = await res.json();
          const executions = data.data || data;
          if (Array.isArray(executions) && executions.length > 0) {
            const latest = executions[0];
            if (latest.status && latest.status !== 'ended') {
              newMap.set(conv.id, latest.status);
            }
          }
        } catch {
          // ignore individual failures
        }
      })
    );
    setWorkflowStatusMap(newMap);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await fetch(`/api/conversations${params}`);
      const data = await response.json();
      const convs = data.data || [];
      conversationsRef.current = convs;
      setConversations(convs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Fetch workflow statuses once on mount (after first conversations load)
  const didInitWorkflow = useRef(false);
  useEffect(() => {
    if (conversations.length > 0 && !didInitWorkflow.current) {
      didInitWorkflow.current = true;
      fetchWorkflowStatuses(conversations);
    }
  }, [conversations, fetchWorkflowStatuses]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  // Auto-polling for conversations (every 15 seconds)
  const { isPolling } = useAutoPolling({
    interval: 15000,
    enabled: true,
    onPoll: fetchConversations
  });

  // Separate slower polling for workflow statuses (every 60 seconds)
  useAutoPolling({
    interval: 60000,
    enabled: true,
    onPoll: () => fetchWorkflowStatuses()
  });

  const selectByPhoneNumber = (phoneNumber: string) => {
    const all = conversations
      .filter(conv => conv.phoneNumber === phoneNumber)
      .sort((a, b) => msTime(b.lastActiveAt) - msTime(a.lastActiveAt));
    if (all.length) {
      onSelectConversation(all[0], all);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: async () => {
      setRefreshing(true);
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await fetch(`/api/conversations${params}`);
      const data = await response.json();
      const newConversations = data.data || [];
      setConversations(newConversations);
      setRefreshing(false);
      return newConversations;
    },
    selectByPhoneNumber
  }));

  const contactGroups = useMemo(() => groupByContact(conversations), [conversations]);
  const filteredGroups = contactGroups.filter((g) => {
    const query = searchQuery.toLowerCase();
    return (
      g.rep.phoneNumber.toLowerCase().includes(query) ||
      g.rep.contactName?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className={cn(
        "w-full md:w-96 border-r border-border bg-card flex flex-col",
        isHidden && "hidden md:flex"
      )}>
        <div className="p-4 border-b border-border bg-background">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="flex-1 p-3 space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex gap-3 p-3">
              <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full md:w-96 border-r border-border bg-card flex flex-col",
      isHidden && "hidden md:flex"
    )}>
      <div className="p-4 border-b border-border bg-background">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <ViewSwitcher active="inbox" />
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-foreground">Conversaciones</h1>
              {isPolling && (
                <div
                  className="h-2 w-2 rounded-full bg-green-500 animate-pulse"
                  title="Actualizando"
                />
              )}
            </div>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:bg-muted/30"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversación..."
            className="pl-9 bg-card border-border focus-visible:ring-primary rounded-lg"
          />
        </div>
        <div className="flex gap-1 mt-3">
          <Button
            variant={statusFilter === 'active' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('active')}
          >
            Activos
          </Button>
          <Button
            variant={statusFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === 'ended' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('ended')}
          >
            Cerrados
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 h-0 overflow-hidden">
        {filteredGroups.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? 'No se encontraron conversaciones' : 'Sin conversaciones'}
          </div>
        ) : (
          <div className="w-full overflow-hidden">
          {filteredGroups.map(({ rep, all, count }) => (
            <button
              key={rep.phoneNumber || rep.id}
              onClick={() => onSelectConversation(rep, all)}
              onMouseEnter={() => prefetchMessages(rep.id)}
              className={cn(
                'w-full p-3 pr-4 border-b border-border hover:bg-background text-left transition-colors relative overflow-hidden',
                selectedConversationId === rep.id && 'bg-background'
              )}
            >
              <div className="flex gap-3 items-start overflow-hidden">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-muted text-foreground text-sm font-medium">
                    {getAvatarInitials(rep.contactName, rep.phoneNumber)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex justify-between items-start gap-4 overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground truncate">
                        {rep.contactName || rep.phoneNumber}
                      </p>
                      {count > 1 && (
                        <span
                          className="flex-shrink-0 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
                          title={`${count} conversaciones de este contacto`}
                        >
                          <MessagesSquare className="h-2.5 w-2.5" />
                          {count}
                        </span>
                      )}
                      <AssignmentBadge workflowStatus={workflowStatusMap.get(rep.id)} />
                    </div>
                    {rep.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {rep.lastMessage.direction === 'outbound' && (
                          <span className="text-[#53bdeb]">✓ </span>
                        )}
                        {rep.lastMessage.content}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5 ml-4">
                    {formatConversationDate(rep.lastActiveAt)}
                  </span>
                </div>
              </div>
            </button>
          ))
          }
          </div>
        )}
      </ScrollArea>
    </div>
  );
});

ConversationList.displayName = 'ConversationList';
