import { Brain, Clock, Flame, ScanLine, Sunrise, Trophy, TriangleAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, type ReactNode } from 'react';
import { Card } from '../components/ui/Section';
import { useNow } from '../hooks/useNow';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { describeDay, formatDuration, formatTimestamp } from '../utils/dateTime';
import { computeInsights } from '../utils/insights';

function Stat({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={`p-4 ${accent ? 'bg-gradient-to-br from-accent/20 to-card' : ''}`}>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">{icon}</div>
      <p className="tnum text-[28px] font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-[13px] text-muted">{label}</p>
    </Card>
  );
}

export function InsightsPage() {
  const history = useSessionStore((s) => s.history);
  const format = useSettingsStore((s) => s.settings.timeFormat);
  const now = useNow(60_000);
  const ins = useMemo(() => computeInsights(history, now), [history, now]);
  const recent = history.filter((s) => !s.isTest).slice(0, 10);
  const max = Math.max(1, ...ins.week.map((d) => d.count));

  return (
    <div className="px-5 pb-48 pt-safe">
      <header className="pt-5">
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight">Your history</h1>
      </header>

      {ins.total === 0 && recent.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-[32px] bg-card px-6 py-14 text-center hairline">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent"><Sunrise size={36} /></div>
          <h2 className="mt-5 text-[22px] font-bold">No wake-ups yet</h2>
          <p className="mt-2 max-w-[270px] text-[14px] leading-relaxed text-muted">
            Finish your first real alarm and your streak, speed and mission stats will show up here. Test alarms don’t count.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat accent icon={<Trophy size={18} />} label="Successful wake-ups" value={String(ins.total)} />
            <Stat accent icon={<Flame size={18} />} label="Day streak" value={String(ins.streak)} />
            <Stat icon={<Clock size={18} />} label="Avg. time to dismiss" value={ins.avgDismissMs === null ? '—' : formatDuration(ins.avgDismissMs)} />
            <Stat icon={<Brain size={18} />} label="Math questions solved" value={String(ins.mathSolved)} />
            <Stat icon={<ScanLine size={18} />} label="Object scans completed" value={String(ins.objectScans)} />
          </div>

          <Card className="mt-4 p-5">
            <p className="text-[13px] font-medium text-muted">Last 7 days</p>
            <div className="mt-4 flex h-32 items-end justify-between gap-2">
              {ins.week.map((d, i) => (
                <div key={d.dayStart} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 w-full items-end">
                    <motion.div
                      className={`w-full rounded-lg ${d.count ? 'bg-accent' : 'bg-white/10'}`}
                      initial={{ height: 0 }}
                      animate={{ height: d.count ? `${(d.count / max) * 100}%` : '6%' }}
                      transition={{ delay: i * 0.04, type: 'spring', damping: 20 }}
                      aria-label={`${d.count} wake-ups`}
                    />
                  </div>
                  <span className="text-[11px] text-muted">{new Date(d.dayStart).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                </div>
              ))}
            </div>
          </Card>

          <h2 className="mb-3 mt-8 px-1 text-[13px] font-medium text-muted">Recent history</h2>
          <div className="flex flex-col gap-2">
            {recent.map((s) => (
              <Card key={s.id} className="flex items-center gap-3 p-4">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.status === 'COMPLETED' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger'}`}>
                  {s.status === 'COMPLETED' ? <Sunrise size={20} /> : <TriangleAlert size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{s.label || 'Alarm'}</p>
                  <p className="text-[12px] text-muted">
                    {describeDay(s.scheduledAt, now)} · {formatTimestamp(s.scheduledAt, format)}
                  </p>
                </div>
                <div className="text-right text-[12px] text-muted">
                  {s.status === 'COMPLETED' && s.completedAt ? (
                    <>
                      <p className="tnum font-semibold text-fg">{formatDuration(s.completedAt - s.triggeredAt)}</p>
                      <p>{s.missions.length ? `${s.missions.length} missions` : 'no missions'}</p>
                    </>
                  ) : (
                    <p className="font-semibold text-danger">Missed</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
