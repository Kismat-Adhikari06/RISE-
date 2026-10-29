import { useMemo } from 'react';
import type { TimeFormat } from '../../types';
import { to12h, to24h } from '../../utils/dateTime';
import { WheelColumn } from './WheelColumn';

interface Props {
  hour: number; // 0-23
  minute: number;
  format: TimeFormat;
  onChange: (hour: number, minute: number) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function TimePicker({ hour, minute, format, onChange }: Props) {
  const hours = useMemo(
    () =>
      format === '24'
        ? Array.from({ length: 24 }, (_, i) => ({ label: pad(i), value: i }))
        : Array.from({ length: 12 }, (_, i) => ({ label: String(i + 1), value: i + 1 })),
    [format],
  );
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ label: pad(i), value: i })), []);
  const meridiem = useMemo(() => [{ label: 'AM', value: 0 }, { label: 'PM', value: 1 }], []);
  const { hour12, pm } = to12h(hour);

  return (
    <div className="relative flex items-center justify-center gap-1 rounded-3xl bg-card py-2 hairline">
      {/* selection band */}
      <div className="pointer-events-none absolute inset-x-4 top-1/2 h-[56px] -translate-y-1/2 rounded-2xl bg-white/[0.06] hairline" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-3xl bg-gradient-to-b from-card to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-3xl bg-gradient-to-t from-card to-transparent" />
      {format === '24' ? (
        <WheelColumn label="Hour" items={hours} value={hour} onChange={(h) => onChange(h, minute)} />
      ) : (
        <WheelColumn label="Hour" items={hours} value={hour12} onChange={(h) => onChange(to24h(h, pm), minute)} />
      )}
      <span className="pb-1 text-[40px] font-bold text-accent">:</span>
      <WheelColumn label="Minute" items={minutes} value={minute} onChange={(m) => onChange(hour, m)} />
      {format === '12' && (
        <WheelColumn label="AM or PM" items={meridiem} value={pm ? 1 : 0} onChange={(v) => onChange(to24h(hour12, v === 1), minute)} width="w-20" small />
      )}
    </div>
  );
}
