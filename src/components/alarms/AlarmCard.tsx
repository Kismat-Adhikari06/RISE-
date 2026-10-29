import { motion } from 'motion/react';
import { Repeat } from 'lucide-react';
import type { Alarm, TimeFormat } from '../../types';
import { describeRepeat } from '../../utils/alarmRecurrence';
import { formatTime } from '../../utils/dateTime';
import { ChallengeChips } from '../challenges/ChallengeChips';
import { Toggle } from '../ui/Toggle';

interface Props {
  alarm: Alarm;
  format: TimeFormat;
  index: number;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
}

export function AlarmCard({ alarm, format, index, onOpen, onToggle }: Props) {
  const { main, suffix } = formatTime(alarm.hour, alarm.minute, format);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 6) * 0.04, type: 'spring', damping: 26, stiffness: 300 }}
      role="button"
      tabIndex={0}
      aria-label={`Edit alarm ${main} ${suffix} ${alarm.label}`}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className={`cursor-pointer rounded-3xl bg-card p-5 hairline shadow-soft transition-opacity duration-200 active:scale-[0.99] ${
        alarm.enabled ? '' : 'opacity-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="tnum text-[48px] font-bold leading-none tracking-tight">{main}</span>
            {suffix && <span className="text-[18px] font-semibold text-muted">{suffix}</span>}
          </div>
          <p className="mt-2 truncate text-[16px] font-medium">{alarm.label || 'Alarm'}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Repeat size={13} /> {describeRepeat(alarm.repeatDays)}
          </p>
        </div>
        <Toggle checked={alarm.enabled} onChange={onToggle} label={`${alarm.label || 'Alarm'} enabled`} />
      </div>
      {alarm.challenges.some((c) => c.enabled) && (
        <div className="mt-4">
          <ChallengeChips challenges={alarm.challenges} />
        </div>
      )}
    </motion.div>
  );
}
