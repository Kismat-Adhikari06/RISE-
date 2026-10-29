import type { SoundId } from '../types';

/** A pattern schedules one cycle of audio starting at `t` and returns the cycle length in seconds. */
type Pattern = (ctx: AudioContext, out: AudioNode, t: number) => number;

const LOOKAHEAD_S = 30; // schedule far ahead so background-tab timer throttling can't starve the loop
const CHECK_MS = 1000;

function tone(ctx: AudioContext, out: AudioNode, o: { t: number; freq: number; dur: number; type?: OscillatorType; gain?: number; attack?: number; freqEnd?: number }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, o.t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, o.t + o.dur);
  const peak = o.gain ?? 0.5;
  const attack = o.attack ?? 0.01;
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.linearRampToValueAtTime(peak, o.t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  osc.connect(g).connect(out);
  osc.start(o.t);
  osc.stop(o.t + o.dur + 0.05);
}

const patterns: Record<SoundId, Pattern> = {
  sunrise(ctx, out, t) {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
    notes.forEach((f, i) => {
      tone(ctx, out, { t: t + i * 0.32, freq: f, dur: 1.1, type: 'sine', gain: 0.45 });
      tone(ctx, out, { t: t + i * 0.32, freq: f * 2, dur: 0.6, type: 'triangle', gain: 0.12 });
    });
    return 3.2;
  },
  digital(ctx, out, t) {
    for (let r = 0; r < 2; r++)
      for (let i = 0; i < 4; i++) tone(ctx, out, { t: t + r * 0.1 + i * 0.16 + r * 0.8, freq: 1760, dur: 0.09, type: 'square', gain: 0.22, attack: 0.005 });
    return 1.8;
  },
  pulse(ctx, out, t) {
    for (let i = 0; i < 4; i++) {
      tone(ctx, out, { t: t + i * 0.5, freq: 220, dur: 0.45, type: 'sine', gain: 0.7, attack: 0.04 });
      tone(ctx, out, { t: t + i * 0.5, freq: 440, dur: 0.3, type: 'triangle', gain: 0.18, attack: 0.04 });
    }
    return 2.2;
  },
  classic(ctx, out, t) {
    // Bell strikes: inharmonic partials with a fast decay, hammered rapidly.
    const partials = [1, 2.76, 5.4];
    for (let i = 0; i < 14; i++) {
      const st = t + i * 0.085;
      partials.forEach((p, k) => tone(ctx, out, { t: st, freq: 880 * p, dur: 0.22 / (k + 1) + 0.05, type: 'sine', gain: 0.32 / (k + 1), attack: 0.003 }));
    }
    return 2.4;
  },
  urgent(ctx, out, t) {
    for (let i = 0; i < 3; i++) tone(ctx, out, { t: t + i * 0.55, freq: 600, freqEnd: 1250, dur: 0.5, type: 'sawtooth', gain: 0.25, attack: 0.02 });
    return 1.8;
  },
};

type Listener = () => void;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private run: { bus: GainNode; timer: number } | null = null;
  private playingId: SoundId | null = null;
  private previewTimer: number | null = null;
  private listeners = new Set<Listener>();
  private volume = 0.8;

  get supported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }
  /** True when the browser is blocking playback until a user gesture. */
  get blocked(): boolean {
    return this.ctx !== null && this.ctx.state !== 'running';
  }
  get playing(): SoundId | null {
    return this.playingId;
  }
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  private ensure(): { ctx: AudioContext; master: GainNode } | null {
    if (!this.supported) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.ctx.onstatechange = () => this.emit();
    }
    return { ctx: this.ctx, master: this.master as GainNode };
  }

  /** Must be called from a user gesture at least once per page load. */
  async unlock(): Promise<boolean> {
    const e = this.ensure();
    if (!e) return false;
    try {
      if (e.ctx.state !== 'running') await e.ctx.resume();
      // Play an inaudible blip so iOS/Safari fully unlocks output.
      const g = e.ctx.createGain();
      g.gain.value = 0.0001;
      const o = e.ctx.createOscillator();
      o.connect(g).connect(e.ctx.destination);
      o.start();
      o.stop(e.ctx.currentTime + 0.02);
    } catch {
      /* still blocked */
    }
    this.emit();
    return e.ctx.state === 'running';
  }

  private halt(fade: number) {
    if (this.previewTimer !== null) {
      clearTimeout(this.previewTimer);
      this.previewTimer = null;
    }
    const r = this.run;
    this.run = null;
    this.playingId = null;
    if (r && this.ctx) {
      clearInterval(r.timer);
      const now = this.ctx.currentTime;
      r.bus.gain.cancelScheduledValues(now);
      r.bus.gain.setValueAtTime(r.bus.gain.value, now);
      r.bus.gain.linearRampToValueAtTime(0, now + fade);
      window.setTimeout(() => r.bus.disconnect(), fade * 1000 + 80);
    }
  }

  /** Starts a looping alarm sound. Any existing playback is replaced (never overlaps). */
  start(id: SoundId, volume: number): void {
    const e = this.ensure();
    if (!e) return;
    this.halt(0.05);
    this.setVolume(volume, 0);
    e.ctx.resume().catch(() => undefined);
    const bus = e.ctx.createGain();
    bus.connect(e.master);
    let next = e.ctx.currentTime + 0.08;
    const pump = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + LOOKAHEAD_S) next += patterns[id](this.ctx, bus, next);
    };
    pump();
    const timer = window.setInterval(pump, CHECK_MS);
    this.run = { bus, timer };
    this.playingId = id;
    this.emit();
  }

  /** Smoothly changes the output level (0..1). */
  setVolume(v: number, rampSec = 0.8): void {
    this.volume = Math.min(1, Math.max(0, v));
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this.volume, now + rampSec);
  }

  stop(fade = 0.25): void {
    this.halt(fade);
    this.emit();
  }

  /** Short audition. Never interrupts an actively ringing alarm. */
  preview(id: SoundId, volume: number, ms = 2800): void {
    if (this.playingId && this.previewTimer === null) return;
    this.start(id, volume);
    this.previewTimer = window.setTimeout(() => {
      this.previewTimer = null;
      this.stop(0.2);
    }, ms);
  }

  /** Short UI feedback sounds. */
  cue(kind: 'success' | 'error'): void {
    const e = this.ensure();
    if (!e || e.ctx.state !== 'running') return;
    const t = e.ctx.currentTime;
    const out = e.ctx.destination;
    if (kind === 'success') {
      tone(e.ctx, out, { t, freq: 660, dur: 0.18, gain: 0.18 });
      tone(e.ctx, out, { t: t + 0.12, freq: 990, dur: 0.3, gain: 0.18 });
    } else {
      tone(e.ctx, out, { t, freq: 180, dur: 0.22, type: 'triangle', gain: 0.2 });
    }
  }
}

export const audioEngine = new AudioEngine();

// Unlock audio on the first real gesture anywhere in the app.
if (typeof window !== 'undefined') {
  const unlockOnce = () => {
    void audioEngine.unlock();
  };
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach((ev) => window.addEventListener(ev, unlockOnce, { passive: true }));
}
