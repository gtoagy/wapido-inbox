'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConversationCard, type KanbanConversation } from './conversation-card';
import { STAGE_ACCENTS, type PipelineStage } from '@/lib/pipeline';

type Props = {
  stage: PipelineStage;
  /** Todas las etapas del pipeline (para el menú "Mover a etapa" de las tarjetas). */
  allStages: PipelineStage[];
  conversations: KanbanConversation[];
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropConversation: (conversationId: string, stageId: string) => void;
  onCardClick?: (conversation: KanbanConversation) => void;
};

export function KanbanColumn({
  stage,
  allStages,
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
    <div className="flex w-[85vw] max-w-80 md:w-80 flex-shrink-0 snap-center md:snap-align-none flex-col rounded-xl bg-muted/40">
      {/* Header de la columna */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium min-w-0',
            accent.pill,
          )}
        >
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0', accent.dot)} />
          <span className="truncate">{stage.name}</span>
        </span>
        <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
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
                  key={conv.groupKey}
                  conversation={conv}
                  isDragging={draggingId === conv.groupKey}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onClick={onCardClick}
                  stages={allStages}
                  currentStageId={stage.id}
                  onMoveToStage={onDropConversation}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
