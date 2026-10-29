/**
 * Pure fallback bookkeeping for the detection tier roster. No browser APIs — tier loading is
 * injected, so escalation behaviour is unit-testable.
 *
 * Design:
 * - Tiers are ordered best-first; exactly one tier is active at a time.
 * - Load failures and inference failures both place a tier on a cooldown and move the roster on.
 * - A latency watchdog: if the first `slowWindow` passes of a tier average above `slowMs`,
 *   the tier is judged too slow for the device and escalates as well.
 * - Escalation requests are *reported* (`shouldEscalate`), never silently performed: the caller
 *   decides when to switch, awaits it, and uses the returned selection.
 * - When every tier is cooling down, `start()`/`escalate()` resolve null: no infinite loops.
 */
import type { Detector } from '../services/objectDetection';

/** Ordered inference options, best-first; loaded lazily, one at a time. */
export interface DetectorTier {
  /** Stable id, e.g. 'yolo26n-webgpu'. */
  readonly id: string;
  /** Short model label for diagnostics, e.g. 'yolo26n'. */
  readonly model: string;
  /** Backend label for diagnostics, e.g. 'webgpu'. */
  readonly backend: string;
  /**
   * Latency-watchdog budget for THIS tier (ms avg over the slow window). Tier-specific instead
   * of one global 3000ms, so a legitimately slower CPU tier is not flagged as broken software.
   * Falls back to the policy default when absent.
   */
  readonly budgetMs?: number;
  readonly load: () => Promise<Detector>;
  /** Frees GPU/wasm resources when the tier is abandoned (optional). */
  readonly release?: () => void;
}

export interface FallbackPolicyOptions {
  /** Consecutive inference failures allowed before escalating. */
  readonly consecutiveErrorLimit?: number;
  /** Average of the first `slowWindow` passes above this (ms) escalates. */
  readonly slowMs?: number;
  /** Number of early passes averaged by the latency watchdog. */
  readonly slowWindow?: number;
  /** A tier that failed cannot be retried for this long. */
  readonly cooldownMs?: number;
}

export const DEFAULT_FALLBACK_OPTIONS: Required<FallbackPolicyOptions> = {
  consecutiveErrorLimit: 2,
  slowMs: 3000,
  slowWindow: 3,
  cooldownMs: 30_000,
};

export type FailureKind = 'load' | 'inference' | 'slow' | null;

export interface TierState {
  readonly id: string;
  readonly model: string;
  readonly backend: string;
}

export interface DetectorSelection {
  readonly detector: Detector;
  readonly tier: TierState;
}

export interface LatencyStats {
  readonly avgMs: number;
  readonly lastMs: number;
  /** Approximate scans/sec = 1000 / (lastMs + 100ms breathing room), 1 decimal. */
  readonly fps: number;
}

export interface EscalationRequest {
  readonly kind: Exclude<FailureKind, null>;
  readonly detail: string;
}

export class DetectorRoster {
  private index = -1;
  private selection: DetectorSelection | null = null;
  private passes = 0;
  private consecutiveErrors = 0;
  private recentTimes: number[] = [];
  private cooldownUntil = new Map<number, number>();
  private pendingEscalate: EscalationRequest | null = null;
  private lastReason: EscalationRequest | null = null;
  private errorLog: string[] = [];

  constructor(
    private readonly tiers: readonly DetectorTier[],
    private readonly opts: Required<FallbackPolicyOptions> = DEFAULT_FALLBACK_OPTIONS,
  ) {}

  activeTier(): TierState | null {
    return this.index >= 0 ? this.tiers[this.index] : null;
  }

  current(): DetectorSelection | null {
    return this.selection;
  }

  latency(): LatencyStats {
    const n = this.recentTimes.length || 1;
    const avg = this.recentTimes.reduce((a, b) => a + b, 0) / n;
    const last = this.recentTimes[this.recentTimes.length - 1] ?? 0;
    const fps = last > 0 ? Math.round((1000 / Math.max(last + PASS_GAP_MS, 1)) * 10) / 10 : 0;
    return { avgMs: Math.round(avg), lastMs: Math.round(last), fps };
  }

  recentErrors(): readonly string[] {
    return this.errorLog.slice(-5);
  }

  fallbackReason(): EscalationRequest | null {
    return this.lastReason;
  }

  /** Earliest moment any cooling-down tier becomes retryable (or null if nothing is cooling down). */
  nextRecoverAt(): number | null {
    let min: number | null = null;
    for (const expiry of this.cooldownUntil.values()) {
      if (expiry > Date.now() && (min === null || expiry < min)) min = expiry;
    }
    return min;
  }

  /**
   * Loads the first tier that is not cooling down; null when all are cooling down/failed.
   * Concurrent callers share one in-flight start, so a tier is never loaded twice in parallel
   * (a second load would race and leak a duplicate GPU/wasm session).
   */
  async start(): Promise<DetectorSelection | null> {
    if (this.inflight) return this.inflight;
    this.inflight = this.startUncached().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async startUncached(): Promise<DetectorSelection | null> {
    for (let i = 0; i < this.tiers.length; i++) {
      if ((this.cooldownUntil.get(i) ?? 0) > Date.now()) continue;
      try {
        const detector = await this.tiers[i].load();
        this.adopt(i, detector);
        return this.selection;
      } catch (e) {
        this.coolDown(i, 'load', e);
      }
    }
    return null;
  }

  /** Bookkeeping for one successful pass; may queue a latency escalation request. */
  record(ms: number): void {
    this.consecutiveErrors = 0;
    this.passes++;
    this.recentTimes = [...this.recentTimes, ms].slice(-10);
    if (this.passes <= this.opts.slowWindow && this.recentTimes.length >= this.opts.slowWindow) {
      const avg = this.recentTimes.reduce((a, b) => a + b, 0) / this.recentTimes.length;
      const budget = this.index >= 0 ? this.tiers[this.index].budgetMs ?? this.opts.slowMs : this.opts.slowMs;
      if (avg > budget) {
        this.pendingEscalate = { kind: 'slow', detail: `avg ${Math.round(avg)}ms > ${budget}ms budget over ${this.opts.slowWindow} passes` };
      }
    }
  }

  /** Bookkeeping for one failed pass; queues an escalation request at the error limit. */
  recordError(e: unknown): void {
    this.consecutiveErrors++;
    this.errorLog = [...this.errorLog, e instanceof Error ? e.message : String(e)].slice(-5);
    if (this.consecutiveErrors >= this.opts.consecutiveErrorLimit) {
      this.pendingEscalate = { kind: 'inference', detail: e instanceof Error ? e.message : String(e) };
    }
  }

  /** Reports and clears the queued escalation request, if any. */
  shouldEscalate(): EscalationRequest | null {
    const p = this.pendingEscalate;
    this.pendingEscalate = null;
    return p;
  }

  /** Abandons the active tier (disposes it), then loads the next working one. Null = exhausted. */
  async escalate(kind: EscalationRequest['kind'], detail: string): Promise<DetectorSelection | null> {
    if (this.index >= 0) {
      this.coolDown(this.index, kind, new Error(detail));
      try {
        this.tiers[this.index].release?.();
      } catch {
        /* disposal failures must never block the switch */
      }
      this.selection = null;
      this.index = -1;
    }
    return this.start();
  }

  private inflight: Promise<DetectorSelection | null> | null = null;

  private adopt(index: number, detector: Detector): void {
    this.index = index;
    this.selection = { detector, tier: this.tiers[index] };
    this.passes = 0;
    this.consecutiveErrors = 0;
    this.recentTimes = [];
    this.pendingEscalate = null;
  }

  private coolDown(index: number, kind: FailureKind, e: unknown): void {
    this.cooldownUntil.set(index, Date.now() + this.opts.cooldownMs);
    this.lastReason = { kind: (kind ?? 'load') as EscalationRequest['kind'], detail: `${this.tiers[index].id}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Breathing room between passes (matches INFERENCE_INTERVAL_MS). */
const PASS_GAP_MS = 100;
