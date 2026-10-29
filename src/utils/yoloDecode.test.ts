import { describe, expect, it } from 'vitest';
import { decodeYoloOutputs } from './yoloDecode';

const row = (x1: number, y1: number, x2: number, y2: number, score: number, cls: number) => [x1, y1, x2, y2, score, cls];

describe('decodeYoloOutputs (YOLO26 end-to-end [1,300,6])', () => {
  it('decodes pixel-space rows above minScore and drops the rest', () => {
    const data = new Float32Array([...row(10, 20, 110, 220, 0.8, 40), ...row(0, 0, 5, 5, 0.1, 40)]);
    const dets = decodeYoloOutputs(data, 0.35, 20, 640);
    expect(dets).toHaveLength(1);
    expect(dets[0].class).toBe('wine glass'); // COCO index 40
    expect(dets[0].score).toBeCloseTo(0.8);
    expect(dets[0].box).toEqual([10, 20, 110, 220]);
  });

  it('converts normalized coordinates to input pixels', () => {
    const data = new Float32Array([...row(0.1, 0.2, 0.5, 0.6, 0.9, 41)]);
    const [d] = decodeYoloOutputs(data, 0.35, 20, 640);
    expect(d.class).toBe('cup');
    expect(d.box[0]).toBeCloseTo(64);
    expect(d.box[3]).toBeCloseTo(384);
  });

  it('caps detections at maxDetections', () => {
    const data = new Float32Array(Array.from({ length: 10 }, (_, i) => row(0, 0, 50, 50, 0.5, 4 + i)).flat());
    expect(decodeYoloOutputs(data, 0.35, 3, 640)).toHaveLength(3);
  });

  it('clips and rejects degenerate boxes', () => {
    const data = new Float32Array([...row(-50, -50, 700, 700, 0.9, 55), ...row(5, 5, 5, 5, 0.9, 55)]);
    expect(decodeYoloOutputs(data, 0.35, 20, 640)).toHaveLength(1);
    expect(decodeYoloOutputs(data, 0.35, 20, 640)[0].box).toEqual([0, 0, 640, 640]);
  });

  it('ignores out-of-range class indices', () => {
    const data = new Float32Array([...row(10, 10, 100, 100, 0.9, 80)]);
    expect(decodeYoloOutputs(data, 0.35, 20, 640)).toHaveLength(0);
  });
});
