import type { ObjectDetection } from '@tensorflow-models/coco-ssd';
import { COCO_MODEL_URL } from '../constants';
import type { BaseDetection, DetectorErrorKind } from './objectDetection';

export class DetectorError extends Error {
  constructor(public kind: DetectorErrorKind, message: string) {
    super(message);
  }
}

let loading: Promise<ObjectDetection> | null = null;
let loaded: ObjectDetection | null = null;

export const isCocoLoaded = (): boolean => loaded !== null;
export const releaseCoco = (): void => {
  loaded = null;
  loading = null;
};

/** Which TF.js backend to initialize ('webgl' tier 3, 'cpu' tier 4). */
export function loadCocoDetector(preferred: 'webgl' | 'cpu'): Promise<ObjectDetection> {
  if (loaded) return Promise.resolve(loaded);
  if (loading) return loading;
  loading = (async () => {
    try {
      const [tf, cocoSsd] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/coco-ssd')]);
      let used = false;
      try {
        used = preferred === 'webgl' && (await tf.setBackend('webgl')); // resolves false (not throws) on init failure
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[coco] WebGL backend threw', e);
      }
      if (!used) await tf.setBackend('cpu');
      await tf.ready();
      if (import.meta.env.DEV) console.info(`[coco] backend=${tf.getBackend()}`);
      loaded = await cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: COCO_MODEL_URL });
      return loaded;
    } catch (e) {
      console.error('[coco] load failed', e);
      loading = null;
      const offline = navigator.onLine === false;
      throw new DetectorError(
        offline ? 'offline' : 'download',
        offline ? 'The fallback scanner model is not available offline yet.' : `The fallback scanner model failed to load${e instanceof Error ? ` (${e.message})` : ''}.`,
      );
    }
  })();
  return loading;
}

/** Adapts COCO-SSD's asynchronous detection API to the shared Detector interface. */
export function createCocoDetector(model: ObjectDetection, backend: string) {
  return {
    backend,
    detect: async (input: HTMLVideoElement | HTMLCanvasElement, maxDetections: number, minScore: number): Promise<BaseDetection[]> => {
      const preds = await model.detect(input, maxDetections, minScore);
      return preds.map((p) => ({
        class: p.class,
        score: p.score,
        bbox: [p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]] as [number, number, number, number],
      }));
    },
  };
}
