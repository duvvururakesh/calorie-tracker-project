import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import RingChart from '@/components/RingChart'
import useLogMutation from '@/hooks/useLogMutation'
import api from '@/api/client'

type Kind = 'intake' | 'burnt'

interface Props {
  kind: Kind
  value: number
  goal: number
  date: string
  onSuccess: () => void
}

const CFG = {
  intake: {
    label: 'Move',
    color: 'var(--color-move)',
    step: 100,
    apiType: 'food',
    entryKey: 'food',
    buildPayload: (n: number) => ({ name: 'Quick add', calories: n }),
  },
  burnt: {
    label: 'Exercise',
    color: 'var(--color-exercise)',
    step: 50,
    apiType: 'calories_burnt',
    entryKey: 'calories_burnt',
    buildPayload: (n: number) => ({ calories_burnt: n }),
  },
}

export default function CalorieBlock({ kind, value, goal, date, onSuccess }: Props) {
  const [editing, setEditing]   = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const cfg = CFG[kind]

  const { data: entriesData } = useQuery<Record<string, Record<string, unknown>[]>>({
    queryKey: ['entries', date],
    queryFn: () => api.get(`/entries?date=${date}`).then(r => r.data),
  })
  const entries   = entriesData?.[cfg.entryKey] || []
  const lastEntry = entries[entries.length - 1]

  const addMut = useLogMutation(cfg.apiType, date, onSuccess)

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/entries/${cfg.apiType}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries', date] })
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
      onSuccess()
    },
  })

  const busy = addMut.isPending || delMut.isPending

  function startEditing() {
    setInputVal('')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commitCustom() {
    const v = parseInt(inputVal, 10)
    if (!isNaN(v) && v > 0) addMut.mutate(cfg.buildPayload(v))
    setEditing(false)
    setInputVal('')
  }

  return (
    <div className="min-h-[146px]">
      <div className="mb-2 pr-2">
        <p className="text-[13px] font-semibold text-gray-400">
          {kind === 'burnt' ? 'Active calories' : cfg.label}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {kind === 'burnt' ? 'Exercise' : 'Calories'}
        </h2>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        <button
          onClick={() => lastEntry && delMut.mutate(lastEntry.id as number)}
          disabled={busy || entries.length === 0}
          aria-label={`Remove last ${cfg.label.toLowerCase()} entry`}
          className="w-11 h-11 rounded-full bg-elevated flex items-center justify-center flex-shrink-0
                     hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
        >
          <Minus size={18} strokeWidth={3} />
        </button>

        <div className="relative flex-shrink-0">
          <RingChart value={value} goal={goal} color={cfg.color} size={116} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {editing ? (
              <input
                ref={inputRef}
                type="number"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onBlur={commitCustom}
                onKeyDown={e => { if (e.key === 'Enter') commitCustom() }}
                className="w-14 text-center !py-0 !text-lg font-bold !rounded-md pointer-events-auto"
                style={{ color: cfg.color }}
                min="1"
                placeholder="0"
              />
            ) : (
              <button
                onClick={startEditing}
                aria-label={`Enter custom ${cfg.label.toLowerCase()} amount`}
                className="min-w-11 min-h-11 flex items-center justify-center text-2xl font-bold tracking-tight leading-none pointer-events-auto"
                style={{ color: cfg.color }}
              >
                {Math.round(value)}
              </button>
            )}
            <span className="text-xs text-gray-400">{kind === 'burnt' ? 'CAL' : 'CAL'}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-gray-500">Goal</p>
          <p className="text-[28px] leading-none font-semibold tracking-tight tabular-nums" style={{ color: cfg.color }}>
            {goal} <span className="text-sm text-gray-400">CAL</span>
          </p>
          <p className="mt-2 text-sm font-semibold leading-tight text-gray-300">
            {Math.max(0, Math.round(goal - value))} left
          </p>
        </div>

        <button
          onClick={() => addMut.mutate(cfg.buildPayload(cfg.step))}
          disabled={busy}
          aria-label={`Add ${cfg.label.toLowerCase()}`}
          className="w-11 h-11 rounded-full bg-elevated flex items-center justify-center flex-shrink-0
                     hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
        >
          <Plus size={18} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}
