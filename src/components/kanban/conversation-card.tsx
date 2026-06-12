'use client';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MessagesSquare, MoreVertical } from 'lucide-react';
import { prefetchMessages } from '@/components/message-view';
import { AssignmentBadge } from '@/components/assignment-badge';
import { STAGE_ACCENTS, type PipelineStage } from '@/lib/pipeline';

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
  /** Etapas del pipeline para el menú "Mover a etapa" (alternativa táctil al drag). */
  stages?: PipelineStage[];
  currentStageId?: string;
  onMoveToStage?: (groupKey: string, stageId: string) => void;
};

export function ConversationCard({
  conversation,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
  stages,
  currentStageId,
  onMoveToStage,
}: Props) {
  const moveTargets = stages
    ?.filter((s) => s.id !== currentStageId)
    .sort((a, b) => a.position - b.position);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(conversation.groupKey)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => prefetchMessages(conversation.id)}
      onClick={() => onClick?.(conversation)}
      className={cn(
        'group relative rounded-lg border border-border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing',
        'transition-all hover:shadow-kanban hover:border-primary/30 hover:-translate-y-0.5',
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
            <div className="flex items-center gap-1 flex-shrink-0">
              <AssignmentBadge workflowStatus={conversation.workflowStatus} />
              {onMoveToStage && moveTargets && moveTargets.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 -mr-1 text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                      title="Mover a etapa"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuLabel>Mover a etapa</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {moveTargets.map((stage) => (
                      <DropdownMenuItem
                        key={stage.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveToStage(conversation.groupKey, stage.id);
                        }}
                      >
                        <span
                          className={cn(
                            'h-2 w-2 rounded-full flex-shrink-0',
                            STAGE_ACCENTS[stage.color].dot,
                          )}
                        />
                        {stage.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          {conversation.lastMessage && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {conversation.lastMessage.direction === 'outbound' && (
                <span className="text-muted-foreground">✓ </span>
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
