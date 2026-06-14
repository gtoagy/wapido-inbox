'use client';

import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Etiqueta única de "a quién le corresponde el chat", compartida por el inbox y
// el Kanban para mantener consistencia. Deriva del estado del workflow de Kapso:
//   handoff            → Humano (atención manual)
//   running | waiting  → Wapi (el agente IA está a cargo)
//   ended | sin estado → sin etiqueta
export function AssignmentBadge({
  workflowStatus,
  className,
}: {
  workflowStatus?: string;
  className?: string;
}) {
  if (!workflowStatus || workflowStatus === 'ended') return null;

  const isHuman = workflowStatus === 'handoff';

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0 h-4 flex-shrink-0 gap-0.5',
        isHuman
          ? 'bg-warning-light text-warning border-warning/30'
          : 'bg-success-light text-success border-success/30',
        className,
      )}
      title={isHuman ? 'Atendido por un humano' : 'Atendido por Wapi'}
    >
      {isHuman ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
      {isHuman ? 'Humano' : 'Wapi'}
    </Badge>
  );
}
