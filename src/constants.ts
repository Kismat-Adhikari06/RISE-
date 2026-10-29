import type { MathConfig, SoundId, Settings } from './types';

export const APP_VERSION = '1.0.0';

/** Minimum confidence for a detection to count. Calibrated: the YOLO26n fires cup ≥ ~0.55 when the
 *  object fills a good part of the camera frame, so 0.30 still accepts marginal near-shots while
 *  ignoring off-target flicker (typical non-matching scores sit at 0.10–0.15). */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.30;

/* Speed: scan-verification latency after the object is in frame is
 *   required_frames × (inference_ms + INTERVAL),
 * so we confirm as fast as consumer apps do — 2 hits instead of 3, and minimal sleep. */
/** Successful inferences (within the window below) required to confirm an object. */
export const CONFIRMATION_FRAMES = 2;
/** Sliding window of recent inferences in which CONFIRMATION_FRAMES hits must occur (tolerates flicker). */
export const CONFIRMATION_WINDOW = 3;
/** Delay between inference runs (ms). Detection passes never overlap; this is a small stagger
 *  that leaves the camera breathing room and keeps the UI responsive between passes. */
export const INFERENCE_INTERVAL_MS = 30;
/** Lowest score the detector reports at all. Used for the debug panel; acceptance uses the threshold above. */
export const DEBUG_MIN_SCORE = 0.15;
/** After this long in the scanner with no hit, a "move closer" hint appears. */
export const SCANNER_CLOSER_HINT_AFTER_MS = 12_000;
/** After this long in the scanner, a confirmed "having trouble" link appears. */
export const SCANNER_HELP_AFTER_MS = 30_000;
/** Alarms that became due more than this long ago are recorded as missed instead of ringing. */
export const MISSED_GRACE_MS = 10 * 60_000;
export const EMERGENCY_QUESTION_COUNT = 5;
/** Temporary testing aid: shows a "Stop alarm" button on the ringing screen that skips all missions. Set to false to enforce missions. */
export const ALLOW_SKIP_MISSIONS = true;


export const MODEL_URL = `${import.meta.env.BASE_URL}models/yolo26n/model.onnx`;
/** Square input of the YOLO26n ONNX asset (px). */
export const YOLO_INPUT_SIZE = 640;
/** Legacy COCO-SSD model, kept as the deep fallback (tiers 3/4). */
export const COCO_MODEL_URL = `${import.meta.env.BASE_URL}models/coco-ssd/model.json`;

export interface ObjectOption {
  cocoClass: string;
  label: string;
  icon: string; // key into icon map
}
/** Every cocoClass below exists in the COCO-SSD 80-class label set. */
export const OBJECT_OPTIONS: ObjectOption[] = [
  { cocoClass: 'cup', label: 'Cup', icon: 'cup' },
  { cocoClass: 'bottle', label: 'Bottle', icon: 'bottle' },
  { cocoClass: 'chair', label: 'Chair', icon: 'chair' },
  { cocoClass: 'book', label: 'Book', icon: 'book' },
  { cocoClass: 'toothbrush', label: 'Toothbrush', icon: 'toothbrush' },
  { cocoClass: 'bowl', label: 'Bowl', icon: 'bowl' },
  { cocoClass: 'spoon', label: 'Spoon', icon: 'spoon' },
  { cocoClass: 'backpack', label: 'Backpack', icon: 'backpack' },
  { cocoClass: 'laptop', label: 'Laptop', icon: 'laptop' },
  { cocoClass: 'cell phone', label: 'Cell phone', icon: 'phone' },
  { cocoClass: 'remote', label: 'Remote', icon: 'remote' },
  { cocoClass: 'potted plant', label: 'Potted plant', icon: 'plant' },
  { cocoClass: 'bed', label: 'Bed', icon: 'bed' },
  { cocoClass: 'clock', label: 'Clock', icon: 'clock' },
];

export const objectLabel = (cocoClass: string): string =>
  OBJECT_OPTIONS.find((o) => o.cocoClass === cocoClass)?.label ?? cocoClass;

export const SOUNDS: { id: SoundId; name: string; description: string }[] = [
  { id: 'sunrise', name: 'Sunrise', description: 'Warm rising chimes' },
  { id: 'digital', name: 'Digital', description: 'Crisp electronic beeps' },
  { id: 'pulse', name: 'Pulse', description: 'Deep throbbing tone' },
  { id: 'classic', name: 'Classic', description: 'Old-school bell' },
  { id: 'urgent', name: 'Urgent', description: 'Rising siren' },
];

export const MATH_QUESTION_COUNTS: MathConfig['questionCount'][] = [1, 3, 5, 10];

export const DEFAULT_SETTINGS: Settings = {
  timeFormat: '12',
  defaultSound: 'sunrise',
  defaultSnooze: 5,
  defaultMathDifficulty: 'medium',
  theme: 'dark',
  vibrationEnabled: true,
  alarmVolume: 0.8,
  missionVolumeRatio: 0.35,
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
