import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Droplets, Footprints, Weight as WeightIcon, Flame, Utensils, Moon, Pencil, Trash2, X } from 'lucide-react'
import api from '@/api/client'
import Button from '@/components/Button'
import BottomSheet from '@/components/logging/BottomSheet'

interface Props {
  date: string
}

type Entry = Record<string, unknown> & { id: number }
type EntryMap = Record<string, Entry[]>

const SECTIONS = [
  { key: 'food',           label: 'Food',     icon: Utensils,    color: 'text-lime'   },
  { key: 'water',          label: 'Water',    icon: Droplets,    color: 'text-info'   },
  { key: 'weight',         label: 'Weight',   icon: WeightIcon,  color: 'text-lime'   },
  { key: 'steps',          label: 'Steps',    icon: Footprints,  color: 'text-lime'   },
  { key: 'sleep',          label: 'Sleep',    icon: Moon,        color: 'text-accent' },
  { key: 'calories_burnt', label: 'Burnt',    icon: Flame,       color: 'text-accent' },
] as const

type EntryType = typeof SECTIONS[number]['key']
type EditState = { type: EntryType; entry: Entry } | null

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
  const [editing, setEditing] = useState<EditState>(null)
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
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const edit = useMutation({
    mutationFn: ({ type, id, values }: { type: EntryType; id: number; values: Record<string, string> }) =>
      api.put(`/entries/${type}/${id}`, { ...values, date }),
    onSuccess: () => {
      setEditing(null)
      qc.invalidateQueries({ queryKey: ['entries', date] })
      qc.invalidateQueries({ queryKey: ['dashboard', date] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const totalCount = data
    ? SECTIONS.reduce((sum, s) => sum + (data[s.key]?.length || 0), 0)
    : 0

  if (totalCount === 0) return null

  return (
    <div className="mt-5 sm:mt-6 min-w-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="min-h-11 flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors w-full"
      >
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        <span>Today's Log</span>
        <span className="text-xs px-1.5 py-0.5 rounded-md bg-elevated text-gray-400">{totalCount}</span>
      </button>

      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px] mt-3' : 'max-h-0'}`}>
        <div className="rounded-xl sm:rounded-2xl bg-surface p-3 sm:p-4 space-y-2 min-w-0">
          {SECTIONS.map(s => {
            const entries = data?.[s.key] || []
            if (entries.length === 0) return null
            const Icon = s.icon
            return entries.map(e => (
              <div
                key={`${s.key}-${e.id}`}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-elevated min-w-0"
              >
                <Icon size={14} className={`flex-shrink-0 ${s.color}`} />
                <span className="text-sm text-white flex-1 min-w-0 break-words">{formatEntry(s.key, e)}</span>
                <button
                  type="button"
                  onClick={() => setEditing({ type: s.key, entry: e })}
                  aria-label={`Edit ${s.label} entry`}
                  className="w-11 h-11 rounded-full text-gray-300 hover:text-lime hover:bg-lime/10 transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => del.mutate({ type: s.key, id: e.id as number })}
                  aria-label={`Delete ${s.label} entry`}
                  className="w-11 h-11 rounded-full text-danger hover:bg-danger/10 transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))
          })}
        </div>
      </div>

      <BottomSheet
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${SECTIONS.find(s => s.key === editing.type)?.label}` : 'Edit Entry'}
      >
        {editing && (
          <EditLogForm
            key={`${editing.type}-${editing.entry.id}`}
            type={editing.type}
            entry={editing.entry}
            loading={edit.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={values => edit.mutate({ type: editing.type, id: editing.entry.id, values })}
          />
        )}
      </BottomSheet>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-400 mb-1">{label}</span>
      {children}
    </label>
  )
}

function initialEditValues(type: EntryType, entry: Entry): Record<string, string> {
  if (type === 'food') {
    return {
      name: String(entry.name || ''),
      time: String(entry.time || ''),
      calories: String(entry.calories ?? ''),
      protein: String(entry.protein ?? ''),
      carbs: String(entry.carbs ?? ''),
      fat: String(entry.fat ?? ''),
      sugar: String(entry.sugar ?? ''),
    }
  }
  if (type === 'water') return { amount_ml: String(entry.amount_ml ?? '') }
  if (type === 'weight') return { weight_kg: String(entry.weight_kg ?? '') }
  if (type === 'steps') return { steps: String(entry.steps ?? '') }
  if (type === 'sleep') {
    return {
      sleep_time: String(entry.sleep_time || ''),
      wake_time: String(entry.wake_time || ''),
    }
  }
  return { calories_burnt: String(entry.calories_burnt ?? '') }
}

function EditLogForm({
  type, entry, loading, onCancel, onSubmit,
}: {
  type: EntryType
  entry: Entry
  loading: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => initialEditValues(type, entry))

  function setField(key: string, value: string) {
    setValues(current => ({ ...current, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-400">Update this entry directly.</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel edit"
          className="w-11 h-11 rounded-full bg-elevated text-gray-300 hover:text-white flex items-center justify-center flex-shrink-0"
        >
          <X size={17} />
        </button>
      </div>

      {type === 'food' && (
        <>
          <Field label="Food Name">
            <input value={values.name || ''} onChange={e => setField('name', e.target.value)} required />
          </Field>
          <Field label="Time">
            <input type="time" value={values.time || ''} onChange={e => setField('time', e.target.value)} />
          </Field>
          <Field label="Calories">
            <input type="number" min="0" value={values.calories || ''} onChange={e => setField('calories', e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Protein (g)">
              <input type="number" min="0" value={values.protein || ''} onChange={e => setField('protein', e.target.value)} />
            </Field>
            <Field label="Carbs (g)">
              <input type="number" min="0" value={values.carbs || ''} onChange={e => setField('carbs', e.target.value)} />
            </Field>
            <Field label="Fat (g)">
              <input type="number" min="0" value={values.fat || ''} onChange={e => setField('fat', e.target.value)} />
            </Field>
            <Field label="Sugar (g)">
              <input type="number" min="0" value={values.sugar || ''} onChange={e => setField('sugar', e.target.value)} />
            </Field>
          </div>
        </>
      )}

      {type === 'water' && (
        <Field label="Water (ml)">
          <input type="number" min="0" value={values.amount_ml || ''} onChange={e => setField('amount_ml', e.target.value)} required />
        </Field>
      )}

      {type === 'weight' && (
        <Field label="Weight (kg)">
          <input type="number" min="0" step="0.1" value={values.weight_kg || ''} onChange={e => setField('weight_kg', e.target.value)} required />
        </Field>
      )}

      {type === 'steps' && (
        <Field label="Steps">
          <input type="number" min="0" value={values.steps || ''} onChange={e => setField('steps', e.target.value)} required />
        </Field>
      )}

      {type === 'sleep' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sleep Time">
            <input type="time" value={values.sleep_time || ''} onChange={e => setField('sleep_time', e.target.value)} required />
          </Field>
          <Field label="Wake Time">
            <input type="time" value={values.wake_time || ''} onChange={e => setField('wake_time', e.target.value)} required />
          </Field>
        </div>
      )}

      {type === 'calories_burnt' && (
        <Field label="Calories Burnt">
          <input type="number" min="0" value={values.calories_burnt || ''} onChange={e => setField('calories_burnt', e.target.value)} required />
        </Field>
      )}

      <Button type="submit" loading={loading}>Save</Button>
    </form>
  )
}
