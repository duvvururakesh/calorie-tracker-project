import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Droplets, Footprints, Weight as WeightIcon, Flame, Utensils, Moon } from 'lucide-react'
import api from '@/api/client'

interface Props {
  date: string
}

type EntryMap = Record<string, Record<string, unknown>[]>

const SECTIONS = [
  { key: 'food',           label: 'Food',     icon: Utensils,    color: 'text-lime'   },
  { key: 'water',          label: 'Water',    icon: Droplets,    color: 'text-info'   },
  { key: 'weight',         label: 'Weight',   icon: WeightIcon,  color: 'text-lime'   },
  { key: 'steps',          label: 'Steps',    icon: Footprints,  color: 'text-lime'   },
  { key: 'sleep',          label: 'Sleep',    icon: Moon,        color: 'text-accent' },
  { key: 'calories_burnt', label: 'Burnt',    icon: Flame,       color: 'text-accent' },
] as const

function formatEntry(type: string, e: Record<string, unknown>): string {
  switch (type) {
    case 'food':           return `${e.name}${e.time ? ` (${e.time})` : ''} — ${Math.round(e.calories as number)} kcal`
    case 'water':          return `${e.amount_ml} ml`
    case 'weight':         return `${(e.weight_kg as number).toFixed(1)} kg`
    case 'steps':          return `${e.steps} steps`
    case 'sleep':          return `${(e.duration_hours as number).toFixed(1)} hrs`
    case 'calories_burnt': return `${e.calories_burnt} kcal`
    default:               return ''
  }
}

export default function TodaysLog({ date }: Props) {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data } = useQuery<EntryMap>({
    queryKey: ['entries', date],
    queryFn: () => api.get(`/entries?date=${date}`).then(r => r.data),
  })

  const del = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) =>
      api.delete(`/entries/${type}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries', date] })
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
    },
  })

  const totalCount = data
    ? SECTIONS.reduce((sum, s) => sum + (data[s.key]?.length || 0), 0)
    : 0

  if (totalCount === 0) return null

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors w-full"
      >
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span>Today's Log</span>
        <span className="text-xs px-1.5 py-0.5 rounded-md bg-elevated text-gray-400">{totalCount}</span>
      </button>

      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px] mt-3' : 'max-h-0'}`}>
        <div className="rounded-2xl bg-surface p-4 space-y-2">
          {SECTIONS.map(s => {
            const entries = data?.[s.key] || []
            if (entries.length === 0) return null
            const Icon = s.icon
            return entries.map(e => (
              <div
                key={`${s.key}-${e.id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-elevated"
              >
                <Icon size={14} className={`flex-shrink-0 ${s.color}`} />
                <span className="text-sm text-white flex-1">{formatEntry(s.key, e)}</span>
                <button
                  onClick={() => del.mutate({ type: s.key, id: e.id as number })}
                  className="text-xs text-danger px-2 py-1 rounded-lg hover:bg-danger/10
                    transition-colors flex-shrink-0 font-semibold"
                >
                  Delete
                </button>
              </div>
            ))
          })}
        </div>
      </div>
    </div>
  )
}
