import { Suspense } from 'react';
import { InboxApp } from '@/components/inbox-app';

// Ambas vistas (lista y CRM) viven bajo esta misma ruta; la activa se decide
// con `?view=kanban`. InboxApp usa useSearchParams, que en Next 15 requiere un
// límite de Suspense.
export default function Home() {
  return (
    <Suspense>
      <InboxApp />
    </Suspense>
  );
}
