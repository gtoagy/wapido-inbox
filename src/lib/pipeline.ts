// Modelo del embudo (pipeline) del CRM — FASE 1: mock en memoria.
//
// En Fase 2 esto vendrá de Supabase (tabla `pipeline_stages` configurable por
// tenant + `conversation_pipeline` para el mapeo conversación→etapa). Por ahora
// definimos etapas default y una asignación determinística para poblar el board
// y poder probar el drag & drop sin tocar el backend.

export type PipelineStage = {
  id: string;
  name: string;
  /** Color de acento de la columna (clave de COLUMN_ACCENTS). */
  color: StageColor;
  position: number;
};

export type StageColor =
  | 'blue'
  | 'violet'
  | 'amber'
  | 'orange'
  | 'green'
  | 'slate';

// Etapas default de fábrica. El usuario podrá editarlas/reordenarlas/crear las
// suyas en Fase 2; aquí son fijas para la demo.
export const DEFAULT_STAGES: PipelineStage[] = [
  { id: 'pedido-en-proceso', name: 'Pedido en proceso', color: 'amber', position: 0 },
  { id: 'necesita-atencion', name: 'Necesita atención', color: 'orange', position: 1 },
  { id: 'cerrado', name: 'Cerrado', color: 'green', position: 2 },
];

// Mapa de color → clases Tailwind para el header/acento de cada columna.
// Usamos colores planos de Tailwind (no tokens del tema) porque representan
// categorías arbitrarias definidas por el usuario, no estados semánticos del UI.
// `pill` sigue el patrón de header de columna del kanban de wapido-front.
export const STAGE_ACCENTS: Record<
  StageColor,
  { dot: string; header: string; badge: string; pill: string }
> = {
  blue: {
    dot: 'bg-blue-500',
    header: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  },
  violet: {
    dot: 'bg-violet-500',
    header: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900',
    pill: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  },
  amber: {
    dot: 'bg-amber-500',
    header: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
    pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  orange: {
    dot: 'bg-orange-500',
    header: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
    pill: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  },
  green: {
    dot: 'bg-green-500',
    header: 'text-green-700 dark:text-green-300',
    badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900',
    pill: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  },
  slate: {
    dot: 'bg-slate-400',
    header: 'text-slate-600 dark:text-slate-300',
    badge: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-800',
    pill: 'bg-slate-50 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300',
  },
};

// Hash determinístico simple (djb2) para repartir conversaciones entre etapas
// de forma estable entre renders sin guardar estado. Solo para el mock.
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Asigna una conversación a una etapa de forma determinística (mock Fase 1).
 * En Fase 2 esto será una lectura de `conversation_pipeline`.
 */
export function defaultStageForConversation(
  conversationId: string,
  stages: PipelineStage[] = DEFAULT_STAGES,
): string {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const index = hashString(conversationId) % sorted.length;
  return sorted[index].id;
}
