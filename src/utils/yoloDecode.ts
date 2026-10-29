// COCO-SSD and YOLO26 share the 80-class COCO label list and its canonical order.
// The ONNX end-to-end output references classes by index into this array.
export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
  'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat',
  'dog', 'horse', 'sheep', 'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack',
  'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
  'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
  'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote',
  'keyboard', 'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book',
  'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
] as const;

export interface RawDetection {
  class: string;
  score: number;
  /** x1, y1, x2, y2 in model-input pixel space. */
  box: [number, number, number, number];
}

/**
 * Decodes YOLO26's end-to-end detection output: [batch, 300, 6] rows of
 * [x1, y1, x2, y2, confidence, class_index]. The model's one-to-one head has
 * already suppressed duplicates, so decoding is plain filtering — no runtime NMS.
 */
export function decodeYoloOutputs(
  data: Float32Array,
  minScore: number,
  maxDetections: number,
  inputSize = 640,
): RawDetection[] {
  const rows = data.length / 6;
  const maxXY = maxCoordinate(data, inputSize);
  // Some exports emit normalized coordinates; detect and normalize to input pixels.
  const toPx = maxXY <= 1.5 ? inputSize : 1;
  const out: RawDetection[] = [];
  for (let i = 0; i < rows; i++) {
    const o = i * 6;
    const score = data[o + 4];
    if (score < minScore) continue;
    const cls = data[o + 5];
    const classIndex = Math.round(cls);
    if (classIndex < 0 || classIndex >= COCO_CLASSES.length) continue;
    let x1 = data[o] * toPx;
    let y1 = data[o + 1] * toPx;
    let x2 = data[o + 2] * toPx;
    let y2 = data[o + 3] * toPx;
    // Clip and guard against degenerate boxes.
    x1 = Math.max(0, Math.min(x1, x2, inputSize));
    y1 = Math.max(0, Math.min(y1, y2, inputSize));
    x2 = Math.max(x1, Math.min(x2, inputSize));
    y2 = Math.max(y1, Math.min(y2, inputSize));
    if (x2 - x1 < 1 || y2 - y1 < 1) continue;
    out.push({ class: COCO_CLASSES[classIndex], score, box: [x1, y1, x2, y2] });
  }
  if (out.length > maxDetections) out.length = maxDetections;
  return out;
}

function maxCoordinate(data: Float32Array, cap: number): number {
  let m = 0;
  for (let o = 0; o < data.length; o += 6) {
    if (data[o] > m) m = data[o];
    if (data[o + 2] > m) m = data[o + 2];
    if (data[o + 1] > m) m = data[o + 1];
    if (data[o + 3] > m) m = data[o + 3];
  }
  void cap;
  return m;
}
