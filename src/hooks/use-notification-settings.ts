'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferencias de aviso del operador, persistidas en localStorage y reactivas
 * entre componentes (el botón de configuración vive en el header de cada vista,
 * pero el motor de notificaciones vive en inbox-app — ambos leen el mismo store).
 *
 * - `sound`: beep al entrar algo que necesita humano (solo si la ventana no está
 *   enfocada). Default ON.
 * - `desktop`: notificación del navegador (requiere permiso explícito). Default
 *   OFF porque depende de `Notification.requestPermission()`.
 *
 * Mismo patrón de store a nivel módulo que `use-unread` para sincronizar
 * instancias dentro de la misma pestaña.
 */

const STORAGE_KEY = 'inbox:notif-settings';

export type NotificationSettings = {
  sound: boolean;
  desktop: boolean;
};

const DEFAULTS: NotificationSettings = { sound: true, desktop: false };

let cache: NotificationSettings | null = null;
const listeners = new Set<() => void>();

function read(): NotificationSettings {
  if (cache) return cache;
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NotificationSettings>) } : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

function write(next: NotificationSettings) {
  cache = next;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // best-effort
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

function getServerSnapshot(): NotificationSettings {
  return DEFAULTS;
}

export function useNotificationSettings() {
  const settings = useSyncExternalStore(subscribe, read, getServerSnapshot);

  const setSetting = useCallback(<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    write({ ...read(), [key]: value });
  }, []);

  return { settings, setSetting };
}

/** Lectura puntual fuera de React (para el motor de notificaciones). */
export function readNotificationSettings(): NotificationSettings {
  return read();
}
