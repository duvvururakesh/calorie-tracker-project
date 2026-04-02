import { useState } from 'react'
import { Droplets, Footprints, Weight, Flame, Utensils, Moon, Check } from 'lucide-react'
import type { ActiveLog, MetricType } from './types'
import { SHEET_METRICS } from './types'
import useLogMutation from '@/hooks/useLogMutation'

interface Props {
  activeLog: ActiveLog | null
  setActiveLog: (v: ActiveLog | null) => void
  date: string
  onSuccess: () => void
}

const PILLS: { key: MetricType; label: string; icon: typeof Droplets }[] = [
  { key: 'water',  label: 'Water',  icon: Droplets   },
  { key: 'steps',  label: 'Steps',  icon: Footprints },
  { key: 'weight', label: 'Weight', icon: Weight     },
  { key: 'burnt',  label: 'Burnt',  icon: Flame      },
  { key: 'food',   label: 'Food',   icon: Utensils   },
  { key: 'sleep',  label: 'Sleep',  icon: Moon       },
]

export default function QuickLogStrip({ activeLog, setActiveLog, date, onSuccess }: Props) {
  const expanded = activeLog?.tier === 'strip' ? activeLog.metric : null

  function handlePillClick(key: MetricType) {
    if (SHEET_METRICS.includes(key)) {
      setActiveLog({ tier: 'sheet', metric: key as 'food' | 'sleep' })
    } else if (expanded === key) {
      setActiveLog(null)
    } else {
      setActiveLog({ tier: 'strip', metric: key })
    }
  }

  return (
    <div className="mb-6">
      {/* Pill row */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {PILLS.map(p => {
          const isActive = expanded === p.key
          const Icon = p.icon
          return (
            <button
              key={p.key}
              onClick={() => handlePillClick(p.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm
                transition-all whitespace-nowrap flex-shrink-0
                ${isActive ? 'bg-lime text-black' : 'bg-elevated text-gray-300 hover:text-white'}`}
            >
              <Icon size={14} />
              <span>+{p.label}</span>
            </button>
          )
        })}
      </div>

      {/* Expanded inline form */}
      <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-40 mt-3' : 'max-h-0'}`}>
        {expanded === 'water'  && <WaterMini  date={date} onSuccess={onSuccess} />}
        {expanded === 'steps'  && <SimpleMini date={date} onSuccess={onSuccess} type="steps"  placeholder="Steps" field="steps" />}
        {expanded === 'weight' && <SimpleMini date={date} onSuccess={onSuccess} type="weight" placeholder="kg" field="weight_kg" step="0.1" />}
        {expanded === 'burnt'  && <SimpleMini date={date} onSuccess={onSuccess} type="calories_burnt" placeholder="kcal" field="calories_burnt" />}
      </div>
    </div>
  )
}

/* ─── Water with presets ──────────────────────────────────────────────────── */
function WaterMini({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const mut = useLogMutation('water', date, () => { setAmount(''); onSuccess() })

  function logPreset(ml: number) {
    mut.mutate({ amount_ml: ml })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap bg-surface rounded-xl p-3">
      {[100, 250, 500].map(ml => (
        <button
          key={ml}
          type="button"
          onClick={() => logPreset(ml)}
          disabled={mut.isPending}
          className="px-3 py-1.5 rounded-lg bg-elevated text-sm font-semibold text-info
            hover:bg-info/20 transition-colors disabled:opacity-50"
        >
          +{ml}ml
        </button>
      ))}
      <div className="flex-1 flex items-center gap-1.5 min-w-[120px]">
        <input
          type="number"
          placeholder="Custom ml"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min="0"
          className="!py-1.5 !text-sm !rounded-lg"
        />
        <button
          type="button"
          onClick={() => { if (amount) mut.mutate({ amount_ml: Number(amount) }) }}
          disabled={!amount || mut.isPending}
          className="p-1.5 rounded-lg bg-lime text-black disabled:opacity-40 flex-shrink-0"
        >
          <Check size={16} />
        </button>
      </div>
    </div>
  )
}

/* ─── Generic single-field mini form ──────────────────────────────────────── */
function SimpleMini({ date, onSuccess, type, placeholder, field, step }: {
  date: string; onSuccess: () => void
  type: string; placeholder: string; field: string; step?: string
}) {
  const [value, setValue] = useState('')
  const mut = useLogMutation(type, date, () => { setValue(''); onSuccess() })

  return (
    <div className="flex items-center gap-2 bg-surface rounded-xl p-3">
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        min="0"
        step={step}
        className="!py-1.5 !text-sm !rounded-lg flex-1"
        autoFocus
      />
      <button
        type="button"
        onClick={() => { if (value) mut.mutate({ [field]: Number(value) }) }}
        disabled={!value || mut.isPending}
        className="p-1.5 rounded-lg bg-lime text-black disabled:opacity-40 flex-shrink-0"
      >
        <Check size={16} />
      </button>
    </div>
  )
}
