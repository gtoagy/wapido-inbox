'use client';

// Punto único de control de acceso a features por plan (entitlements).
//
// FASE 1: todo desbloqueado (flag en true). El resto de la app NUNCA pregunta
// "¿qué plan tiene el tenant?" directamente — solo consulta aquí "¿puede usar
// X?". Así, cuando el CRM (u otra feature) pase a ser de pago, basta cambiar
// este archivo para leer el plan real (de Supabase / del tenant), sin tocar la
// navegación ni los componentes que ya consumen el flag.

export type Entitlements = {
  /** Acceso a la vista CRM (kanban). Candidato a feature de plan superior. */
  crm: boolean;
};

/**
 * Devuelve las capacidades habilitadas para el usuario/tenant actual.
 *
 * TODO Fase 2: derivar del plan del tenant (p.ej. leer `tenants.plan` o un RPC
 * de Supabase) y retornar `{ crm: plan === 'pro' }`. Cuando `crm` sea false, el
 * contenedor ya está preparado para mostrar un upsell en lugar del board.
 */
export function useEntitlements(): Entitlements {
  return { crm: true };
}
