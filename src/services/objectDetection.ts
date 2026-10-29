import { MODEL_URL, YOLO_INPUT_SIZE } from '../constants';
import { DEFAULT_FALLBACK_OPTIONS, DetectorRoster, type DetectorTier, type EscalationRequest, type TierState } from '../utils/detectorFallback';
import { decodeYoloOutputs } from '../utils/yoloDecode';
import { createCocoDetector, loadCocoDetector, releaseCoco } from './cocoDetection';

export type DetectorErrorKind = 'download' | 'offline' | 'unsupported' | 'exhausted';
export class DetectorError extends Error {
  constructor(public kind: DetectorErrorKind, message: string) {
    super(message);
  }
}

/** Core detection fields the raw detectors return; meta is stamped per pass. */
export interface BaseDetection {
  class: string;
  /** Normalized confidence 0..1. */
  score: number;
  /** [x, y, w, h] in source-image pixels. */
  bbox: [number, number, number, number];
}

/** A complete detection: core fields plus which model/backend/when produced it. */
export interface Detection extends BaseDetection {
  /** Wall-clock time of the pass that produced this detection. */
  timestamp: number;
  /** Which model produced it ('yolo26n' or 'coco-ssd'). */
  model: string;
  /** Which inference backend produced it ('webgpu', 'wasm', 'webgl', 'cpu'). */
  backend: string;
}

/** Runs on a frame and returns confident detections in source-image pixels. */
export interface Detector {
  detect(input: HTMLVideoElement | HTMLCanvasElement, maxDetections: number, minScore: number, now?: number): Promise<BaseDetection[]>;
}

let roster: DetectorRoster | null = null;
let preferredYolo: 'webgpu' | 'wasm' = 'webgpu';

const DEV = import.meta.env.DEV;
const ISOLATED = typeof self !== 'undefined' && self.crossOriginIsolated;
const THREADS = ISOLATED ? Math.min(4, typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 1 : 1) : 1;

// ---- Diagnostics accessors -------------------------------------------------

export const getBackendName = (): string => roster?.activeTier()?.backend ?? 'none';
export const getActiveModel = (): string => roster?.activeTier()?.model ?? 'none';
export const getTierId = (): string => roster?.activeTier()?.id ?? 'none';
export const getRecentErrors = (): readonly string[] => roster?.recentErrors() ?? [];
export const getLatency = () => roster?.latency() ?? { avgMs: 0, lastMs: 0, fps: 0 };
export const isDetectorLoaded = (): boolean => roster?.current() !== null;

/** Debug aid: prefer a specific YOLO backend on the next (re)load. */
export function setPreferredBackend(b: 'webgpu' | 'wasm'): void {
  preferredYolo = b;
  resetRoster();
}

export function resetRoster(): void {
  try {
    yoloDispose();
  } catch {
    /* ignore */
  }
  releaseCoco();
  roster = null;
}

// ---- Tier construction -----------------------------------------------------

function buildTiers(): readonly DetectorTier[] {
  const yolo = [yoloTier('webgpu'), yoloTier('wasm')];
  if (preferredYolo === 'wasm') yolo.reverse();
  return [
    ...yolo,
    cocoTier('webgl'),
    cocoTier('cpu'),
  ];
}

function yoloTier(backend: 'webgpu' | 'wasm'): DetectorTier {
  return {
    id: `yolo26n-${backend}`,
    model: 'yolo26n',
    backend,
    // Watchdog budgets grounded in measurement (see report part 7): YOLO26n@640 CPU ONNX runs
    // ~27ms/pass on a desktop core; a phone browser on single-thread wasm realistically lands
    // 300-800ms/pass. Above 3000ms/pass even a lenient 3-in-5 verification would take >30s, so
    // that is the practical ceiling for wasm; WebGPU stays an order faster on every real device.
    budgetMs: backend === 'webgpu' ? 1500 : 3000,
    load: async () => {
      if (backend === 'webgpu' && !('gpu' in navigator)) {
        throw new Error('WebGPU is not exposed by this browser');
      }
      const det = await loadYoloDetector(backend);
      // A real test inference: navigator.gpu may exist while adapter/session creation still fails.
      await det.warmUp();
      return det;
    },
    release: yoloDispose,
  };
}

function cocoTier(backend: 'webgl' | 'cpu'): DetectorTier {
  return {
    id: `coco-ssd-${backend}`,
    model: 'coco-ssd',
    backend,
    // lite_mobilenet_v2 own latency ~5-15ms CPU; phones on plain CPU wasm are a few times slower.
    budgetMs: backend === 'webgl' ? 1200 : 2500,
    load: async () => createCocoDetector(await loadCocoDetector(backend), backend),
    release: releaseCoco,
  };
}

// ---- Public loading + unified detection entry --------------------------------

export interface RosterAwareDetector {
  detect(input: HTMLVideoElement | HTMLCanvasElement, maxDetections: number, minScore: number): Promise<Detection[]>;
  /** Live tier info; changes when a runtime fallback engages. */
  tier(): TierState | null;
  /** Latest escalation diagnosis ('slow', 'inference', 'load' + detail). */
  diagnosis(): EscalationRequest | null;
  /** Earliest moment a failing tier becomes retryable — used to auto-recover after exhaustion. */
  nextRecoverAt(): number | null;
  latency(): { avgMs: number; lastMs: number; fps: number };
  recentErrors(): readonly string[];
}

/**
 * Starts the best available detection tier:
 *   1. YOLO26n/WebGPU   2. YOLO26n/WASM   3. COCO-SSD/WebGL   4. COCO-SSD/CPU
 * Every tier must pass a real test inference before being selected. Throws DetectorError
 * ('exhausted') when every tier failed to load.
 */
export async function loadDetector(): Promise<RosterAwareDetector> {
  if (!roster) roster = new DetectorRoster(buildTiers(), DEFAULT_FALLBACK_OPTIONS);
  const sel = await roster.start();
  if (!sel) {
    throw new DetectorError('exhausted', 'No scanner backend could start on this device.');
  }
  if (DEV) console.info(`[detector] tier=${sel.tier.id} (${sel.tier.backend})`);
  return {
    detect: (input, maxDetections, minScore) => runPass(input, maxDetections, minScore),
    tier: () => roster?.activeTier() ?? null,
    diagnosis: () => roster?.fallbackReason() ?? null,
    nextRecoverAt: () => roster?.nextRecoverAt() ?? null,
    latency: () => roster?.latency() ?? { avgMs: 0, lastMs: 0, fps: 0 },
    recentErrors: () => roster?.recentErrors() ?? [],
  };
}

/** One inference pass with automatic runtime recovery: records latency, escalates failures. */
async function runPass(input: HTMLVideoElement | HTMLCanvasElement, maxDetections: number, minScore: number): Promise<Detection[]> {
  const sel = roster?.current();
  if (!sel) throw new DetectorError('exhausted', 'Detector not loaded.');
  const now = Date.now();
  const t0 = performance.now();
  let detectionList: BaseDetection[];
  try {
    detectionList = await sel.detector.detect(input, maxDetections, minScore, now);
  } catch (e) {
    roster!.recordError(e);
    return await maybeEscalateRetry(input, maxDetections, minScore, now);
  }
  roster!.record(performance.now() - t0);
  const { model, backend } = stamp();
  return detectionList.map((d) => ({ ...d, timestamp: now, model, backend }));
}

/**
 * After a queued escalation request: dispose the broken tier, move to the next one and
 * retry the same frame once on the new tier. Exhausted (every tier cooling down) throws.
 */
async function maybeEscalateRetry(
  input: HTMLVideoElement | HTMLCanvasElement,
  maxDetections: number,
  minScore: number,
  now: number,
): Promise<Detection[]> {
  // Fast path: the error was transient (below the limit) → report as an empty pass.
  const req = roster!.shouldEscalate();
  if (!req) return [];
  for (;;) {
    const next = await roster!.escalate(req.kind, req.detail);
    if (!next) {
      throw new DetectorError('exhausted', 'Every scanner backend has failed. Restart RISE or try again later.');
    }
    if (DEV) console.warn(`[detector] fallback → ${next.tier.id}: ${req.detail}`);
    const t0 = performance.now();
    try {
      const detectionList = await next.detector.detect(input, maxDetections, minScore, now);
      roster!.record(performance.now() - t0);
      const { model, backend } = stamp();
      return detectionList.map((d) => ({ ...d, timestamp: now, model, backend }));
    } catch (e) {
      roster!.recordError(e);
      const req2 = roster!.shouldEscalate();
      if (!req2) return [];
      // Loop continues until a tier works or the roster reports exhaustion.
    }
  }
}

function stamp(): { model: string; backend: string } {
  const tier = roster?.activeTier();
  return { model: tier?.model ?? 'none', backend: tier?.backend ?? 'none' };
}

// ---- YOLO26n implementation (tiers 1–2) --------------------------------------

/** Input size of the bundled ONNX asset (Ultralytics default 640×640 square, static). */
export const YOLO_INPUT_SIZE_EXPORT = YOLO_INPUT_SIZE;

let yoloSession: Awaited<ReturnType<typeof import('onnxruntime-web')['InferenceSession']['create']>> | null = null;

async function loadYoloDetector(backend: 'webgpu' | 'wasm'): Promise<YoloDetector> {
  const ort = await import('onnxruntime-web');
  ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
  // SharedArrayBuffer-backed threads need cross-origin isolation; without it stay single-threaded.
  ort.env.wasm.numThreads = THREADS;
  ort.env.wasm.simd = true;
  if (DEV) console.info(`[detector] wanted=${backend} threads=${THREADS} isolated=${ISOLATED}`);
  if (backend === 'webgpu') {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No usable WebGPU adapter');
    yoloSession = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
  } else {
    yoloSession = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  }
  return new YoloDetector(yoloSession, backend);
}

/** Frees the wasm/WebGPU session; called between tier switches and on full reset. */
export function yoloDispose(): void {
  void yoloSession?.release();
  yoloSession = null;
}

/**
 * YOLO26n wrapper. Preprocessing letterboxes the frame into a square and normalizes RGB into a
 * CHW float32 tensor; postprocessing decodes the end-to-end output rows of
 * [x1, y1, x2, y2, confidence, class_index] and maps boxes back to source pixels. The model's
 * one-to-one head already suppresses duplicates, so there is no runtime NMS pass anywhere.
 */
export class YoloDetector implements Detector {
  private tensor = new Float32Array(1 * 3 * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE);
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private warmed = false;

  constructor(
    private session: NonNullable<typeof yoloSession>,
    readonly backend: 'webgpu' | 'wasm',
  ) {
    this.canvas.width = YOLO_INPUT_SIZE;
    this.canvas.height = YOLO_INPUT_SIZE;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) throw new Error('2D context unavailable (needed for frame preprocessing)');
    this.ctx = ctx;
    if (session.inputNames.length !== 1) throw new Error(`Unexpected model inputs: ${session.inputNames.join(', ')}`);
  }

  /** The first inference pays for lazy kernel compilation; do that before scanning starts. */
  async warmUp(): Promise<void> {
    if (this.warmed) return;
    try {
      this.tensor.fill(0.5);
      await this.run();
    } catch (e) {
      if (DEV) console.warn('[detector] warm-up failed (continuing)', e);
    }
    this.warmed = true;
  }

  async detect(input: HTMLVideoElement | HTMLCanvasElement, maxDetections: number, minScore: number): Promise<BaseDetection[]> {
    const letterbox = this.letterbox(input);
    this.preprocess();
    const raw = await this.run();
    const rows = decodeYoloOutputs(raw, minScore, maxDetections, YOLO_INPUT_SIZE);
    const s = letterbox.scale;
    return rows.map((d) => {
      const [bx1, by1, bx2, by2] = d.box;
      return {
        class: d.class,
        score: d.score,
        bbox: [(bx1 - letterbox.dx) / s, (by1 - letterbox.dy) / s, (bx2 - bx1) / s, (by2 - by1) / s] as [number, number, number, number],
      };
    });
  }

  dispose(): void {
    if (this.session === yoloSession) yoloDispose();
  }

  /** Draws the frame letterboxed (aspect preserved, symmetric padding) into the square canvas. */
  private letterbox(input: HTMLVideoElement | HTMLCanvasElement): { scale: number; dx: number; dy: number } {
    const w = input instanceof HTMLVideoElement ? input.videoWidth : input.width;
    const h = input instanceof HTMLVideoElement ? input.videoHeight : input.height;
    const s = Math.min(YOLO_INPUT_SIZE / w, YOLO_INPUT_SIZE / h);
    const dx = (YOLO_INPUT_SIZE - w * s) / 2;
    const dy = (YOLO_INPUT_SIZE - h * s) / 2;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE);
    this.ctx.drawImage(input, dx, dy, w * s, h * s);
    return { scale: s, dx, dy };
  }

  /** 640×640 RGBA canvas pixels → normalized CHW float32 RGB tensor (single row scan). */
  private preprocess(): void {
    const data = this.ctx.getImageData(0, 0, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE).data;
    const plane = YOLO_INPUT_SIZE * YOLO_INPUT_SIZE;
    const t = this.tensor;
    const r = 0;
    const g = plane;
    const b = plane * 2;
    for (let i = 0, p = 0; p < plane; i += 4, p++) {
      t[r + p] = data[i]! / 255;
      t[g + p] = data[i + 1]! / 255;
      t[b + p] = data[i + 2]! / 255;
    }
  }

  private async run(): Promise<Float32Array> {
    const ort = await import('onnxruntime-web');
    const t = new ort.Tensor('float32', this.tensor, [1, 3, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE]);
    const results = await this.session.run({ [this.session.inputNames[0]!]: t });
    return results[this.session.outputNames[0]!]!.data as Float32Array;
  }
}
