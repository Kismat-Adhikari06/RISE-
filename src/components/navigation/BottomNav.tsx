import { BarChart3, Bell, Plus, Settings as SettingsIcon } from 'lucide-react';
import { useUIStore, type Tab } from '../../stores/uiStore';

const items: { tab: Tab; label: string; icon: typeof Bell }[] = [
  { tab: 'alarms', label: 'Alarms', icon: Bell },
  { tab: 'insights', label: 'Insights', icon: BarChart3 },
  { tab: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function BottomNav() {
  const tab = useUIStore((s) => s.tab);
  const setTab = useUIStore((s) => s.setTab);
  const open = useUIStore((s) => s.open);

  return (
    <>
      {tab === 'alarms' && (
        <button
          type="button"
          aria-label="Create alarm"
          onClick={() => open({ name: 'editor', alarmId: null })}
          className="absolute right-5 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-accent text-black shadow-glow transition-transform active:scale-90"
          style={{ bottom: 'calc(88px + max(var(--safe-bottom), 8px))' }}
        >
          <Plus size={30} strokeWidth={2.6} />
        </button>
      )}
      <nav
        aria-label="Primary"
        className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-bg/0 px-4 pb-safe pt-6"
      >
        <div className="mx-auto flex max-w-[420px] items-center justify-around rounded-[28px] bg-card/90 p-1.5 hairline shadow-soft backdrop-blur-xl">
          {items.map(({ tab: t, label, icon: Icon }) => {
            const on = tab === t;
            return (
              <button
                key={t}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => setTab(t)}
                className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] text-[11px] font-semibold transition-all ${
                  on ? 'bg-white/[0.07] text-accent' : 'text-muted active:text-fg'
                }`}
              >
                <Icon size={22} strokeWidth={on ? 2.4 : 2} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
