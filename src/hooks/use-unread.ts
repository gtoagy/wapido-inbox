'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * No-leído por contacto, persistido en localStorage y reactivo entre vistas.
 *
 * Operación mono-usuario: el estado "qué ya vi" vive solo en este navegador
 * (no hace falta backend). Se guarda un mapa `groupKey -> epoch ms` con la
 * última actividad que el operador ya revisó de cada contacto.
 *
 * Usamos `useSyncExternalStore` sobre un store a nivel módulo para que marcar
 * un chat como visto en la Lista actualice al instante el contador de la
 * pestaña que vive en el contenedor padre (inbox-app), sin prop-drilling.
 *
 * Heurística "necesita humano" (decisión del dueño): solo cuenta como no-leído
 * lo que requiere intervención humana. Si Wapi atiende bien, su última respuesta
 * es outbound; si el último mensaje es inbound (del cliente) sin respuesta, o el
 * workflow está en handoff, eso es lo que el operador debe ver. Lo que Wapi
 * maneja activamente (running/waiting) NO genera ruido.
 */

const STORAGE_KEY = 'inbox:last-seen';

type SeenMap = Record<string, number>; // groupKey -> epoch ms de lo último visto

let cache: SeenMap | null = null;
const listeners = new Set<() => void>();

function read(): SeenMap {
  if (cache) return cache;
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as SeenMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function write(next: SeenMap) {
  cache = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort: storage lleno o bloqueado
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const EMPTY: SeenMap = {};
function getServerSnapshot(): SeenMap {
  return EMPTY;
}

function msTime(value?: string): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

export type UnreadConv = {
  lastActiveAt?: string;
  lastMessage?: { direction: string };
};

/**
 * ¿El chat requiere ojos humanos? handoff siempre sí; running/waiting (Wapi
 * atendiendo) nunca; en cualquier otro caso, sí cuando el último mensaje es del
 * cliente (inbound). Pensada para degradar bien: si no hay `workflowStatus`
 * (p.ej. en el detector de notificaciones que no lo consulta), cae al inbound.
 */
export function needsHuman(lastDirection?: string, workflowStatus?: string): boolean {
  if (workflowStatus === 'handoff') return true;
  if (workflowStatus === 'running' || workflowStatus === 'waiting') return false;
  return lastDirection === 'inbound';
}

export function useUnread() {
  const seen = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const isUnread = useCallback(
    (groupKey: string, conv: UnreadConv, workflowStatus?: string): boolean => {
      if (!needsHuman(conv.lastMessage?.direction, workflowStatus)) return false;
      return msTime(conv.lastActiveAt) > (seen[groupKey] ?? 0);
    },
    [seen],
  );

  const markSeen = useCallback((groupKey: string, lastActiveAt?: string) => {
    const t = msTime(lastActiveAt) || Date.now();
    const current = read();
    if ((current[groupKey] ?? 0) >= t) return; // ya está al día
    write({ ...current, [groupKey]: t });
  }, []);

  return { seen, isUnread, markSeen };
}
