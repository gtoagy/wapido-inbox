'use client';

import { useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { format, isValid, isToday, isYesterday } from 'date-fns';
import { RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId?: string;
  isHidden?: boolean;
};

export type ConversationListRef = {
  refresh: () => Promise<Conversation[]>;
  selectByPhoneNumber: (phoneNumber: string) => void;
};

export const ConversationList = forwardRef<ConversationListRef, Props>(
  ({ onSelectConversation, selectedConversationId, isHidden = false }, ref) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('active');
  const [workflowStatusMap, setWorkflowStatusMap] = useState<Map<string, string>>(new Map());

  const fetchWorkflowStatuses = useCallback(async (convs: Conversation[]) => {
    const newMap = new Map<string, string>();
    await Promise.allSettled(
      convs.map(async (conv) => {
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
      setConversations(data.data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (conversations.length > 0) {
      fetchWorkflowStatuses(conversations);
    }
  }, [conversations, fetchWorkflowStatuses]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  // Auto-polling for conversations (every 10 seconds)
  const { isPolling } = useAutoPolling({
    interval: 10000,
    enabled: true,
    onPoll: fetchConversations
  });

  const selectByPhoneNumber = (phoneNumber: string) => {
    const conversation = conversations.find(conv => conv.phoneNumber === phoneNumber);
    if (conversation) {
      onSelectConversation(conversation);
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

  const filteredConversations = conversations.filter((conv) => {
    const query = searchQuery.toLowerCase();
    return (
      conv.phoneNumber.toLowerCase().includes(query) ||
      conv.contactName?.toLowerCase().includes(query)
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Conversaciones</h1>
            {isPolling && (
              <div
                className="h-2 w-2 rounded-full bg-green-500 animate-pulse"
                title="Actualizando"
              />
            )}
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
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {searchQuery ? 'No se encontraron conversaciones' : 'Sin conversaciones'}
          </div>
        ) : (
          <div className="w-full overflow-hidden">
          {filteredConversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              className={cn(
                'w-full p-3 pr-4 border-b border-border hover:bg-background text-left transition-colors relative overflow-hidden',
                selectedConversationId === conversation.id && 'bg-background'
              )}
            >
              <div className="flex gap-3 items-start overflow-hidden">
                <Avatar className="h-12 w-12 flex-shrink-0">
                  <AvatarFallback className="bg-muted text-foreground text-sm font-medium">
                    {getAvatarInitials(conversation.contactName, conversation.phoneNumber)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex justify-between items-start gap-4 overflow-hidden">
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground truncate">
                        {conversation.contactName || conversation.phoneNumber}
                      </p>
                      {workflowStatusMap.get(conversation.id) === 'running' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                          Workflow
                        </Badge>
                      )}
                      {workflowStatusMap.get(conversation.id) === 'handoff' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-orange-50 text-orange-700 border-orange-200 flex-shrink-0">
                          Handoff
                        </Badge>
                      )}
                      {workflowStatusMap.get(conversation.id) === 'waiting' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-yellow-50 text-yellow-700 border-yellow-200 flex-shrink-0">
                          En espera
                        </Badge>
                      )}
                    </div>
                    {conversation.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {conversation.lastMessage.direction === 'outbound' && (
                          <span className="text-[#53bdeb]">✓ </span>
                        )}
                        {conversation.lastMessage.content}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5 ml-4">
                    {formatConversationDate(conversation.lastActiveAt)}
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
