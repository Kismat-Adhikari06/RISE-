import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { BottomNav } from './components/navigation/BottomNav';
import { Toasts } from './components/ui/Toasts';
import { useAlarmAudio } from './hooks/useAlarmAudio';
import { useAlarmScheduler } from './hooks/useAlarmScheduler';
import { ActiveSession } from './pages/ActiveSession';
import { AlarmEditorPage } from './pages/AlarmEditorPage';
import { CompletionPage } from './pages/CompletionPage';
import { HomePage } from './pages/HomePage';
import { InsightsPage } from './pages/InsightsPage';
import { OnboardingPage, needsOnboarding } from './pages/OnboardingPage';
import { NightstandPage } from './pages/NightstandPage';
import { ScannerTestPage } from './pages/ScannerTestPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAlarmStore } from './stores/alarmStore';
import { useSessionStore } from './stores/sessionStore';
import { useSettingsStore } from './stores/settingsStore';
import { useUIStore } from './stores/uiStore';

function Boot() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-accent" role="status" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  const alarmsReady = useAlarmStore((s) => s.hydrated);
  const sessionsReady = useSessionStore((s) => s.hydrated);
  const tab = useUIStore((s) => s.tab);
  const overlay = useUIStore((s) => s.overlay);
  const completed = useSessionStore((s) => s.justCompleted);
  const active = useSessionStore((s) => s.active);

  useEffect(() => {
    void useSettingsStore.getState().hydrate();
    void useAlarmStore.getState().hydrate();
    void useSessionStore.getState().hydrate();
  }, []);

  const [onboarding, setOnboarding] = useState(needsOnboarding);

  useAlarmScheduler();
  useAlarmAudio();

  // An alarm takes over the screen: close any editor/scanner test first.
  useEffect(() => {
    if (active) useUIStore.getState().close();
  }, [active]);

  const ready = alarmsReady && sessionsReady;

  return (
    <div className="mx-auto h-full w-full max-w-[480px] overflow-hidden bg-bg sm:border-x sm:border-white/5">
      <div className="relative h-full">
        {!ready ? (
          <Boot />
        ) : onboarding && !active ? (
          <OnboardingPage onDone={() => setOnboarding(false)} />
        ) : (
          <>
            <main className="no-scrollbar h-full overflow-y-auto overflow-x-hidden overscroll-contain">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  {tab === 'alarms' && <HomePage />}
                  {tab === 'insights' && <InsightsPage />}
                  {tab === 'settings' && <SettingsPage />}
                </motion.div>
              </AnimatePresence>
            </main>
            <BottomNav />

            <AnimatePresence>
              {overlay && !active && (
                <motion.div
                  key={overlay.name}
                  className="absolute inset-0 z-40 bg-bg"
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                >
                  {overlay.name === 'editor' && <AlarmEditorPage alarmId={overlay.alarmId} />}
                  {overlay.name === 'nightstand' && <NightstandPage />}
                  {overlay.name === 'scannerTest' && <ScannerTestPage config={overlay.config} />}
                </motion.div>
              )}
            </AnimatePresence>

            <ActiveSession />
            {completed && !active && <CompletionPage />}
          </>
        )}
        <Toasts />
      </div>
    </div>
  );
}
