import { useState, useMemo } from 'react'
import { Check } from 'lucide-react'
import useLogMutation from '@/hooks/useLogMutation'

interface Props {
  metric: string
  date: string
  onSuccess: () => void
  onClose: () => void
}

export default function InlineLogForm({ metric, date, onSuccess, onClose }: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-elevated">
      {metric === 'water'  && <WaterInline  date={date} onSuccess={onSuccess} />}
      {metric === 'steps'  && <SimpleInline date={date} onSuccess={onSuccess} type="steps"          field="steps"          placeholder="Steps" />}
      {metric === 'weight' && <WeightInline date={date} onSuccess={onSuccess} />}
      {metric === 'burnt'  && <SimpleInline date={date} onSuccess={onSuccess} type="calories_burnt" field="calories_burnt" placeholder="kcal" />}
      {metric === 'sleep'  && <SleepInline  date={date} onSuccess={onSuccess} />}
      <button
        type="button"
        onClick={onClose}
        className="min-h-11 px-3 text-xs text-gray-500 hover:text-gray-300 transition-colors mt-2"
      >
        Close
      </button>
    </div>
  )
}

/* ─── Water with presets ──────────────────────────────────────────────────── */
function WaterInline({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const mut = useLogMutation('water', date, () => { setAmount(''); onSuccess() })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {[100, 250, 500].map(ml => (
          <button
            key={ml}
            type="button"
            onClick={() => mut.mutate({ amount_ml: ml })}
            disabled={mut.isPending}
            className="min-h-11 px-3 py-2 rounded-lg bg-elevated text-sm font-semibold text-info
              hover:bg-info/20 transition-colors disabled:opacity-50"
          >
            +{ml}ml
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder="Custom ml" value={amount}
          onChange={e => setAmount(e.target.value)} min="0"
          className="!py-2 !text-base !rounded-lg flex-1 min-w-0" />
        <SubmitIcon onClick={() => { if (amount) mut.mutate({ amount_ml: Number(amount) }) }}
          disabled={!amount || mut.isPending} />
      </div>
    </div>
  )
}

/* ─── Weight with kg/lbs toggle ───────────────────────────────────────────── */
function WeightInline({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [value, setValue] = useState('')
  const [unit, setUnit]   = useState<'kg' | 'lbs'>('kg')
  const mut = useLogMutation('weight', date, () => { setValue(''); onSuccess() })

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['kg', 'lbs'] as const).map(u => (
          <button key={u} type="button" onClick={() => setUnit(u)}
            className="flex-1 min-h-11 py-2 rounded-lg font-semibold text-xs transition-all"
            style={unit === u
              ? { backgroundColor: 'var(--color-lime)', color: '#000' }
              : { backgroundColor: 'var(--color-elevated)', color: '#ccc' }}>
            {u}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder={`Weight (${unit})`} value={value}
          onChange={e => setValue(e.target.value)} min="0" step="0.1"
          className="!py-2 !text-base !rounded-lg flex-1 min-w-0" />
        <SubmitIcon onClick={() => { if (value) mut.mutate({ weight_kg: Number(value), unit }) }}
          disabled={!value || mut.isPending} />
      </div>
    </div>
  )
}

/* ─── Generic single-field ────────────────────────────────────────────────── */
function SimpleInline({ date, onSuccess, type, field, placeholder }: {
  date: string; onSuccess: () => void; type: string; field: string; placeholder: string
}) {
  const [value, setValue] = useState('')
  const mut = useLogMutation(type, date, () => { setValue(''); onSuccess() })

  return (
    <div className="flex gap-2">
      <input type="number" placeholder={placeholder} value={value}
        onChange={e => setValue(e.target.value)} min="0"
        className="!py-2 !text-base !rounded-lg flex-1 min-w-0" autoFocus />
      <SubmitIcon onClick={() => { if (value) mut.mutate({ [field]: Number(value) }) }}
        disabled={!value || mut.isPending} />
    </div>
  )
}

/* ─── Sleep with time pickers ────────────────────────────────────────────── */
function SleepInline({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [sleepTime, setSleepTime] = useState('22:00')
  const [wakeTime,  setWakeTime]  = useState('06:00')
  const mut = useLogMutation('sleep', date, onSuccess)

  const duration = useMemo(() => {
    const [sh, sm] = sleepTime.split(':').map(Number)
    const [wh, wm] = wakeTime.split(':').map(Number)
    let mins = (wh * 60 + wm) - (sh * 60 + sm)
    if (mins <= 0) mins += 24 * 60
    return (mins / 60).toFixed(1)
  }, [sleepTime, wakeTime])

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Sleep</p>
          <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
            className="!py-2 !text-base !rounded-lg w-full" />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Wake</p>
          <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
            className="!py-2 !text-base !rounded-lg w-full" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 min-w-0">Duration: <span className="font-bold text-accent">{duration} hrs</span></span>
        <SubmitIcon onClick={() => mut.mutate({ sleep_time: sleepTime, wake_time: wakeTime })}
          disabled={mut.isPending} />
      </div>
    </div>
  )
}

/* ─── Small submit button ─────────────────────────────────────────────────── */
function SubmitIcon({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label="Save entry"
      className="w-11 h-11 rounded-lg bg-lime text-black disabled:opacity-40 flex-shrink-0 hover:brightness-110 transition-all flex items-center justify-center">
      <Check size={16} />
    </button>
  )
}
