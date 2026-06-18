'use client';

import { useSearchParams } from 'next/navigation';
import { InboxView } from '@/components/inbox-view';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { useEntitlements } from '@/lib/entitlements';
import { useInboxNotifications } from '@/hooks/use-notifications';

// Contenedor que unifica las dos vistas del inbox bajo la misma ruta (/).
// La vista activa se controla con el query param `?view=kanban` (en vez de una
// ruta /kanban aparte), para que el toggle no navegue fuera y para poder
// deep-linkear a una vista — útil cuando el CRM sea de plan superior y haya que
// mostrar un upsell a quien llegue sin acceso.
export function InboxApp() {
  const searchParams = useSearchParams();
  const { crm } = useEntitlements();

  // Motor de notificaciones + contador en la pestaña. Vive aquí (contenedor
  // común a ambas vistas) para correr sin importar la vista activa y seguir
  // detectando mensajes nuevos aunque la pestaña esté en segundo plano.
  useInboxNotifications();

  const wantsKanban = searchParams.get('view') === 'kanban';

  // Seam de entitlements: solo mostramos el CRM si el plan lo permite.
  // Hoy `crm` es siempre true (Fase 1). Cuando sea de pago y `crm` sea false,
  // aquí se renderizará el upsell en lugar del board (TODO Fase 2).
  if (wantsKanban && crm) {
    return <KanbanBoard />;
  }

  // TODO Fase 2: if (wantsKanban && !crm) return <CrmUpsell />;
  return <InboxView />;
}
