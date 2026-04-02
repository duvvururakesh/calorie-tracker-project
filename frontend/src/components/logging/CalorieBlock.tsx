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
    label: 'INTAKE',
    color: '#C7FF41',
    step: 100,
    apiType: 'food',
    entryKey: 'food',
    buildPayload: (n: number) => ({ name: 'Quick add', calories: n }),
  },
  burnt: {
    label: 'BURNT',
    color: '#A970FF',
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
    <div className="flex flex-col items-center justify-center text-center min-h-[120px]">
      <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">{cfg.label}</p>

      {/* − ring + on one line */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => lastEntry && delMut.mutate(lastEntry.id as number)}
          disabled={busy || entries.length === 0}
          className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center
                     hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
        >
          <Minus size={13} />
        </button>

        {/* Ring with number + goal inside */}
        <div className="relative">
          <RingChart value={value} goal={goal} color={cfg.color} size={110} />
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
                className="text-xl font-bold leading-none pointer-events-auto"
                style={{ color: cfg.color }}
              >
                {Math.round(value)}
              </button>
            )}
            <span className="text-xs text-gray-400">/ {goal}</span>
          </div>
        </div>

        <button
          onClick={() => addMut.mutate(cfg.buildPayload(cfg.step))}
          disabled={busy}
          className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center
                     hover:bg-[#3A3A3A] transition-colors disabled:opacity-30"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}
