import { ArrowDownUp, Brain, Check, Pause, Play, ScanLine, Trash2, Volume2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, useSyncExternalStore } from 'react';
import { TimePicker } from '../components/alarms/TimePicker';
import { missionSummary } from '../components/challenges/ChallengeChips';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Dialog';
import { ObjectIcon } from '../components/ui/ObjectIcon';
import { Card, Section } from '../components/ui/Section';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Segmented } from '../components/ui/Segmented';
import { Toggle } from '../components/ui/Toggle';
import { DEFAULT_CONFIDENCE_THRESHOLD, MATH_QUESTION_COUNTS, OBJECT_OPTIONS, SOUNDS, objectLabel } from '../constants';
import { audioEngine } from '../services/audioEngine';
import { useAlarmStore } from '../stores/alarmStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import type { Alarm, ChallengeConfig, MathConfig, ObjectScanConfig, SnoozeMinutes, SoundId, Weekday } from '../types';
import { ALL_DAYS, WEEKDAYS, WEEKENDS, computeNextOccurrence, sameDays } from '../utils/alarmRecurrence';
import { describeDay, formatCountdown, formatTimestamp } from '../utils/dateTime';
import { uid } from '../utils/id';
import { WEEKDAY_SHORT } from '../constants';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function AlarmEditorPage({ alarmId }: { alarmId: string | null }) {
  const existing = useAlarmStore((s) => s.alarms.find((a) => a.id === alarmId));
  const save = useAlarmStore((s) => s.save);
  const remove = useAlarmStore((s) => s.remove);
  const settings = useSettingsStore((s) => s.settings);
  const { close, open, toast } = useUIStore();

  const initMath = existing?.challenges.find((c) => c.type === 'math');
  const initObj = existing?.challenges.find((c) => c.type === 'object');

  const [hour, setHour] = useState(existing?.hour ?? 7);
  const [minute, setMinute] = useState(existing?.minute ?? 0);
  const [label, setLabel] = useState(existing?.label ?? '');
  const [days, setDays] = useState<Weekday[]>(existing?.repeatDays ?? []);
  const [soundId, setSoundId] = useState<SoundId>(existing?.soundId ?? settings.defaultSound);
  const [snooze, setSnooze] = useState<SnoozeMinutes>(existing?.snoozeMinutes ?? settings.defaultSnooze);
  const [mathOn, setMathOn] = useState(!!initMath?.enabled);
  const [math, setMath] = useState<MathConfig>(
    (initMath?.config as MathConfig | undefined) ?? { difficulty: settings.defaultMathDifficulty, questionCount: 3 },
  );
  const [objOn, setObjOn] = useState(!!initObj?.enabled);
  const [obj, setObj] = useState<ObjectScanConfig>(
    (initObj?.config as ObjectScanConfig | undefined) ?? { targetClass: 'cup', confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD },
  );
  const [objectFirst, setObjectFirst] = useState(
    !!existing && existing.challenges.findIndex((c) => c.type === 'object') >= 0 &&
      (existing.challenges.findIndex((c) => c.type === 'object') < existing.challenges.findIndex((c) => c.type === 'math') ||
        existing.challenges.findIndex((c) => c.type === 'math') < 0) &&
      existing.challenges.length > 1,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const previewing = useSyncExternalStore((cb) => audioEngine.subscribe(cb), () => audioEngine.playing);

  const buildChallenges = (): ChallengeConfig[] => {
    const list: ChallengeConfig[] = [];
    if (mathOn) list.push({ id: initMath?.id ?? uid(), type: 'math', enabled: true, config: math });
    if (objOn) list.push({ id: initObj?.id ?? uid(), type: 'object', enabled: true, config: obj });
    return objectFirst ? list.reverse() : list;
  };
  const challenges = buildChallenges();

  const toggleDay = (d: Weekday) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort() as Weekday[]));
  const shortcuts: { label: string; days: Weekday[] }[] = [
    { label: 'Once', days: [] },
    { label: 'Every day', days: ALL_DAYS },
    { label: 'Weekdays', days: WEEKDAYS },
    { label: 'Weekends', days: WEEKENDS },
  ];

  const onSave = async () => {
    audioEngine.stop(0.05);
    const now = Date.now();
    const alarm: Alarm = {
      id: existing?.id ?? uid(),
      hour,
      minute,
      label: label.trim() || 'Wake up',
      enabled: true,
      repeatDays: days,
      soundId,
      snoozeMinutes: snooze,
      challenges,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      nextOccurrence: null,
      lastTriggeredOccurrence: existing?.lastTriggeredOccurrence ?? null,
    };
    try {
      await save(alarm);
      const next = computeNextOccurrence(alarm, now);
      toast(`Alarm set for ${formatTimestamp(next, settings.timeFormat)} · ${describeDay(next, now).toLowerCase()} (in ${formatCountdown(next - now)})`);
      close();
    } catch (e) {
      console.error(e);
      toast('Could not save the alarm. Storage may be blocked in this browser.', 'error');
    }
  };

  const onDelete = async () => {
    if (!existing) return;
    audioEngine.stop(0.05);
    await remove(existing.id);
    toast('Alarm deleted', 'info');
    close();
  };

  const back = () => {
    audioEngine.stop(0.05);
    close();
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader
        title={existing ? 'Edit alarm' : 'New alarm'}
        onBack={back}
        right={
          existing && (
            <button type="button" aria-label="Delete alarm" onClick={() => setConfirmDelete(true)} className="flex h-12 w-12 items-center justify-center rounded-full text-danger active:scale-95">
              <Trash2 size={22} />
            </button>
          )
        }
      />

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-8 pt-2">
        <Section title="Time">
          <TimePicker hour={hour} minute={minute} format={settings.timeFormat} onChange={(h, m) => { setHour(h); setMinute(m); }} />
        </Section>

        <Section title="Label">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 60))}
            placeholder="Wake up"
            aria-label="Alarm label"
            enterKeyHint="done"
            className="min-h-[56px] w-full rounded-2xl bg-card px-4 text-[17px] font-medium placeholder:text-muted/60 hairline focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </Section>

        <Section title="Repeat">
          <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
            {shortcuts.map((s) => {
              const on = sameDays(days, s.days);
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setDays(s.days)}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 text-[14px] font-semibold transition-colors ${on ? 'bg-accent text-black' : 'bg-card text-muted hairline'}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between gap-1.5">
            {ALL_DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_SHORT[d]}
                  onClick={() => toggleDay(d)}
                  className={`flex h-12 flex-1 items-center justify-center rounded-full text-[15px] font-bold transition-all active:scale-90 ${on ? 'bg-accent text-black' : 'bg-card text-muted hairline'}`}
                >
                  {DAY_LETTERS[d]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[12px] text-muted">{days.length === 0 ? 'Rings once, then turns itself off.' : 'Repeats weekly on the selected days.'}</p>
        </Section>

        <Section title="Alarm sound" hint="Sounds are generated on your device. Your phone's system volume still applies.">
          <Card className="divide-y divide-white/5 overflow-hidden">
            {SOUNDS.map((s) => {
              const on = soundId === s.id;
              const playing = previewing === s.id;
              return (
                <div key={s.id} className="flex items-center gap-2 pr-3">
                  <button type="button" onClick={() => setSoundId(s.id)} aria-pressed={on} className="flex min-h-[64px] flex-1 items-center gap-3 px-4 text-left">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${on ? 'border-accent bg-accent text-black' : 'border-white/20'}`}>
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block text-[16px] font-semibold">{s.name}</span>
                      <span className="block text-[13px] text-muted">{s.description}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`${playing ? 'Stop' : 'Preview'} ${s.name}`}
                    onClick={() => (playing ? audioEngine.stop() : audioEngine.preview(s.id, settings.alarmVolume))}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated active:scale-90"
                  >
                    {playing ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                </div>
              );
            })}
          </Card>
        </Section>

        <Section title="Snooze">
          <Segmented<SnoozeMinutes>
            label="Snooze duration"
            value={snooze}
            onChange={setSnooze}
            options={[{ value: 0, label: 'Off' }, { value: 5, label: '5 min' }, { value: 10, label: '10 min' }, { value: 15, label: '15 min' }]}
          />
          {snooze > 0 && challenges.length > 0 && (
            <p className="mt-2 px-1 text-[12px] text-muted">Snoozing never completes missions — you’ll redo them when it rings again.</p>
          )}
        </Section>

        <Section title="Wake-up missions" hint="Complete your missions to turn off the alarm.">
          <div className="flex flex-col gap-3">
            {/* Math */}
            <Card className={`overflow-hidden ${mathOn ? 'ring-1 ring-accent/50' : ''}`}>
              <div className="flex items-center gap-4 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Brain size={24} /></span>
                <div className="flex-1">
                  <p className="text-[17px] font-semibold">Math challenge</p>
                  <p className="text-[13px] text-muted">Solve problems to prove you’re thinking.</p>
                </div>
                <Toggle checked={mathOn} onChange={setMathOn} label="Math challenge" />
              </div>
              <AnimatePresence initial={false}>
                {mathOn && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-4 px-4 pb-5">
                      <div>
                        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Difficulty</p>
                        <Segmented label="Difficulty" value={math.difficulty} onChange={(difficulty) => setMath({ ...math, difficulty })}
                          options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
                      </div>
                      <div>
                        <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Questions</p>
                        <Segmented label="Number of questions" value={math.questionCount} onChange={(questionCount) => setMath({ ...math, questionCount })}
                          options={MATH_QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }))} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Object scan */}
            <Card className={`overflow-hidden ${objOn ? 'ring-1 ring-accent/50' : ''}`}>
              <div className="flex items-center gap-4 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent"><ScanLine size={24} /></span>
                <div className="flex-1">
                  <p className="text-[17px] font-semibold">Object scan</p>
                  <p className="text-[13px] text-muted">Find an object and show it to the camera.</p>
                </div>
                <Toggle checked={objOn} onChange={setObjOn} label="Object scan" />
              </div>
              <AnimatePresence initial={false}>
                {objOn && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-4 pb-5">
                      <p className="text-[16px] font-semibold">Choose an object</p>
                      <p className="mb-3 mt-0.5 text-[13px] text-muted">You’ll need to find this object and show it to your camera before your alarm stops.</p>
                      <div className="grid grid-cols-3 gap-2">
                        {OBJECT_OPTIONS.map((o) => {
                          const on = obj.targetClass === o.cocoClass;
                          return (
                            <button
                              key={o.cocoClass}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setObj({ ...obj, targetClass: o.cocoClass })}
                              className={`flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-[12px] font-semibold transition-all active:scale-95 ${
                                on ? 'bg-accent text-black' : 'bg-elevated text-fg hairline'
                              }`}
                            >
                              <ObjectIcon name={o.icon} size={24} />
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-[14px] text-accent">Tomorrow morning, find a {objectLabel(obj.targetClass).toLowerCase()} and show it to your camera.</p>
                      <Button variant="secondary" full className="mt-3" icon={<ScanLine size={18} />} onClick={() => open({ name: 'scannerTest', config: obj })}>
                        Test scanner
                      </Button>
                      <p className="mt-2 text-[12px] text-muted">Detection runs on your device with an AI model. No images ever leave your phone.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {mathOn && objOn && (
              <button
                type="button"
                onClick={() => setObjectFirst((v) => !v)}
                className="flex min-h-[56px] items-center justify-between rounded-2xl bg-card px-4 hairline active:scale-[0.99]"
              >
                <span className="flex items-center gap-3 text-[15px] font-semibold"><ArrowDownUp size={18} className="text-accent" /> Order</span>
                <span className="text-[14px] text-muted">{objectFirst ? 'Scan first, then math' : 'Math first, then scan'}</span>
              </button>
            )}

            <div className="rounded-2xl bg-accent/[0.07] p-4 text-[14px]">
              <span className="font-semibold text-accent">Mission summary · </span>
              {missionSummary(challenges)}
            </div>
          </div>
        </Section>

        {existing && (
          <Button variant="danger" full icon={<Trash2 size={18} />} onClick={() => setConfirmDelete(true)}>
            Delete alarm
          </Button>
        )}
        {previewing && <p className="mt-4 flex items-center justify-center gap-2 text-[12px] text-muted"><Volume2 size={14} /> Previewing sound…</p>}
      </div>

      <div className="border-t border-white/5 bg-bg/90 px-5 pb-safe pt-3 backdrop-blur-xl">
        <Button size="lg" full onClick={() => void onSave()}>
          Save alarm
        </Button>
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this alarm?" confirmLabel="Delete" danger onConfirm={() => void onDelete()} onCancel={() => setConfirmDelete(false)}>
        “{existing?.label}” will be permanently removed.
      </ConfirmDialog>
    </div>
  );
}
