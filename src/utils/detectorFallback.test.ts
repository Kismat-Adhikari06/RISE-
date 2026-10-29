import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FALLBACK_OPTIONS, DetectorRoster, type DetectorTier } from './detectorFallback';
import type { BaseDetection, Detector } from '../services/objectDetection';

const emptyDetector = (): Detector => ({
  detect: async (): Promise<BaseDetection[]> => [],
});

const tier = (id: string, opts: { failLoad?: Error; detector?: Detector; onRelease?: () => void; budgetMs?: number } = {}): DetectorTier => ({
  id,
  model: id.split('-')[0],
  backend: id.split('-')[1] ?? 'cpu',
  budgetMs: opts.budgetMs,
  load: vi.fn(async () => {
    if (opts.failLoad) throw opts.failLoad;
    return opts.detector ?? emptyDetector();
  }),
  release: opts.onRelease,
});

const fastOpts = { ...DEFAULT_FALLBACK_OPTIONS, slowMs: 100, slowWindow: 2, cooldownMs: 1000, consecutiveErrorLimit: 2 };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DetectorRoster (fallback policy)', () => {
  it('starts with the first tier when it works', async () => {
    const t0 = tier('yolo-webgpu', { detector: emptyDetector() });
    const r = new DetectorRoster([t0]);
    const sel = await r.start();
    expect(sel?.tier.id).toBe('yolo-webgpu');
    expect(r.activeTier()?.id).toBe('yolo-webgpu');
  });

  it('skips WebGPU when load fails (not exposed / init error) and uses WASM', async () => {
    const t0 = tier('yolo-webgpu', { failLoad: new Error('No usable WebGPU adapter') });
    const t1 = tier('yolo-wasm');
    const r = new DetectorRoster([t0, t1]);
    const sel = await r.start();
    expect(sel?.tier.id).toBe('yolo-wasm');
    expect(r.fallbackReason()?.kind).toBe('load');
    expect(r.fallbackReason()?.detail).toContain('yolo-webgpu');
  });

  it('falls through YOLO WASM into COCO-SSD', async () => {
    const r = new DetectorRoster([tier('yolo-webgpu', { failLoad: new Error('no gpu') }), tier('yolo-wasm', { failLoad: new Error('o.w.m.') }), tier('coco-webgl')]);
    expect((await r.start())?.tier.id).toBe('coco-webgl');
  });

  it('loads the last tier (COCO-SSD CPU) when every earlier one fails', async () => {
    const r = new DetectorRoster([tier('yolo-webgpu', { failLoad: new Error('x') }), tier('yolo-wasm', { failLoad: new Error('x') }), tier('coco-webgl', { failLoad: new Error('x') }), tier('coco-cpu')]);
    expect((await r.start())?.tier.id).toBe('coco-cpu');
  });

  it('returns null (total failure) when no tier can load', async () => {
    const r = new DetectorRoster([tier('yolo-webgpu', { failLoad: new Error('x') }), tier('coco-cpu', { failLoad: new Error('x') })]);
    expect(await r.start()).toBeNull();
  });

  it('loads each failing tier only ONCE even under concurrent start() calls (no duplicate sessions)', async () => {
    const slowLoad = tier('yolo-webgpu', { failLoad: new Error('no gpu') });
    const ok = tier('coco-cpu');
    const r = new DetectorRoster([slowLoad, ok]);
    // Three concurrent entry points replay a UI restart-race.
    const [a, b, c] = await Promise.all([r.start(), r.start(), r.start()]);
    expect(a?.tier.id).toBe('coco-cpu');
    expect(b?.tier.id).toBe(a?.tier.id);
    expect(c?.tier.id).toBe(a?.tier.id);
    expect(slowLoad.load).toHaveBeenCalledTimes(1);
    expect(ok.load).toHaveBeenCalledTimes(1);
  });

  it('escalates on repeated inference failures (GPU device loss) and releases the broken tier', async () => {
    let broken = true;
    const bad = tier('yolo-webgpu', {
      detector: {
        detect: async () => {
          if (broken) throw new Error('WebGPU device lost');
          return [];
        },
      } as Detector,
    });
    const good = tier('yolo-wasm');
    const released = vi.fn();

    const r = new DetectorRoster([{ ...bad, release: released }, good], fastOpts);
    await r.start();
    r.recordError(new Error('WebGPU device lost'));
    expect(r.shouldEscalate()).toBeNull(); // 1st failure is tolerated (transient)
    r.recordError(new Error('WebGPU device lost'));
    const req = r.shouldEscalate();
    expect(req?.kind).toBe('inference');
    const next = await r.escalate(req!.kind, req!.detail);
    expect(next?.tier.id).toBe('yolo-wasm');
    expect(released).toHaveBeenCalledTimes(1);
    expect(r.recentErrors().join(' ')).toContain('device lost');
    expect(r.fallbackReason()?.kind).toBe('inference');
    broken = false;
  });

  it('escalates when the watchdog sees consistently slow inference', async () => {
    const r = new DetectorRoster([tier('yolo-webgpu'), tier('yolo-wasm')], fastOpts);
    await r.start();
    r.record(5000);
    r.record(5000);
    const req = r.shouldEscalate();
    expect(req?.kind).toBe('slow');
    expect((await r.escalate(req!.kind, req!.detail))?.tier.id).toBe('yolo-wasm');
  });

  it('applies the TIER-SPECIFIC budget, not the global default', async () => {
    const r = new DetectorRoster([tier('yolo-wasm', { budgetMs: 6000 })], fastOpts);
    await r.start();
    r.record(3000);
    r.record(3000); // avg 3000: above global slowMs(100) but inside this CPU tier's 6000 budget
    expect(r.shouldEscalate()).toBeNull();
    r.record(3000); // watchdog window has passed (passes > slowWindow) — still no escalation
    expect(r.shouldEscalate()).toBeNull();
  });

  it('does NOT escalate when inference is fast', async () => {
    const r = new DetectorRoster([tier('yolo-webgpu')], fastOpts);
    await r.start();
    r.record(20);
    r.record(20);
    expect(r.shouldEscalate()).toBeNull();
  });

  it('puts failed tiers on cooldown so loops are impossible, then recovers after expiry', async () => {
    const r = new DetectorRoster([tier('yolo-webgpu', { failLoad: new Error('x') }), tier('yolo-wasm', { failLoad: new Error('x') })], { ...DEFAULT_FALLBACK_OPTIONS, cooldownMs: 10_000 });
    expect(await r.start()).toBeNull();
    expect(r.fallbackReason()?.detail).toContain('yolo-wasm');
    // The roster reports the earliest retry moment so callers can auto-recover instead of polling blindly.
    expect(r.nextRecoverAt()).not.toBeNull();
    // Immediately after expiry, the roster can again try (and fail) — no infinite switch loop.
    vi.advanceTimersByTime(10_001);
    expect(r.nextRecoverAt()).toBeNull();
    expect(await r.start()).toBeNull();
  });

  it('latency stats reflect recorded passes', async () => {
    const r = new DetectorRoster([tier('yolo-webgpu')], fastOpts);
    await r.start();
    r.record(50);
    r.record(150);
    const l = r.latency();
    expect(l.avgMs).toBe(100);
    expect(l.lastMs).toBe(150);
    expect(l.fps).toBe(4); // 1000 / (150 + 50 gap)
  });
});
