/**
 * Web Audio API Synthesizer for prioritized chimes (click, emergency, important, regular).
 * Designed for Next.js SSR compatibility (safely checks for window/AudioContext).
 */

export type SoundType = 'click' | 'emergency' | 'important' | 'regular';

let isMuted = false;

export function setMuted(muted: boolean) {
  isMuted = muted;
}

export function getMuted(): boolean {
  return isMuted;
}

export function playSound(type: SoundType) {
  if (typeof window === 'undefined' || isMuted) return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'click') {
      // Gentle keyboard typing feedback sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start();
      osc.stop(now + 0.05);
    } else if (type === 'emergency') {
      // High-pitched warning pulse (Emergency Alert)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(660, now);
      osc1.frequency.linearRampToValueAtTime(880, now + 0.25);
      osc1.frequency.linearRampToValueAtTime(660, now + 0.5);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.8);
      osc2.stop(now + 0.8);
    } else if (type === 'important') {
      // Dual-tone chime for warning
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start();
      osc.stop(now + 0.4);
    } else if (type === 'regular') {
      // Gentle notification bubble sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start();
      osc.stop(now + 0.35);
    }
  } catch (e) {
    console.warn("Audio Context playback failed or blocked.", e);
  }
}
