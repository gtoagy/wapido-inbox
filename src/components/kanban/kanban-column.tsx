'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationCard, type KanbanConversation } from './conversation-card';
import { STAGE_ACCENTS, type PipelineStage } from '@/lib/pipeline';

type Props = {
  stage: PipelineStage;
  conversations: KanbanConversation[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropConversation: (conversationId: string, stageId: string) => void;
  onCardClick?: (conversation: KanbanConversation) => void;
};

export function KanbanColumn({
  stage,
  conversations,
  draggingId,
  onDragStart,
  onDragEnd,
  onDropConversation,
  onCardClick,
}: Props) {
  const [isOver, setIsOver] = useState(false);
  const accent = STAGE_ACCENTS[stage.color];

  return (
    <div className="flex w-80 flex-shrink-0 flex-col rounded-xl bg-muted/40">
      {/* Header de la columna */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', accent.dot)} />
          <h3 className={cn('text-sm font-semibold truncate', accent.header)}>{stage.name}</h3>
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-card rounded-full px-2 py-0.5 flex-shrink-0">
          {conversations.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!isOver) setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          if (draggingId) onDropConversation(draggingId, stage.id);
        }}
        className={cn(
          'flex-1 min-h-0 rounded-b-xl transition-colors',
          isOver && 'bg-primary/5 ring-2 ring-inset ring-primary/40',
        )}
      >
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-2 p-2">
            {conversations.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground/60">
                Sin conversaciones
              </div>
            ) : (
              conversations.map((conv) => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  isDragging={draggingId === conv.id}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onClick={onCardClick}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
