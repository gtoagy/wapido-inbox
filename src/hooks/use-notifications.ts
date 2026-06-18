'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAutoPolling } from './use-auto-polling';
import { useUnread } from './use-unread';
import { readNotificationSettings } from './use-notification-settings';
import { playNotificationSound } from '@/lib/notification-sound';

/**
 * Motor de notificaciones del inbox. Se monta UNA vez en el contenedor común
 * (inbox-app), independiente de la vista activa, y con polling keep-alive para
 * detectar mensajes nuevos incluso cuando la pestaña está en segundo plano.
 *
 * Qué hace:
 *  - Mantiene el contador en el título de la pestaña ("(3) Inbox") siempre.
 *  - Cuando entra algo que "necesita humano" y la ventana NO está enfocada,
 *    dispara sonido y/o notificación del navegador según la configuración.
 *
 * Detección sin spam: compara cada poll contra un snapshot del anterior y solo
 * avisa de contactos cuyo último mensaje (inbound) avanzó. Salta el primer poll
 * para no avisar el backlog al cargar la página.
 *
 * Nota: este poller usa solo `/api/conversations` (1 request barato) y NO
 * consulta el workflow status por conversación (eso son N requests). Por eso la
 * señal "necesita humano" aquí es la heurística de inbound; las vistas afinan el
 * badge con el workflow status real cuando lo tienen.
 */

type ApiConversation = {
  id: string;
  phoneNumber: string;
  status?: string;
  contactName?: string;
  lastActiveAt?: string;
  lastMessage?: { content: string; direction: string; type?: string };
};

const POLL_INTERVAL = 15000;

// Título base real de la pestaña (p.ej. "Wapido — Inbox"), capturado una vez
// para no pisarlo con un texto más pobre. Se limpia cualquier prefijo "(n) ".
let baseTitle = 'Inbox';
function captureBaseTitle(): string {
  if (typeof document === 'undefined') return baseTitle;
  const current = document.title.replace(/^\(\d+\)\s*/, '');
  if (current) baseTitle = current;
  return baseTitle;
}

function msTime(value?: string): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function groupKeyOf(c: ApiConversation): string {
  return c.phoneNumber || c.id;
}

// Una entrada representativa (la más reciente) por contacto.
function reduceToReps(convs: ApiConversation[]): ApiConversation[] {
  const byContact = new Map<string, ApiConversation>();
  for (const conv of convs) {
    const key = groupKeyOf(conv);
    const prev = byContact.get(key);
    if (!prev || msTime(conv.lastActiveAt) > msTime(prev.lastActiveAt)) {
      byContact.set(key, conv);
    }
  }
  return Array.from(byContact.values());
}

function isAway(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());
}

export function useInboxNotifications(): void {
  const { seen, isUnread } = useUnread();
  const [reps, setReps] = useState<ApiConversation[]>([]);

  // Snapshot del poll anterior: groupKey -> ms del último inbound conocido.
  const snapshotRef = useRef<Map<string, number>>(new Map());
  const isFirstPollRef = useRef(true);
  // Espejo de `seen` para leerlo dentro del callback de poll sin re-suscribir.
  const seenRef = useRef(seen);
  seenRef.current = seen;

  const fetchConversations = useCallback(async () => {
    let convs: ApiConversation[] = [];
    try {
      const res = await fetch('/api/conversations?status=active');
      const data = await res.json();
      convs = (data.data || []) as ApiConversation[];
    } catch {
      return; // error transitorio: no tocar snapshot ni título
    }

    const repList = reduceToReps(convs);
    setReps(repList);

    const nextSnapshot = new Map<string, number>();
    const newlyArrived: ApiConversation[] = [];
    const seenMap = seenRef.current;

    for (const rep of repList) {
      const key = groupKeyOf(rep);
      const ts = msTime(rep.lastActiveAt);
      nextSnapshot.set(key, ts);

      const isInbound = rep.lastMessage?.direction === 'inbound';
      const advanced = ts > (snapshotRef.current.get(key) ?? 0);
      const unseen = ts > (seenMap[key] ?? 0);
      if (isInbound && advanced && unseen) {
        newlyArrived.push(rep);
      }
    }

    const wasFirst = isFirstPollRef.current;
    snapshotRef.current = nextSnapshot;
    isFirstPollRef.current = false;

    // No avisar el backlog inicial ni cuando el operador está mirando el inbox.
    if (wasFirst || newlyArrived.length === 0 || !isAway()) return;

    const settings = readNotificationSettings();

    if (settings.sound) {
      playNotificationSound(false);
    }

    if (settings.desktop && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const first = newlyArrived[0];
      const name = first.contactName || first.phoneNumber;
      const title =
        newlyArrived.length === 1 ? `Nuevo mensaje — ${name}` : `${newlyArrived.length} chats necesitan atención`;
      const body = newlyArrived.length === 1 ? first.lastMessage?.content ?? '' : `Incluye a ${name}`;
      try {
        const n = new Notification(title, { body, tag: 'wapido-inbox' });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        // algunos navegadores requieren ServiceWorker para Notification; ignorar
      }
    }
  }, []);

  // Polling keep-alive: sigue corriendo aunque la pestaña esté oculta, para
  // poder avisar justo cuando el operador está en otra pestaña.
  useAutoPolling({
    interval: POLL_INTERVAL,
    enabled: true,
    keepAliveWhenHidden: true,
    onPoll: fetchConversations,
  });

  // Contador en el título de la pestaña, siempre en sync con lo no-leído.
  const unreadCount = reps.reduce((acc, rep) => (isUnread(groupKeyOf(rep), rep) ? acc + 1 : acc), 0);
  useEffect(() => {
    const base = captureBaseTitle();
    document.title = unreadCount > 0 ? `(${unreadCount}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [unreadCount]);
}
