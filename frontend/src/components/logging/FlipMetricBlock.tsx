import { useState, useRef } from 'react'
import { Droplets, Footprints, Moon, Minus, Plus, Check } from 'lucide-react'
import useLogMutation from '@/hooks/useLogMutation'

type Metric = 'water' | 'steps' | 'sleep'

interface Props {
  metric: Metric
  value: number     // current total for the day
  goal: number
  date: string
  onSuccess: () => void
}

const CONFIG: Record<Metric, {
  label: string
  unit: string
  icon: typeof Droplets
  color: string
  step: number
  field: string
  apiType: string
  format: (v: number) => string
}> = {
  water: {
    label: 'Water',
    unit: 'ml',
    icon: Droplets,
    color: 'var(--color-info)',
    step: 250,
    field: 'amount_ml',
    apiType: 'water',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}L` : `${Math.round(v)}`,
  },
  steps: {
    label: 'Steps',
    unit: 'steps',
    icon: Footprints,
    color: 'var(--color-lime)',
    step: 500,
    field: 'steps',
    apiType: 'steps',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`,
  },
  sleep: {
    label: 'Sleep',
    unit: 'hrs',
    icon: Moon,
    color: 'var(--color-accent)',
    step: 0.5,
    field: 'duration_hours',
    apiType: 'sleep',
    format: v => `${v.toFixed(1)}`,
  },
}

export default function FlipMetricBlock({ metric, value, goal, date, onSuccess }: Props) {
  const [flipped, setFlipped]   = useState(false)
  const [amount, setAmount]     = useState<number>(CONFIG[metric].step)
  const [editing, setEditing]   = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const cfg = CONFIG[metric]
  const Icon = cfg.icon
  const pct  = Math.min(100, goal > 0 ? (value / goal) * 100 : 0)

  // For sleep, post duration_hours directly; others post their field
  const mut = useLogMutation(
    cfg.apiType === 'sleep' ? 'sleep' : cfg.apiType,
    date,
    () => {
      setFlipped(false)
      setAmount(cfg.step)
      setEditing(false)
      onSuccess()
    }
  )

  function handleLog() {
    if (cfg.apiType === 'sleep') {
      // Convert hours to sleep/wake times (start from 22:00 as default)
      const totalMins = Math.round(amount * 60)
      const sleepH = 22, sleepM = 0
      const wakeTotal = sleepH * 60 + sleepM + totalMins
      const wakeH = Math.floor(wakeTotal / 60) % 24
      const wakeM = wakeTotal % 60
      const pad = (n: number) => String(n).padStart(2, '0')
      mut.mutate({ sleep_time: `${pad(sleepH)}:${pad(sleepM)}`, wake_time: `${pad(wakeH)}:${pad(wakeM)}` })
    } else {
      mut.mutate({ [cfg.field]: amount })
    }
  }

  function commitCustom() {
    const v = parseFloat(inputVal)
    if (!isNaN(v) && v > 0) setAmount(v)
    setEditing(false)
  }

  function startEditing() {
    setInputVal(String(amount))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  return (
    <div
      className="relative h-[140px]"
      style={{ perspective: '800px' }}
    >
      <div
        className="w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── FRONT ──────────────────────────────────────────────────── */}
        <button
          onClick={() => setFlipped(true)}
          className="absolute inset-0 w-full h-full rounded-2xl bg-surface
                     flex flex-col items-center justify-center gap-2 cursor-pointer
                     hover:ring-1 transition-all group"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                   boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
        >
          {/* Progress arc at top */}
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden bg-elevated">
            <div
              className="h-full rounded-tl-2xl transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: cfg.color }}
            />
          </div>

          <Icon size={20} style={{ color: cfg.color }} className="opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="text-center">
            <p className="text-2xl font-bold leading-none" style={{ color: cfg.color }}>
              {cfg.format(value)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              / {cfg.format(goal)} {cfg.unit}
            </p>
          </div>
          <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">
            {cfg.label}
          </p>
        </button>

        {/* ── BACK ───────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl bg-surface
                     flex flex-col items-center justify-center gap-2 px-3"
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
            + {cfg.label}
          </p>

          {/* +/- row with editable number */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAmount(a => Math.max(cfg.step, parseFloat((a - cfg.step).toFixed(2))))}
              className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center
                         hover:bg-[#3A3A3A] transition-colors text-white"
            >
              <Minus size={14} />
            </button>

            {/* Tappable number → custom input */}
            {editing ? (
              <input
                ref={inputRef}
                type="number"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onBlur={commitCustom}
                onKeyDown={e => { if (e.key === 'Enter') commitCustom() }}
                className="w-20 text-center !py-1 !text-lg font-bold !rounded-lg"
                style={{ color: cfg.color }}
                min="0"
              />
            ) : (
              <button
                onClick={startEditing}
                className="w-20 text-center text-xl font-bold leading-none
                           border-b border-dashed border-gray-600 hover:border-gray-300 transition-colors pb-0.5"
                style={{ color: cfg.color }}
              >
                {metric === 'sleep'
                  ? amount.toFixed(1)
                  : amount >= 1000 ? `${(amount/1000).toFixed(1)}k` : amount}
                <span className="text-xs text-gray-500 ml-0.5">{cfg.unit}</span>
              </button>
            )}

            <button
              onClick={() => setAmount(a => parseFloat((a + cfg.step).toFixed(2)))}
              className="w-8 h-8 rounded-full bg-elevated flex items-center justify-center
                         hover:bg-[#3A3A3A] transition-colors text-white"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Log + Cancel */}
          <div className="flex gap-2 w-full">
            <button
              onClick={() => { setFlipped(false); setAmount(cfg.step); setEditing(false) }}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-elevated
                         text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLog}
              disabled={mut.isPending}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-lime text-black
                         hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Check size={13} />
              Log
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
