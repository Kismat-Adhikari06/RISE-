import { describe, expect, it } from 'vitest';
import type { Alarm, ChallengeConfig } from '../types';
import { computeNextOccurrence, describeRepeat } from './alarmRecurrence';
import { ConfirmationTracker, normalizeClass } from './detectionTracker';
import { computeInsights } from './insights';
import { generateQuestions } from './mathGenerator';
import * as m from './sessionMachine';
import { parseImport, sanitizeAlarm } from './validation';
import { to12h, to24h } from './dateTime';
import { OBJECT_OPTIONS } from '../constants';

const evalExpr = (t: string) => Function(`"use strict";return (${t.replace(/×/g, '*').replace(/÷/g, '/')})`)() as number;

describe('math generator', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    it(`${d}: every answer is correct, integer, and questions are distinct`, () => {
      for (let run = 0; run < 200; run++) {
        const qs = generateQuestions(d, 10);
        expect(new Set(qs.map((q) => q.text)).size).toBe(10);
        for (const q of qs) {
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(evalExpr(q.text)).toBe(q.answer);
          if (d !== 'hard') expect(q.answer).toBeGreaterThanOrEqual(0);
        }
      }
    });
  }
});

describe('recurrence', () => {
  const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo, d, h, mi).getTime();
  it('one-time: later today, else tomorrow', () => {
    const a = { hour: 5, minute: 0, repeatDays: [] };
    expect(computeNextOccurrence(a, at(2026, 9, 29, 0, 48))).toBe(at(2026, 9, 29, 5, 0));
    expect(computeNextOccurrence(a, at(2026, 9, 29, 5, 0))).toBe(at(2026, 9, 30, 5, 0)); // strictly after
    expect(computeNextOccurrence(a, at(2026, 9, 29, 18, 0))).toBe(at(2026, 9, 30, 5, 0));
  });
  it('weekday alarm skips the weekend', () => {
    const a = { hour: 7, minute: 30, repeatDays: [1, 2, 3, 4, 5] as Alarm['repeatDays'] };
    const fri = at(2026, 9, 30, 8, 0); // Fri Oct 30 2026
    expect(new Date(fri).getDay()).toBe(5);
    expect(computeNextOccurrence(a, fri)).toBe(at(2026, 10, 2, 7, 30)); // Monday
  });
  it('midnight and noon', () => {
    expect(to12h(0)).toEqual({ hour12: 12, pm: false });
    expect(to12h(12)).toEqual({ hour12: 12, pm: true });
    expect(to24h(12, false)).toBe(0);
    expect(to24h(12, true)).toBe(12);
    for (let h = 0; h < 24; h++) expect(to24h(to12h(h).hour12, to12h(h).pm)).toBe(h);
  });
  it('describes repeat', () => {
    expect(describeRepeat([])).toBe('Once');
    expect(describeRepeat([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(describeRepeat([6, 0])).toBe('Weekends');
    expect(describeRepeat([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
  });
});

const mathC: ChallengeConfig = { id: 'm', type: 'math', enabled: true, config: { difficulty: 'easy', questionCount: 3 } };
const objC: ChallengeConfig = { id: 'o', type: 'object', enabled: true, config: { targetClass: 'cup', confidenceThreshold: 0.6 } };
const mk = (challenges: ChallengeConfig[], snoozeMinutes: 0 | 5 = 5) =>
  m.createSession({ id: 'a', label: 'x', soundId: 'sunrise', snoozeMinutes, challenges }, 1000, 1000);

function solveAllMath(s: ReturnType<typeof mk>, id = 'm') {
  let cur = s;
  const mission = () => cur.missions.find((x) => x.challengeId === id)!;
  while (mission().math!.index < mission().math!.questions.length) cur = m.advanceMath(cur, id, mission().math!.index);
  return cur;
}

describe('session state machine', () => {
  it('math + object: math completion does not finish the alarm', () => {
    let s = m.startMissions(mk([mathC, objC]));
    expect(s.status).toBe('CHALLENGE_ACTIVE');
    expect(m.activeMission(s)?.challengeId).toBe('m');
    s = m.completeMission(s, 'm', 2000); // premature: questions not solved
    expect(s.missions[0].status).toBe('ACTIVE');
    s = solveAllMath(s);
    s = m.completeMission(s, 'm', 3000);
    expect(s.status).toBe('CHALLENGE_ACTIVE');
    expect(s.missions[0].status).toBe('COMPLETED');
    expect(m.activeMission(s)?.challengeId).toBe('o');
    s = m.completeMission(s, 'o', 4000);
    expect(s.status).toBe('COMPLETED');
    expect(s.completedAt).toBe(4000);
    expect(s.mathSolved).toBe(3);
    expect(s.objectScans).toBe(1);
  });
  it('object cannot complete before math is done (order enforced)', () => {
    let s = m.startMissions(mk([mathC, objC]));
    const before = s;
    s = m.completeMission(s, 'o', 2000);
    expect(s).toBe(before);
  });
  it('duplicate events are ignored', () => {
    let s = m.startMissions(mk([mathC]));
    s = m.advanceMath(s, 'm', 0);
    const again = m.advanceMath(s, 'm', 0); // stale index
    expect(again).toBe(s);
    expect(s.mathSolved).toBe(1);
    s = solveAllMath(s);
    s = m.completeMission(s, 'm', 5);
    expect(m.completeMission(s, 'm', 6)).toBe(s);
  });
  it('challenge alarms cannot be plain-dismissed; plain alarms can', () => {
    const s = mk([mathC]);
    expect(m.dismiss(s, 5)).toBe(s);
    const plain = mk([]);
    expect(m.dismiss(plain, 5).status).toBe('COMPLETED');
    expect(m.startMissions(plain)).toBe(plain);
  });
  it('snooze resets progress and completes nothing', () => {
    let s = m.startMissions(mk([mathC, objC]));
    s = solveAllMath(s);
    s = m.completeMission(s, 'm', 2000);
    s = m.snooze(s, 3000);
    expect(s.status).toBe('SNOOZED');
    expect(s.snoozeUntil).toBe(3000 + 5 * 60_000);
    expect(s.missions.every((x) => x.status === 'PENDING')).toBe(true);
    s = m.resumeFromSnooze(s);
    expect(s.status).toBe('RINGING');
  });
  it('snooze disabled does nothing', () => {
    const s = mk([mathC], 0);
    expect(m.snooze(s, 1)).toBe(s);
  });
  it('emergency fallback must be solved before the scan mission completes', () => {
    let s = m.startMissions(mk([objC]));
    s = m.useEmergency(s, 'o');
    expect(s.emergencyUsed).toBe(true);
    expect(m.completeMission(s, 'o', 9)).toBe(s);
    const mission = () => s.missions[0];
    while (mission().emergency!.index < mission().emergency!.questions.length) s = m.advanceMath(s, 'o', mission().emergency!.index, true);
    s = m.completeMission(s, 'o', 10);
    expect(s.status).toBe('COMPLETED');
    expect(s.objectScans).toBe(0);
  });
});

describe('detection confirmation', () => {
  it('normalizes class names', () => {
    expect(normalizeClass('  Cup ')).toBe('cup');
    const t = new ConfirmationTracker('Cup', 0.35, 3, 5);
    t.update([{ class: 'cup', score: 0.4 }]); t.update([{ class: 'cup', score: 0.4 }]);
    expect(t.update([{ class: ' CUP', score: 0.36 }]).confirmed).toBe(true);
  });
  const cup = { class: 'cup', score: 0.9 };
  it('needs 3 hits within the last 5 passes; tolerates flicker', () => {
    const t = new ConfirmationTracker('cup', 0.5, 3, 5);
    expect(t.update([cup]).confirmed).toBe(false);
    expect(t.update([]).confirmed).toBe(false);
    expect(t.update([cup]).confirmed).toBe(false);
    expect(t.update([{ class: 'cup', score: 0.49 }]).confirmed).toBe(false); // below threshold
    expect(t.update([cup]).confirmed).toBe(true);
  });
  it('old hits fall out of the window', () => {
    const t = new ConfirmationTracker('cup', 0.5, 3, 5);
    t.update([cup]); t.update([cup]);
    for (let i = 0; i < 4; i++) t.update([]);
    expect(t.update([cup]).confirmed).toBe(false);
  });
  it('a bottle never confirms a cup', () => {
    const t = new ConfirmationTracker('cup', 0.5, 3, 5);
    for (let i = 0; i < 20; i++) expect(t.update([{ class: 'bottle', score: 0.99 }]).confirmed).toBe(false);
  });
  it('counts each FRAME once, no matter how many boxes it contains', () => {
    const t = new ConfirmationTracker('cup', 0.5, 3, 5);
    // One frame reporting the same object thrice (e.g. pre-dedup candidates) is ONE pass:
    // it must not give 3/5 hits toward confirmation.
    const triple = [cup, cup, cup];
    expect(t.update(triple).streak).toBe(1);
    expect(t.update(triple).streak).toBe(2);
    expect(t.update(triple).confirmed).toBe(true); // 3rd pass -> 3-of-5 reached, but only ONE hit came from each frame
    expect(t.update(triple).confirmed).toBe(true); // 4th pass, still exactly 3 hits in the last 5
  });
});

describe('insights', () => {
  const done = (day: number, dur = 60_000, isTest = false) => {
    const s = m.createSession({ id: 'a', label: 'x', soundId: 'sunrise', snoozeMinutes: 5, challenges: [mathC] }, 0, new Date(2026, 9, day, 6).getTime(), isTest);
    return { ...s, status: 'COMPLETED' as const, completedAt: s.triggeredAt + dur, mathSolved: 3 };
  };
  const now = new Date(2026, 9, 29, 12).getTime();
  it('counts streak, ignores tests', () => {
    const i = computeInsights([done(29), done(28), done(27), done(25), done(29, 1, true)], now);
    expect(i.total).toBe(4);
    expect(i.streak).toBe(3);
    expect(i.mathSolved).toBe(12);
    expect(i.avgDismissMs).toBe(60_000);
    expect(i.week[6].count).toBe(1);
  });
  it('empty history', () => {
    const i = computeInsights([], now);
    expect(i).toMatchObject({ total: 0, streak: 0, avgDismissMs: null });
  });
});

describe('validation & constants', () => {
  it('rejects bad alarms and sanitizes good ones', () => {
    expect(sanitizeAlarm({ hour: 25, minute: 0 })).toBeNull();
    const a = sanitizeAlarm({ hour: 5, minute: 0, label: 'x', repeatDays: [1, 9, 1], challenges: [{ type: 'object', config: { targetClass: 'unicorn' } }, { type: 'math', config: { difficulty: 'bogus', questionCount: 7 } }] });
    expect(a?.repeatDays).toEqual([1]);
    expect(a?.challenges).toHaveLength(1);
    expect(a?.challenges[0].config).toEqual({ difficulty: 'medium', questionCount: 3 });
  });
  it('import validates', () => {
    expect(() => parseImport('nope')).toThrow();
    expect(() => parseImport('{"app":"x"}')).toThrow();
    expect(parseImport(JSON.stringify({ app: 'rise', alarms: [{ hour: 1, minute: 2 }, { hour: 99 }] })).alarms).toHaveLength(1);
  });
  it('object options are real COCO-SSD classes', () => {
    const coco = new Set(['person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush']);
    for (const o of OBJECT_OPTIONS) expect(coco.has(o.cocoClass)).toBe(true);
  });
});
