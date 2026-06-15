'use client';

import { useCallback, useState } from 'react';

export type StatusFilter = 'all' | 'active' | 'ended';

const STORAGE_KEY = 'inbox:status-filter';
const DEFAULT_FILTER: StatusFilter = 'active';

function isStatusFilter(value: unknown): value is StatusFilter {
  return value === 'all' || value === 'active' || value === 'ended';
}

/**
 * Filtro de estado (Activos/Todos/Cerrados) persistido en localStorage y
 * compartido entre las vistas Lista y CRM.
 *
 * - Default: 'active' en ambas vistas.
 * - Recuerda la última elección del usuario entre recargas.
 * - Una sola clave compartida: cambiar el filtro en una vista lo aplica también
 *   a la otra al entrar en ella (las vistas no coexisten en pantalla, así que
 *   basta releer localStorage al montar; no hace falta sincronización en vivo).
 *
 * El valor inicial se lee con lazy init + guard de `window` para no romper en
 * SSR. Como ambas vistas se montan en cliente (el contenedor usa
 * useSearchParams bajo Suspense), no hay desajuste de hidratación.
 */
export function useStatusFilter(): [StatusFilter, (value: StatusFilter) => void] {
  const [filter, setFilter] = useState<StatusFilter>(() => {
    if (typeof window === 'undefined') return DEFAULT_FILTER;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return isStatusFilter(saved) ? saved : DEFAULT_FILTER;
  });

  const update = useCallback((value: StatusFilter) => {
    setFilter(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
  }, []);

  return [filter, update];
}
