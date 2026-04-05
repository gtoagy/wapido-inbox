'use client';

import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type InfoPanelProps = {
  conversationId: string;
  contactName?: string;
  phoneNumber: string;
  lastActiveAt?: string;
  status?: string;
  onClose: () => void;
};

export function InfoPanel({
  contactName,
  phoneNumber,
  lastActiveAt,
  status,
  onClose,
}: InfoPanelProps) {
  const isActive = status === 'active';

  const relativeTime = lastActiveAt
    ? formatDistanceToNow(new Date(lastActiveAt), { addSuffix: true, locale: es })
    : null;

  return (
    <div className="w-full md:w-80 flex-shrink-0 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">Info</h2>
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Ultima actividad */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Ultima actividad
          </h3>
          <div className="flex items-center gap-2">
            {relativeTime && (
              <span className="text-sm text-foreground">{relativeTime}</span>
            )}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                isActive
                  ? 'bg-green-500/10 text-green-600'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isActive ? 'Activo' : 'Cerrado'}
            </span>
          </div>
        </div>

        {/* Contacto */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Contacto
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Nombre</p>
              <p className="text-sm text-foreground">
                {contactName || 'Sin nombre'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="text-sm text-foreground">{phoneNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
