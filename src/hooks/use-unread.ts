'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * No-leído por contacto, persistido en localStorage y reactivo entre vistas.
 *
 * Operación mono-usuario: el estado vive solo en este navegador (sin backend).
 * Dos piezas:
 *  - `inbox:last-seen` (groupKey -> epoch ms): última actividad ya revisada.
 *    Maneja el booleano "está sin leer".
 *  - `inbox:unread-counts` (groupKey -> número): cuántos mensajes se han
 *    acumulado sin leer. Lo alimenta el motor de notificaciones sumando el
 *    delta de `messagesCount` entre polls; se resetea al abrir el chat.
 *
 * Usamos `useSyncExternalStore` sobre stores a nivel módulo para que marcar un
 * chat como visto (o que entre un mensaje) se refleje al instante en todas las
 * vistas y en el contador de la pestaña, sin prop-drilling.
 *
 * Heurística "necesita humano" (decisión del dueño): solo cuenta como no-leído
 * lo que requiere intervención humana. Si Wapi atiende bien, su última respuesta
 * es outbound; si el último mensaje es inbound (del cliente) sin respuesta, o el
 * workflow está en handoff, eso es lo que el operador debe ver. Lo que Wapi
 * maneja activamente (running/waiting) NO genera ruido.
 */

const SEEN_KEY = 'inbox:last-seen';
const COUNTS_KEY = 'inbox:unread-counts';

type SeenMap = Record<string, number>; // groupKey -> epoch ms de lo último visto
type CountMap = Record<string, number>; // groupKey -> mensajes acumulados sin leer

// ---- Store genérico de localStorage con suscriptores (para useSyncExternalStore).
function createStore<T extends object>(key: string, empty: T) {
  let cache: T | null = null;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache) return cache;
    if (typeof window === 'undefined') return empty;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as T) : empty;
    } catch {
      cache = empty;
    }
    return cache;
  };

  const write = (next: T) => {
    cache = next;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // best-effort
      }
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  };

  return { read, write, subscribe, getServerSnapshot: () => empty };
}

const seenStore = createStore<SeenMap>(SEEN_KEY, {});
const countsStore = createStore<CountMap>(COUNTS_KEY, {});

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
 * cliente (inbound). Degrada bien sin `workflowStatus` (cae al inbound).
 */
export function needsHuman(lastDirection?: string, workflowStatus?: string): boolean {
  if (workflowStatus === 'handoff') return true;
  if (workflowStatus === 'running' || workflowStatus === 'waiting') return false;
  return lastDirection === 'inbound';
}

// ---- API fuera de React (para el motor de notificaciones) -------------------

/** Suma `delta` mensajes sin leer a un contacto. */
export function bumpUnreadCount(groupKey: string, delta: number): void {
  if (delta <= 0) return;
  const current = countsStore.read();
  countsStore.write({ ...current, [groupKey]: (current[groupKey] ?? 0) + delta });
}

/** Marca un contacto como visto: actualiza timestamp y resetea su contador. */
export function markContactSeen(groupKey: string, lastActiveAt?: string): void {
  const ts = msTime(lastActiveAt) || Date.now();
  const seen = seenStore.read();
  if ((seen[groupKey] ?? 0) < ts) {
    seenStore.write({ ...seen, [groupKey]: ts });
  }
  const counts = countsStore.read();
  if (counts[groupKey]) {
    const rest = { ...counts };
    delete rest[groupKey];
    countsStore.write(rest);
  }
}

// ---- Hook reactivo ----------------------------------------------------------

export function useUnread() {
  const seen = useSyncExternalStore(seenStore.subscribe, seenStore.read, seenStore.getServerSnapshot);
  const counts = useSyncExternalStore(countsStore.subscribe, countsStore.read, countsStore.getServerSnapshot);

  const isUnread = useCallback(
    (groupKey: string, conv: UnreadConv, workflowStatus?: string): boolean => {
      if (!needsHuman(conv.lastMessage?.direction, workflowStatus)) return false;
      return msTime(conv.lastActiveAt) > (seen[groupKey] ?? 0);
    },
    [seen],
  );

  /**
   * Número a mostrar en el globito: 0 si no está sin leer; si lo está, el
   * acumulado observado con piso de 1 (un chat sin leer tiene al menos 1
   * mensaje pendiente aunque no hayamos visto el delta en vivo).
   */
  const unreadBadge = useCallback(
    (groupKey: string, conv: UnreadConv, workflowStatus?: string): number => {
      if (!isUnread(groupKey, conv, workflowStatus)) return 0;
      return Math.max(1, counts[groupKey] ?? 0);
    },
    [isUnread, counts],
  );

  const markSeen = useCallback((groupKey: string, lastActiveAt?: string) => {
    markContactSeen(groupKey, lastActiveAt);
  }, []);

  return { seen, counts, isUnread, unreadBadge, markSeen };
}
