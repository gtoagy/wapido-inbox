'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessagesSquare } from 'lucide-react';
import { prefetchMessages } from '@/components/message-view';
import { AssignmentBadge } from '@/components/assignment-badge';

export type KanbanConversation = {
  /** Conversación representativa (la más reciente del contacto) — la que se abre. */
  id: string;
  /** Clave de agrupación por contacto (teléfono): identifica la tarjeta en el board. */
  groupKey: string;
  /** Cuántas conversaciones tiene este contacto. */
  count?: number;
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
  return (
    <div
      draggable
      onDragStart={() => onDragStart(conversation.groupKey)}
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
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <p className="font-medium text-sm text-foreground truncate">
                {conversation.contactName || conversation.phoneNumber}
              </p>
              {conversation.count != null && conversation.count > 1 && (
                <span
                  className="flex-shrink-0 inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
                  title={`${conversation.count} conversaciones de este contacto`}
                >
                  <MessagesSquare className="h-2.5 w-2.5" />
                  {conversation.count}
                </span>
              )}
            </div>
            <AssignmentBadge workflowStatus={conversation.workflowStatus} />
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
