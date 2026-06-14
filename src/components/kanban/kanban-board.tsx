'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutoPolling } from '@/hooks/use-auto-polling';
import { MessageView } from '@/components/message-view';
import { ViewSwitcher } from '@/components/view-switcher';
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

function msTime(value?: string): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function KanbanBoard() {
  const [stages] = useState<PipelineStage[]>(DEFAULT_STAGES);
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  // id de conversación -> workflow execution {id, status} (para badge + handoff).
  const [workflowMap, setWorkflowMap] = useState<Map<string, WorkflowExecution>>(new Map());
  // Overrides locales de etapa por drag & drop (Fase 1, en memoria).
  const [stageOverrides, setStageOverrides] = useState<Record<string, string>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Chat abierto: todas las conversaciones del contacto (la primera es la más
  // reciente = la principal a la que se envían mensajes nuevos).
  const [activeContactConvs, setActiveContactConvs] = useState<ApiConversation[] | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleDrop = (groupKey: string, stageId: string) => {
    setStageOverrides((prev) => ({ ...prev, [groupKey]: stageId }));
    setDraggingId(null);
  };

  // Al abrir una tarjeta: cargamos TODAS las conversaciones del contacto
  // (ordenadas de más reciente a más antigua) y mostramos la más reciente.
  const handleCardClick = useCallback(
    (card: KanbanConversation) => {
      const convs = conversations
        .filter((c) => (c.phoneNumber || c.id) === card.groupKey)
        .sort((a, b) => msTime(b.lastActiveAt) - msTime(a.lastActiveAt));
      setActiveContactConvs(convs.length ? convs : null);
    },
    [conversations],
  );

  const closeChat = () => setActiveContactConvs(null);

  // Agrupamos por contacto y luego por etapa.
  const conversationsByStage = useMemo(() => {
    const grouped: Record<string, KanbanConversation[]> = {};
    for (const stage of stages) grouped[stage.id] = [];

    // 1) Agrupar conversaciones por contacto (teléfono).
    const byContact = new Map<string, ApiConversation[]>();
    for (const conv of conversations) {
      const key = conv.phoneNumber || conv.id;
      const arr = byContact.get(key);
      if (arr) arr.push(conv);
      else byContact.set(key, [conv]);
    }

    // 2) Una tarjeta por contacto: la conversación más reciente es la
    // representativa (la que se abre al hacer clic). El stage se asigna por
    // contacto (groupKey) para que sea estable aunque cambie la representativa.
    for (const [groupKey, convs] of byContact) {
      const sorted = convs
        .slice()
        .sort((a, b) => msTime(b.lastActiveAt) - msTime(a.lastActiveAt));
      const rep = sorted[0];
      const stageId = stageOverrides[groupKey] ?? defaultStageForConversation(groupKey, stages);
      if (!grouped[stageId]) continue;
      grouped[stageId].push({
        id: rep.id,
        groupKey,
        count: convs.length,
        phoneNumber: rep.phoneNumber,
        contactName: rep.contactName,
        status: rep.status,
        lastActiveAt: rep.lastActiveAt,
        lastMessage: rep.lastMessage,
        workflowStatus: workflowMap.get(rep.id)?.status,
      });
    }
    return grouped;
  }, [conversations, stages, stageOverrides, workflowMap]);

  const mainConv = activeContactConvs?.[0] ?? null;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
          {isPolling && (
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" title="Actualizando" />
          )}
        </div>
        <div className="flex-shrink-0">
          <ViewSwitcher active="kanban" />
        </div>
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
        <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4 snap-x snap-mandatory md:snap-none">
          {stages
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                allStages={stages}
                conversations={conversationsByStage[stage.id] ?? []}
                draggingId={draggingId}
                onDragStart={setDraggingId}
                onDragEnd={() => setDraggingId(null)}
                onDropConversation={handleDrop}
                onCardClick={handleCardClick}
              />
            ))}
        </div>
      )}

      {/* Panel deslizante con el chat — se abre al hacer clic en una tarjeta */}
      {activeContactConvs && mainConv && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeChat} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] bg-card shadow-2xl">
            <MessageView
              key={mainConv.id}
              conversationId={mainConv.id}
              contactConversations={activeContactConvs}
              phoneNumber={mainConv.phoneNumber}
              contactName={mainConv.contactName}
              conversationStatus={mainConv.status}
              isVisible
              onBack={closeChat}
              onStatusChange={fetchConversations}
              onTemplateSent={async () => {
                await fetchConversations();
              }}
              workflowExecution={workflowMap.get(mainConv.id) ?? null}
              onWorkflowAction={() => fetchWorkflowStatuses()}
            />
          </div>
        </>
      )}
    </div>
  );
}
