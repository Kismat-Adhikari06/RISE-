import { Bell, Brain, CheckCircle2, Download, FlaskConical, Info, Lock, Play, ScanLine, Timer, Trash2, Upload, Vibrate, Volume2, Zap } from 'lucide-react';
import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/Dialog';
import { Card, Section } from '../components/ui/Section';
import { Segmented } from '../components/ui/Segmented';
import { Toggle } from '../components/ui/Toggle';
import { APP_VERSION, DEFAULT_CONFIDENCE_THRESHOLD, SOUNDS } from '../constants';
import { audioEngine } from '../services/audioEngine';
import { isDetectorLoaded, loadDetector } from '../services/objectDetection';
import { useAlarmStore } from '../stores/alarmStore';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import type { ChallengeConfig, MathDifficulty, SnoozeMinutes, SoundId, TimeFormat } from '../types';
import { createQuickAlarm } from '../utils/quickAlarm';
import { formatTimestamp } from '../utils/dateTime';
import { createSession } from '../utils/sessionMachine';
import { parseImport, type ExportFile } from '../utils/validation';

function Row({ icon, title, sub, children, stack }: { icon?: ReactNode; title: string; sub?: string; children?: ReactNode; stack?: boolean }) {
  return (
    <div className={`p-4 ${stack ? 'space-y-3' : 'flex items-center gap-3'}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</span>}
        <div className="min-w-0">
          <p className="text-[16px] font-semibold">{title}</p>
          {sub && <p className="text-[13px] leading-snug text-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

type TestKind = 'sound' | 'math' | 'scan' | 'both';

export function SettingsPage() {
  const { settings, update, replace } = useSettingsStore();
  const alarms = useAlarmStore((s) => s.alarms);
  const mergeImported = useAlarmStore((s) => s.mergeImported);
  const clearHistory = useSessionStore((s) => s.clearHistory);
  const ring = useSessionStore((s) => s.ring);
  const active = useSessionStore((s) => s.active);
  const toast = useUIStore((s) => s.toast);
  const openOverlay = useUIStore((s) => s.open);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [modelState, setModelState] = useState<'idle' | 'loading' | 'ready' | 'error'>(isDetectorLoaded() ? 'ready' : 'idle');
  const playing = useSyncExternalStore((cb) => audioEngine.subscribe(cb), () => audioEngine.playing);
  const blocked = useSyncExternalStore((cb) => audioEngine.subscribe(cb), () => audioEngine.blocked);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('Notification' in window ? Notification.permission : 'unsupported');
  const vibrationSupported = typeof navigator.vibrate === 'function';

  const startTest = (kind: TestKind) => {
    setTestOpen(false);
    if (active) return toast('An alarm is already active.', 'info');
    const challenges: ChallengeConfig[] = [];
    if (kind === 'math' || kind === 'both')
      challenges.push({ id: 'test-math', type: 'math', enabled: true, config: { difficulty: kind === 'both' ? 'easy' : settings.defaultMathDifficulty, questionCount: 3 } });
    if (kind === 'scan' || kind === 'both')
      challenges.push({ id: 'test-scan', type: 'object', enabled: true, config: { targetClass: 'cup', confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD } });
    const now = Date.now();
    void audioEngine.unlock();
    ring(createSession({ id: 'test', label: 'Test alarm', soundId: settings.defaultSound, snoozeMinutes: settings.defaultSnooze, challenges }, now, now, true));
  };

  const doExport = () => {
    const data: ExportFile = { app: 'rise', version: 1, exportedAt: Date.now(), settings, alarms };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rise-alarms-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${alarms.length} alarm${alarms.length === 1 ? '' : 's'}`);
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { alarms: imported, settings: s } = parseImport(await file.text());
      await mergeImported(imported);
      if (s) replace(s);
      toast(`Imported ${imported.length} alarm${imported.length === 1 ? '' : 's'}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const prepareModel = async () => {
    setModelState('loading');
    try {
      await loadDetector();
      setModelState('ready');
    } catch (e) {
      setModelState('error');
      toast(e instanceof Error ? e.message : 'Model failed to load', 'error');
    }
  };

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    setNotifPerm(await Notification.requestPermission());
  };

  return (
    <div className="px-5 pb-48 pt-safe">
      <header className="pt-5">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-accent">SETTINGS</p>
        <h1 className="mt-2 mb-7 text-[34px] font-extrabold leading-tight tracking-tight">Make it yours.</h1>
      </header>

      <Section title="General">
        <Card className="divide-y divide-white/5">
          <Row title="Time format" stack>
            <Segmented<TimeFormat> label="Time format" value={settings.timeFormat} onChange={(timeFormat) => update({ timeFormat })} options={[{ value: '12', label: '12-hour' }, { value: '24', label: '24-hour' }]} />
          </Row>
          <Row title="Default snooze" sub="Used for new alarms" stack>
            <Segmented<SnoozeMinutes> label="Default snooze" value={settings.defaultSnooze} onChange={(defaultSnooze) => update({ defaultSnooze })} options={[{ value: 0, label: 'Off' }, { value: 5, label: '5m' }, { value: 10, label: '10m' }, { value: 15, label: '15m' }]} />
          </Row>
          <Row title="Default math difficulty" sub="Used for new alarms" stack>
            <Segmented<MathDifficulty> label="Default math difficulty" value={settings.defaultMathDifficulty} onChange={(defaultMathDifficulty) => update({ defaultMathDifficulty })} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
          </Row>
        </Card>
      </Section>

      <Section title="Alarm" hint="RISE can’t change your phone’s system volume — turn it up before bed.">
        <Card className="divide-y divide-white/5">
          <Row title="Preferred sound" stack>
            <div className="flex flex-wrap gap-2">
              {SOUNDS.map((s) => (
                <button key={s.id} type="button" aria-pressed={settings.defaultSound === s.id} onClick={() => update({ defaultSound: s.id as SoundId })}
                  className={`min-h-[44px] rounded-full px-4 text-[14px] font-semibold ${settings.defaultSound === s.id ? 'bg-accent text-black' : 'bg-elevated text-muted hairline'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </Row>
          <Row icon={<Volume2 size={20} />} title="Alarm volume" sub="App-level loudness" stack>
            <input type="range" min={0.1} max={1} step={0.05} value={settings.alarmVolume} aria-label="Alarm volume" onChange={(e) => update({ alarmVolume: Number(e.target.value) })} className="h-10 w-full accent-[#C4F46D]" />
          </Row>
          <Row icon={<Volume2 size={20} />} title="Volume during missions" sub={`${Math.round(settings.missionVolumeRatio * 100)}% of alarm volume`} stack>
            <input type="range" min={0.1} max={0.8} step={0.05} value={settings.missionVolumeRatio} aria-label="Volume during missions" onChange={(e) => update({ missionVolumeRatio: Number(e.target.value) })} className="h-10 w-full accent-[#C4F46D]" />
          </Row>
          <Row icon={<Play size={20} />} title="Test alarm sound" sub={blocked ? 'Tap play — your browser needs a tap before it allows sound.' : 'Plays the preferred sound for a few seconds.'}>
            <Button variant="secondary" className="!min-h-[44px]" onClick={() => (playing ? audioEngine.stop() : audioEngine.preview(settings.defaultSound, settings.alarmVolume, 4000))}>
              {playing ? 'Stop' : 'Play'}
            </Button>
          </Row>
          <Row icon={<Vibrate size={20} />} title="Vibration" sub={vibrationSupported ? 'Vibrate while the alarm rings.' : 'Not supported by this browser/device.'}>
            <Toggle checked={settings.vibrationEnabled && vibrationSupported} onChange={(vibrationEnabled) => update({ vibrationEnabled })} label="Vibration" />
          </Row>
          <Row icon={<Bell size={20} />} title="Background notification" sub={notifPerm === 'unsupported' ? 'Not supported here.' : 'Shows a notice if an alarm fires while the tab is hidden. Not a guaranteed alarm.'}>
            {notifPerm === 'default' && <Button variant="secondary" className="!min-h-[44px]" onClick={() => void requestNotifications()}>Allow</Button>}
            {notifPerm === 'granted' && <CheckCircle2 className="text-accent" size={22} />}
            {notifPerm === 'denied' && <span className="text-[13px] text-muted">Blocked</span>}
          </Row>
          <Row icon={<Info size={20} />} title="Nightstand mode" sub="Open it from the Alarms screen. It keeps the screen awake (where supported) so the page stays alive overnight. Keep your phone plugged in." />
          <Row icon={<ScanLine size={20} />} title="Scanner model" sub={modelState === 'ready' ? 'Ready on this device.' : modelState === 'error' ? 'Failed to load — check your connection.' : 'Load the AI model now so scanning starts instantly (and works offline afterwards).'}>
            {modelState === 'ready' ? <CheckCircle2 className="text-accent" size={22} /> : (
              <Button variant="secondary" className="!min-h-[44px]" disabled={modelState === 'loading'} onClick={() => void prepareModel()}>
                {modelState === 'loading' ? 'Loading…' : 'Load'}
              </Button>
            )}
          </Row>
        </Card>
      </Section>

      <Section title="Testing" hint="Runs the real alarm experience with a temporary session. Your alarms and Insights are untouched.">
        <Card className="divide-y divide-white/5">
          <Row icon={<FlaskConical size={20} />} title="Test alarm now" sub="Sound, ringing screen, missions, completion.">
            <Button variant="secondary" className="!min-h-[44px]" onClick={() => setTestOpen(true)}>Choose</Button>
          </Row>
          <Row icon={<ScanLine size={20} />} title="Test camera scan" sub="Pick an object, scan it, and see Detected or Failed. No alarm needed.">
            <Button variant="secondary" className="!min-h-[44px]" onClick={() => openOverlay({ name: 'scannerTest', config: { targetClass: 'cup', confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD } })}>Open</Button>
          </Row>
          <Row icon={<Timer size={20} />} title="Alarm in 1 minute" sub="Creates a real one-time alarm to test scheduling.">
            <Button variant="secondary" className="!min-h-[44px]" onClick={async () => { const a = await createQuickAlarm(); toast(`Alarm set for ${formatTimestamp(a.nextOccurrence as number, settings.timeFormat)}`); }}>Set</Button>
          </Row>
        </Card>
      </Section>

      <Section title="Appearance">
        <Card><Row title="Theme" sub="Dark. A light theme is planned." /></Card>
      </Section>

      <Section title="Data">
        <Card className="divide-y divide-white/5">
          <Row icon={<Download size={20} />} title="Export alarms" sub="Save alarms and settings as a JSON file."><Button variant="secondary" className="!min-h-[44px]" onClick={doExport}>Export</Button></Row>
          <Row icon={<Upload size={20} />} title="Import alarms" sub="Validated before anything is changed.">
            <Button variant="secondary" className="!min-h-[44px]" onClick={() => fileRef.current?.click()}>Import</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
          </Row>
          <Row icon={<Trash2 size={20} />} title="Clear wake-up history" sub="Removes Insights data. Alarms are kept."><Button variant="danger" className="!min-h-[44px]" onClick={() => setConfirmClear(true)}>Clear</Button></Row>
        </Card>
      </Section>

      <Section title="About">
        <Card className="divide-y divide-white/5">
          <Row icon={<Zap size={20} />} title="RISE" sub={`Version ${APP_VERSION} · Wake up. Prove you’re awake.`} />
          <Row icon={<Lock size={20} />} title="Privacy" sub="Everything stays on this device. Camera frames are analysed locally by an on-device AI model — nothing is recorded, stored, or uploaded. No accounts, no analytics." />
          <Row icon={<Brain size={20} />} title="Browser limitations" sub="Web apps can’t ring when the page is closed, the phone is locked or the OS suspends the browser. Object detection is not proof of presence (a photo on a screen may fool it). Keep a regular alarm as backup." />
        </Card>
      </Section>

      <ConfirmDialog open={confirmClear} title="Clear wake-up history?" confirmLabel="Clear" danger onCancel={() => setConfirmClear(false)} onConfirm={() => { setConfirmClear(false); void clearHistory(); toast('History cleared', 'info'); }}>
        Your streak and stats will reset. Alarms are not affected.
      </ConfirmDialog>

      <ConfirmDialog open={testOpen} title="Test alarm" confirmLabel="Sound only" cancelLabel="Cancel" onCancel={() => setTestOpen(false)} onConfirm={() => startTest('sound')}>
        <p className="mb-3">Pick what to test. Scan tests look for a cup.</p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" full onClick={() => startTest('math')}>Math missions</Button>
          <Button variant="secondary" full onClick={() => startTest('scan')}>Object scan (cup)</Button>
          <Button variant="secondary" full onClick={() => startTest('both')}>Math + scan combined</Button>
        </div>
      </ConfirmDialog>
    </div>
  );
}
