import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Droplets, Footprints, Moon, Minus, Plus, Check, Trash2 } from 'lucide-react'
import useLogMutation from '@/hooks/useLogMutation'
import api from '@/api/client'

type Metric = 'water' | 'steps' | 'sleep'

interface Props {
  metric: Metric
  value: number
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
  max?: number
  field: string
  apiType: string
  entryKey: string
  format: (v: number) => string
  formatEntry: (e: Record<string, unknown>) => string
}> = {
  water: {
    label: 'Water', unit: 'ml',
    icon: Droplets, color: 'var(--color-info)',
    step: 250, field: 'amount_ml', apiType: 'water', entryKey: 'water',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}L` : `${Math.round(v)}`,
    formatEntry: e => `${e.amount_ml} ml`,
  },
  steps: {
    label: 'Steps', unit: 'steps',
    icon: Footprints, color: 'var(--color-lime)',
    step: 500, field: 'steps', apiType: 'steps', entryKey: 'steps',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`,
    formatEntry: e => `${e.steps} steps`,
  },
  sleep: {
    label: 'Sleep', unit: 'hrs',
    icon: Moon, color: 'var(--color-accent)',
    step: 0.5, max: 24, field: 'duration_hours', apiType: 'sleep', entryKey: 'sleep',
    format: v => `${v.toFixed(1)}`,
    formatEntry: e => `${(e.duration_hours as number).toFixed(1)} hrs`,
  },
}

export default function FlipMetricBlock({ metric, value, goal, date, onSuccess }: Props) {
  const [flipped, setFlipped]   = useState(false)
  const [amount, setAmount]     = useState<number>(CONFIG[metric].step)
  const [editing, setEditing]   = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const cfg  = CONFIG[metric]
  const Icon = cfg.icon
  const pct  = Math.min(100, goal > 0 ? (value / goal) * 100 : 0)

  // Fetch today's entries (shared cache with TodaysLog / LogPage)
  const { data: entriesData } = useQuery<Record<string, Record<string, unknown>[]>>({
    queryKey: ['entries', date],
    queryFn: () => api.get(`/entries?date=${date}`).then(r => r.data),
    enabled: flipped,
  })
  const entries = entriesData?.[cfg.entryKey] || []

  // Dynamic height: base 140px + 36px per entry (max 3 shown) + 8px padding
  const backHeight = Math.max(180, 180 + Math.min(entries.length, 4) * 34)
  const containerH = flipped ? backHeight : 140

  const logMut = useLogMutation(cfg.apiType, date, () => {
    setFlipped(false)
    setAmount(cfg.step)
    setEditing(false)
    onSuccess()
  })

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/entries/${cfg.apiType}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries', date] })
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
      onSuccess()
    },
  })

  function handleLog() {
    if (cfg.apiType === 'sleep') {
      const totalMins = Math.round(amount * 60)
      const sleepH = 22, sleepM = 0
      const wakeTotal = sleepH * 60 + sleepM + totalMins
      const wakeH = Math.floor(wakeTotal / 60) % 24
      const wakeM = wakeTotal % 60
      const pad = (n: number) => String(n).padStart(2, '0')
      logMut.mutate({ sleep_time: `${pad(sleepH)}:${pad(sleepM)}`, wake_time: `${pad(wakeH)}:${pad(wakeM)}` })
    } else {
      logMut.mutate({ [cfg.field]: amount })
    }
  }

  function commitCustom() {
    const v = parseFloat(inputVal)
    if (!isNaN(v) && v > 0) setAmount(Math.min(cfg.max ?? Infinity, v))
    setEditing(false)
  }

  function startEditing() {
    setInputVal(String(amount))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 50)
  }

  return (
    <div
      className="relative transition-[height] duration-500"
      style={{ perspective: '800px', height: `${containerH}px` }}
    >
      <div
        className="w-full h-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* ── FRONT ──────────────────────────────────────────────────────── */}
        <button
          onClick={() => setFlipped(true)}
          className="absolute inset-0 w-full h-full rounded-2xl bg-surface
                     flex flex-col items-center justify-center gap-2 cursor-pointer
                     hover:ring-1 hover:ring-white/10 transition-all group"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                   boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden bg-elevated">
            <div className="h-full rounded-tl-2xl transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
          </div>
          <Icon size={20} style={{ color: cfg.color }} className="opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="text-center">
            <p className="text-2xl font-bold leading-none" style={{ color: cfg.color }}>
              {cfg.format(value)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">/ {cfg.format(goal)} {cfg.unit}</p>
          </div>
          <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">{cfg.label}</p>
        </button>

        {/* ── BACK ───────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 w-full h-full rounded-2xl bg-surface flex flex-col px-3 py-3 gap-2"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                   transform: 'rotateY(180deg)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 text-center shrink-0">
            + {cfg.label}
          </p>

          {/* +/- stepper */}
          <div className="flex items-center justify-center gap-3 shrink-0">
            <button
              onClick={() => setAmount(a => Math.max(cfg.step, parseFloat((a - cfg.step).toFixed(2))))}
              className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center hover:bg-[#3A3A3A] transition-colors"
            >
              <Minus size={13} />
            </button>
            {editing ? (
              <input ref={inputRef} type="number" value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onBlur={commitCustom}
                onKeyDown={e => { if (e.key === 'Enter') commitCustom() }}
                className="w-20 text-center !py-0.5 !text-base font-bold !rounded-lg"
                style={{ color: cfg.color }} min="0" />
            ) : (
              <button onClick={startEditing}
                className="w-20 text-center text-lg font-bold border-b border-dashed border-gray-600 hover:border-gray-300 transition-colors pb-0.5"
                style={{ color: cfg.color }}>
                {metric === 'sleep' ? amount.toFixed(1) : amount >= 1000 ? `${(amount/1000).toFixed(1)}k` : amount}
                <span className="text-xs text-gray-500 ml-0.5">{cfg.unit}</span>
              </button>
            )}
            <button
              onClick={() => setAmount(a => Math.min(cfg.max ?? Infinity, parseFloat((a + cfg.step).toFixed(2))))}
              className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center hover:bg-[#3A3A3A] transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Log / Cancel */}
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setFlipped(false); setAmount(cfg.step); setEditing(false) }}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold bg-elevated text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button onClick={handleLog} disabled={logMut.isPending}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-lime text-black hover:brightness-110
                         transition-all disabled:opacity-50 flex items-center justify-center gap-1">
              <Check size={12} /> Log
            </button>
          </div>

          {/* Today's entries — with delete */}
          {entries.length > 0 && (
            <div className="border-t border-elevated pt-2 flex flex-col gap-1 overflow-y-auto">
              {entries.map(e => (
                <div key={e.id as number}
                  className="flex items-center justify-between px-2 py-1 rounded-lg bg-elevated text-xs">
                  <span className="text-gray-300">{cfg.formatEntry(e)}</span>
                  <button
                    onClick={() => delMut.mutate(e.id as number)}
                    disabled={delMut.isPending}
                    className="text-danger hover:bg-danger/10 p-1 rounded transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
