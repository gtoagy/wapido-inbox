import { redirect } from 'next/navigation';

// La vista CRM ya no es una ruta propia: vive en /?view=kanban. Mantenemos
// /kanban como redirect para no romper bookmarks ni links viejos.
export default function KanbanPage() {
  redirect('/?view=kanban');
}
