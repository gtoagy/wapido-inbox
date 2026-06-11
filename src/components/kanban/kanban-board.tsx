'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { MessageView } from '@/components/message-view';
import { KanbanColumn } from './kanban-column';
import type { KanbanConversation } from './conversation-card';
import {
  DEFAULT_STAGES,
  defaultStageForConversation,
  type PipelineStage,
} from '@/lib/pipeline';

type ApiConversation = {
  id: string;
  phoneNumber: string;
  status?: string;
  contactName?: string;
  lastActiveAt?: string;
  lastMessage?: { content: string; direction: string; type?: string };
};

type WorkflowExecution = { id: string; status: string };

export function KanbanBoard() {
  const [stages] = useState<PipelineStage[]>(DEFAULT_STAGES);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  // id de conversación -> workflow execution {id, status} (para badge + handoff).
  const [workflowMap, setWorkflowMap] = useState<Map<string, WorkflowExecution>>(new Map());
  // Overrides locales de etapa por drag & drop (Fase 1, en memoria).
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<KanbanConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const conversationsRef = useRef<ApiConversation[]>([]);

  const fetchWorkflowStatuses = useCallback(async (convs?: ApiConversation[]) => {
    const target = convs ?? conversationsRef.current;
    const activeConvs = target.filter((c) => c.status === 'active');
    if (activeConvs.length === 0) return;

    const newMap = new Map<string, WorkflowExecution>();
    await Promise.allSettled(
      activeConvs.map(async (conv) => {
        try {
          const res = await fetch(`/api/conversations/${conv.id}/workflow`);
          const data = await res.json();
          const executions = data.data || data;
          if (Array.isArray(executions) && executions.length > 0) {
            const latest = executions[0];
            if (latest.id && latest.status && latest.status !== 'ended') {
              newMap.set(conv.id, { id: latest.id, status: latest.status });
            }
          }
        } catch {
          // ignore individual failures
        }
      }),
    );
    setWorkflowMap(newMap);
  }, []);

  const fetchConversations = useCallback(async () => {
    try {
      // Sin filtro de status traemos todas para repartirlas por el embudo.
      // (Kapso solo acepta 'active'/'ended'; omitir el parámetro = todas.)
      const response = await fetch('/api/conversations');
      const data = await response.json();
      const convs: ApiConversation[] = data.data || [];
      conversationsRef.current = convs;
      setConversations(convs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const didInitWorkflow = useRef(false);
  useEffect(() => {
    if (conversations.length > 0 && !didInitWorkflow.current) {
      didInitWorkflow.current = true;
      fetchWorkflowStatuses(conversations);
    }
  }, [conversations, fetchWorkflowStatuses]);

  const { isPolling } = useAutoPolling({
    interval: 15000,
    enabled: true,
    onPoll: fetchConversations,
  });
  useAutoPolling({
    interval: 60000,
    enabled: true,
    onPoll: () => fetchWorkflowStatuses(),
  });

  const handleRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const handleDrop = (conversationId: string, stageId: string) => {
    setStageOverrides((prev) => ({ ...prev, [conversationId]: stageId }));
    setDraggingId(null);
  };

  // Agrupamos conversaciones por etapa: override local si existe, si no la
  // asignación determinística mock.
  const conversationsByStage = useMemo(() => {
    const grouped: Record<string, KanbanConversation[]> = {};
    for (const stage of stages) grouped[stage.id] = [];

    for (const conv of conversations) {
      const stageId = stageOverrides[conv.id] ?? defaultStageForConversation(conv.id, stages);
      if (!grouped[stageId]) continue;
      grouped[stageId].push({
        id: conv.id,
        phoneNumber: conv.phoneNumber,
        contactName: conv.contactName,
        status: conv.status,
        lastActiveAt: conv.lastActiveAt,
        lastMessage: conv.lastMessage,
        workflowStatus: workflowMap.get(conv.id)?.status,
      });
    }
    return grouped;
  }, [conversations, stages, stageOverrides, workflowMap]);

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
            <Link href="/" title="Volver al inbox">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">CRM</h1>
            {isPolling && (
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Actualizando" />
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {conversations.length} conversaciones
          </span>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:bg-muted/30"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </header>

      {/* Board */}
      {loading ? (
        <div className="flex flex-1 gap-4 overflow-hidden p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex w-80 flex-shrink-0 flex-col gap-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4">
          {stages
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                conversations={conversationsByStage[stage.id] ?? []}
                draggingId={draggingId}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onDropConversation={handleDrop}
                onCardClick={setActiveConversation}
              />
            ))}
        </div>
      )}

      {/* Panel deslizante con el chat — se abre al hacer clic en una tarjeta */}
      {activeConversation && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setActiveConversation(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] bg-card shadow-2xl">
            <MessageView
              key={activeConversation.id}
              conversationId={activeConversation.id}
              phoneNumber={activeConversation.phoneNumber}
              contactName={activeConversation.contactName}
              conversationStatus={activeConversation.status}
              isVisible
              onBack={() => setActiveConversation(null)}
              onStatusChange={fetchConversations}
              onTemplateSent={async () => {
                await fetchConversations();
              }}
              workflowExecution={workflowMap.get(activeConversation.id) ?? null}
              onWorkflowAction={() => fetchWorkflowStatuses()}
            />
          </div>
        </>
      )}
    </div>
  );
}
