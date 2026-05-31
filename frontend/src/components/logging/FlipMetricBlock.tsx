import { useRef, useState } from 'react'
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
  readOnly?: boolean
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
    icon: Droplets, color: 'var(--color-stand)',
    step: 100, field: 'amount_ml', apiType: 'water', entryKey: 'water',
    format: v => v >= 1000 ? `${(v / 1000).toFixed(1)}L` : `${Math.round(v)}ml`,
  },
  steps: {
    label: 'Steps', unit: 'steps',
    icon: Footprints, color: 'var(--color-growth)',
    step: 100, field: 'steps', apiType: 'steps', entryKey: 'steps',
    format: v => v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : `${Math.round(v)}`,
  },
  sleep: {
    label: 'Sleep', unit: 'hrs',
    icon: Moon, color: 'var(--color-accent)',
    step: 0.25, max: 24, field: 'duration_hours', apiType: 'sleep', entryKey: 'sleep',
    format: v => `${v.toFixed(1)}`,
  },
}

export default function FlipMetricBlock({ metric, value, goal, date, onSuccess, readOnly = false }: Props) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
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

  function sleepPayload(hours: number) {
    const totalMins = Math.round(hours * 60)
    const sleepH = 22, sleepM = 0
    const wakeTotal = sleepH * 60 + sleepM + totalMins
    const wakeH = Math.floor(wakeTotal / 60) % 24
    const wakeM = wakeTotal % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return { sleep_time: `${pad(sleepH)}:${pad(sleepM)}`, wake_time: `${pad(wakeH)}:${pad(wakeM)}` }
  }

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/entries/${cfg.apiType}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries', date] })
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
      onSuccess()
    },
  })

  const setTotalMut = useMutation({
    mutationFn: async (nextTotal: number) => {
      await Promise.all(entries.map(entry => api.delete(`/entries/${cfg.apiType}/${entry.id as number}`)))
      if (nextTotal <= 0) return
      if (metric === 'sleep') {
        await api.post('/entries/sleep', { ...sleepPayload(Math.min(24, nextTotal)), date })
      } else {
        await api.post(`/entries/${cfg.apiType}`, { [cfg.field]: Math.round(nextTotal), date })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries', date] })
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
      onSuccess()
    },
  })

  function handleAdd() {
    if (readOnly) return
    if (!canAdd) return
    if (metric === 'sleep') {
      addMut.mutate(sleepPayload(cfg.step))
    } else {
      addMut.mutate({ [cfg.field]: cfg.step })
    }
  }

  function startEditing() {
    if (readOnly) return
    setDraft(metric === 'sleep' ? String(Number(value.toFixed(1))) : String(Math.round(value)))
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitDraft() {
    const next = Number(draft)
    setEditing(false)
    if (!Number.isFinite(next) || next < 0 || readOnly) return
    setTotalMut.mutate(metric === 'sleep' ? Math.min(24, next) : next)
  }

  const busy = addMut.isPending || delMut.isPending || setTotalMut.isPending

  return (
    <div
      className="rounded-[1.25rem] bg-surface/95 border border-white/10 px-3.5 py-3.5 relative min-w-0 overflow-hidden"
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden bg-elevated">
        <div className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
      </div>

      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-elevated/80 flex items-center justify-center shrink-0">
          <Icon size={18} style={{ color: cfg.color }} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-300 leading-tight">{cfg.label}</p>
          <p className="text-xs text-gray-500 leading-tight">
            Goal {cfg.format(goal)}{metric === 'water' ? '' : ` ${cfg.unit}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => lastEntry && delMut.mutate(lastEntry.id as number)}
            disabled={readOnly || busy || entries.length === 0}
            aria-label={`Remove last ${cfg.label.toLowerCase()} entry`}
            className="w-11 h-11 md:w-10 md:h-10 rounded-lg bg-elevated flex items-center justify-center
                       hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
          >
            <Minus size={13} />
          </button>

          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min="0"
              max={cfg.max}
              step={metric === 'sleep' ? '0.25' : '1'}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={event => {
                if (event.key === 'Enter') commitDraft()
                if (event.key === 'Escape') setEditing(false)
              }}
              className="!w-20 !min-h-11 !py-1 !px-2 text-center !rounded-lg tabular-nums"
              style={{ color: cfg.color }}
            />
          ) : (
            <button
              type="button"
              onClick={startEditing}
              disabled={readOnly || busy}
              className="min-w-14 min-h-11 text-center text-xl font-bold leading-none tabular-nums disabled:opacity-60"
              style={{ color: cfg.color }}
              aria-label={`Edit ${cfg.label.toLowerCase()} total`}
            >
              {cfg.format(value)}
            </button>
          )}

          <button
            onClick={handleAdd}
            disabled={readOnly || busy || !canAdd}
            aria-label={`Add ${cfg.label.toLowerCase()}`}
            className="w-11 h-11 md:w-10 md:h-10 rounded-lg bg-elevated flex items-center justify-center
                       hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
