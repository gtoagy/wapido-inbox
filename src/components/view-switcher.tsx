'use client';

import Link from 'next/link';
import { LayoutGrid, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'inbox' | 'kanban';

const baseItem =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors';

/**
 * Toggle para alternar entre el inbox clásico (/) y la vista CRM Kanban (/kanban).
 * Resalta la vista activa y navega con Link (SPA) a la otra.
 */
// Fondo sólido (no semitransparente) para que el estado activo contraste igual
// sin importar el color del header (gris en el inbox, blanco en el Kanban).
const activeItem = 'bg-card text-primary shadow-sm';
const inactiveItem = 'text-muted-foreground hover:text-foreground';

export function ViewSwitcher({ active }: { active: View }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5">
      <Link
        href="/"
        aria-current={active === 'inbox' ? 'page' : undefined}
        className={cn(baseItem, active === 'inbox' ? activeItem : inactiveItem)}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Inbox
      </Link>
      <Link
        href="/kanban"
        aria-current={active === 'kanban' ? 'page' : undefined}
        className={cn(baseItem, active === 'kanban' ? activeItem : inactiveItem)}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        CRM
      </Link>
    </div>
  );
}
