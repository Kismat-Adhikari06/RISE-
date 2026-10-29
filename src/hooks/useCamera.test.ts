import { describe, expect, it } from 'vitest';
import { classify } from './useCamera';

const domErr = (name: string) => new DOMException(name, name);

describe('useCamera error classification', () => {
  it('classifies permission denial', () => {
    expect(classify(domErr('NotAllowedError')).kind).toBe('denied');
    expect(classify(domErr('SecurityError')).kind).toBe('denied');
    expect(classify(domErr('PermissionDeniedError')).kind).toBe('denied');
  });

  it('classifies camera interruptions / busy camera', () => {
    // NotReadableError = camera held by another app; AbortError covers abrupt stream loss.
    expect(classify(domErr('NotReadableError')).kind).toBe('busy');
    expect(classify(domErr('AbortError')).kind).toBe('busy');
    expect(classify(domErr('TrackStartError')).kind).toBe('busy');
  });

  it('classifies missing hardware and unknown failures', () => {
    expect(classify(domErr('NotFoundError')).kind).toBe('unavailable');
    expect(classify(domErr('OverconstrainedError')).kind).toBe('unavailable');
    expect(classify(new Error('something else')).kind).toBe('unknown');
  });

  it('every kind has a user-facing message', () => {
    for (const e of [domErr('NotAllowedError'), domErr('NotReadableError'), domErr('NotFoundError'), new Error('x')]) {
      expect(classify(e).message.length).toBeGreaterThan(0);
    }
  });
});
