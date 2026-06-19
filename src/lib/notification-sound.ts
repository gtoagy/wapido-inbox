// Sonido de notificación generado en runtime con la Web Audio API — sin archivo
// de audio (cero assets, cero licencias). Un tono suave para avisos normales y
// un doble tono ascendente para urgentes (handoff).
//
// Los navegadores bloquean el audio hasta que hay un gesto del usuario, por eso
// exponemos `unlockAudio()` para llamarlo desde un click (p.ej. al activar las
// notificaciones) y dejar el AudioContext listo.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Desbloquea/reanuda el audio. Llamar desde un gesto del usuario. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') {
    c.resume().catch(() => {});
  }
}

function beep(frequency: number, startOffset: number, duration: number): void {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  const t0 = c.currentTime + startOffset;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.15, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

export function playNotificationSound(urgent = false): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  if (urgent) {
    beep(880, 0, 0.18);
    beep(1175, 0.2, 0.22);
  } else {
    beep(660, 0, 0.22);
  }
}
