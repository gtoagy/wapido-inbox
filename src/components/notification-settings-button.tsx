'use client';

import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useNotificationSettings } from '@/hooks/use-notification-settings';
import { unlockAudio } from '@/lib/notification-sound';

/**
 * Control de avisos en el header del inbox. Toggles persistidos (sonido /
 * notificación del navegador). Al activar cualquiera se desbloquea el audio
 * (los navegadores exigen un gesto del usuario) y, para escritorio, se pide el
 * permiso del navegador en el momento.
 */
export function NotificationSettingsButton() {
  const { settings, setSetting } = useNotificationSettings();
  const anyOn = settings.sound || settings.desktop;

  const toggleSound = (checked: boolean) => {
    unlockAudio();
    setSetting('sound', checked);
  };

  const toggleDesktop = async (checked: boolean) => {
    unlockAudio();
    if (checked && typeof Notification !== 'undefined') {
      if (Notification.permission === 'denied') {
        setSetting('desktop', false);
        return;
      }
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setSetting('desktop', false);
          return;
        }
      }
    }
    setSetting('desktop', checked);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Avisos de mensajes nuevos"
        >
          {anyOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Avisos de mensajes nuevos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.sound}
          onCheckedChange={toggleSound}
          onSelect={(e) => e.preventDefault()}
        >
          Sonido
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={settings.desktop}
          onCheckedChange={toggleDesktop}
          onSelect={(e) => e.preventDefault()}
        >
          Notificación del navegador
        </DropdownMenuCheckboxItem>
        <p className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
          Solo te avisa cuando no estás viendo el inbox, y solo de chats que necesitan tu atención.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
