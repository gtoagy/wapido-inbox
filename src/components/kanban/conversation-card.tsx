'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bot, User } from 'lucide-react';
import { prefetchMessages } from '@/components/message-view';

export type KanbanConversation = {
  id: string;
  phoneNumber: string;
  contactName?: string;
  status?: string;
  lastActiveAt?: string;
  lastMessage?: {
    content: string;
    direction: string;
    type?: string;
  };
  /** Estado del workflow de Kapso en vivo: running | handoff | waiting. */
  workflowStatus?: string;
};

function getAvatarInitials(contactName?: string, phoneNumber?: string): string {
  if (contactName) {
    const words = contactName.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return contactName.slice(0, 2).toUpperCase();
  }
  if (phoneNumber) return phoneNumber.replace(/\D/g, '').slice(-2);
  return '??';
}

type Props = {
  conversation: KanbanConversation;
  isDragging?: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onClick?: (conversation: KanbanConversation) => void;
};

export function ConversationCard({ conversation, isDragging, onDragStart, onDragEnd, onClick }: Props) {
  const { workflowStatus } = conversation;
  // Eje "agente vs humano": running = el agente IA responde; handoff = lo
  // atiende un humano. waiting = el workflow espera (lo mostramos como agente).
  const isHuman = workflowStatus === 'handoff';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(conversation.id)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => prefetchMessages(conversation.id)}
      onClick={() => onClick?.(conversation)}
      className={cn(
        'group rounded-lg border border-border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing',
        'transition-all hover:shadow-md hover:border-primary/30',
        isDragging && 'opacity-40 ring-2 ring-primary',
      )}
    >
      <div className="flex gap-2.5 items-start">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarFallback className="bg-muted text-foreground text-xs font-medium">
            {getAvatarInitials(conversation.contactName, conversation.phoneNumber)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm text-foreground truncate">
              {conversation.contactName || conversation.phoneNumber}
            </p>
            {workflowStatus && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-4 flex-shrink-0 gap-0.5',
                  isHuman
                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                    : 'bg-green-50 text-green-700 border-green-200',
                )}
                title={isHuman ? 'Atendido por un humano' : 'Atendido por el agente IA'}
              >
                {isHuman ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                {isHuman ? 'Humano' : 'Agente'}
              </Badge>
            )}
          </div>
          {conversation.lastMessage && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {conversation.lastMessage.direction === 'outbound' && (
                <span className="text-[#53bdeb]">✓ </span>
              )}
              {conversation.lastMessage.content}
            </p>
          )}
          {conversation.contactName && (
            <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
              {conversation.phoneNumber}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
