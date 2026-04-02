import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Droplets, Footprints, Moon, Minus, Plus } from 'lucide-react'
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
}> = {
  water: {
    label: 'Water', unit: 'ml',
    icon: Droplets, color: 'var(--color-info)',
    step: 250, field: 'amount_ml', apiType: 'water', entryKey: 'water',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}L` : `${Math.round(v)}`,
  },
  steps: {
    label: 'Steps', unit: 'steps',
    icon: Footprints, color: 'var(--color-lime)',
    step: 500, field: 'steps', apiType: 'steps', entryKey: 'steps',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`,
  },
  sleep: {
    label: 'Sleep', unit: 'hrs',
    icon: Moon, color: 'var(--color-accent)',
    step: 0.5, max: 24, field: 'duration_hours', apiType: 'sleep', entryKey: 'sleep',
    format: v => `${v.toFixed(1)}`,
  },
}

export default function FlipMetricBlock({ metric, value, goal, date, onSuccess }: Props) {
  const qc = useQueryClient()
  const cfg  = CONFIG[metric]
  const Icon = cfg.icon
  const pct  = Math.min(100, goal > 0 ? (value / goal) * 100 : 0)

  // Always fetch entries so we can delete the last one on minus
  const { data: entriesData } = useQuery<Record<string, Record<string, unknown>[]>>({
    queryKey: ['entries', date],
    queryFn: () => api.get(`/entries?date=${date}`).then(r => r.data),
  })
  const entries = entriesData?.[cfg.entryKey] || []
  const lastEntry = entries[entries.length - 1]

  // Cap additions so daily total never exceeds max (sleep = 24 hrs)
  const effectiveMax = cfg.max !== undefined ? Math.max(0, cfg.max - value) : Infinity
  const canAdd = effectiveMax >= cfg.step

  const addMut = useLogMutation(cfg.apiType, date, onSuccess)

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/entries/${cfg.apiType}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries', date] })
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
      onSuccess()
    },
  })

  function handleAdd() {
    if (!canAdd) return
    if (metric === 'sleep') {
      const totalMins = Math.round(cfg.step * 60)
      const sleepH = 22, sleepM = 0
      const wakeTotal = sleepH * 60 + sleepM + totalMins
      const wakeH = Math.floor(wakeTotal / 60) % 24
      const wakeM = wakeTotal % 60
      const pad = (n: number) => String(n).padStart(2, '0')
      addMut.mutate({ sleep_time: `${pad(sleepH)}:${pad(sleepM)}`, wake_time: `${pad(wakeH)}:${pad(wakeM)}` })
    } else {
      addMut.mutate({ [cfg.field]: cfg.step })
    }
  }

  const busy = addMut.isPending || delMut.isPending

  return (
    <div
      className="rounded-2xl bg-surface flex flex-col items-center justify-center gap-2 py-4 px-2 relative"
      style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.3)', minHeight: '140px' }}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl overflow-hidden bg-elevated">
        <div className="h-full rounded-tl-2xl transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
      </div>

      <Icon size={18} style={{ color: cfg.color }} className="opacity-70" />

      {/* Value + +/- on same line */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => lastEntry && delMut.mutate(lastEntry.id as number)}
          disabled={busy || entries.length === 0}
          className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center
                     hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
        >
          <Minus size={13} />
        </button>

        <p className="text-2xl font-bold leading-none" style={{ color: cfg.color }}>
          {cfg.format(value)}
        </p>

        <button
          onClick={handleAdd}
          disabled={busy || !canAdd}
          className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center
                     hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="text-center">
        <p className="text-xs text-gray-500">/ {cfg.format(goal)} {cfg.unit}</p>
        <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest mt-0.5">{cfg.label}</p>
      </div>
    </div>
  )
}
