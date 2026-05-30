import { cloneElement, isValidElement, useEffect, useId, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, X } from 'lucide-react'
import api from '@/api/client'
import WeekSelector from '@/components/WeekSelector'
import Card from '@/components/Card'
import Button from '@/components/Button'

type Tab = 'food' | 'water' | 'weight' | 'steps' | 'sleep' | 'calories_burnt'
type Entry = Record<string, unknown> & { id: number }
type EditState = { tab: Tab; entry: Entry } | null

const TABS: { key: Tab; label: string }[] = [
  { key: 'food',           label: 'Food'           },
  { key: 'water',          label: 'Water'          },
  { key: 'weight',         label: 'Weight'         },
  { key: 'steps',          label: 'Steps'          },
  { key: 'sleep',          label: 'Sleep'          },
  { key: 'calories_burnt', label: 'Calories Burnt' },
]

/* ─── Shared field wrapper ────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-gray-400 mb-0.5 sm:mb-1">{label}</label>
      {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id: children.props.id || id }) : children}
    </div>
  )
}

/* ─── Section label (same pattern as GoalsPage) ──────────────────────────── */
function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2 sm:mb-3">{title}</p>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function LogPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tab, setTab]   = useState<Tab>('food')
  const [editing, setEditing] = useState<EditState>(null)
  const qc = useQueryClient()

  const { data: entries, isLoading } = useQuery({
    queryKey: ['entries', date],
    queryFn:  () => api.get(`/entries?date=${date}`).then(r => r.data),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['entries', date] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['dashboard', date] })
  }

  function finishEdit() {
    setEditing(null)
    invalidate()
  }

  const del = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) =>
      api.delete(`/entries/${type}/${id}`),
    onSuccess: invalidate,
  })

  return (
    <div className="max-w-2xl mx-auto min-w-0">
      <div className="mb-2 sm:mb-4">
        <p className="text-sm text-gray-400">Add an entry</p>
        <h1 className="text-2xl sm:text-3xl font-bold">Log</h1>
      </div>
      <WeekSelector selectedDate={date} onSelect={nextDate => {
        setDate(nextDate)
        setEditing(null)
      }} />

      <div className="flex flex-nowrap gap-2 mb-2 sm:mb-6 overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key)
              setEditing(null)
            }}
            className="whitespace-nowrap flex-shrink-0 min-h-11 px-4 py-2 rounded-xl font-semibold text-sm transition-colors"
            style={
              tab === t.key
                ? { backgroundColor: 'var(--color-lime)', color: '#000' }
                : { backgroundColor: 'var(--color-elevated)', color: '#ccc' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        {/* Form panel */}
        <Card>
          {tab === 'food' && (
            <FoodForm date={date} editing={editing?.tab === 'food' ? editing.entry : null}
              onCancelEdit={() => setEditing(null)} onSuccess={editing ? finishEdit : invalidate} />
          )}
          {tab === 'water' && (
            <WaterForm date={date} editing={editing?.tab === 'water' ? editing.entry : null}
              onCancelEdit={() => setEditing(null)} onSuccess={editing ? finishEdit : invalidate} />
          )}
          {tab === 'weight' && (
            <WeightForm date={date} editing={editing?.tab === 'weight' ? editing.entry : null}
              onCancelEdit={() => setEditing(null)} onSuccess={editing ? finishEdit : invalidate} />
          )}
          {tab === 'steps' && (
            <StepsForm date={date} editing={editing?.tab === 'steps' ? editing.entry : null}
              onCancelEdit={() => setEditing(null)} onSuccess={editing ? finishEdit : invalidate} />
          )}
          {tab === 'sleep' && (
            <SleepForm date={date} editing={editing?.tab === 'sleep' ? editing.entry : null}
              onCancelEdit={() => setEditing(null)} onSuccess={editing ? finishEdit : invalidate} />
          )}
          {tab === 'calories_burnt' && (
            <CaloriesBurntForm date={date} editing={editing?.tab === 'calories_burnt' ? editing.entry : null}
              onCancelEdit={() => setEditing(null)} onSuccess={editing ? finishEdit : invalidate} />
          )}
        </Card>

        {/* Entry list panel */}
        <Card>
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <EntryList
              tab={tab}
              entries={entries}
              editingId={editing?.tab === tab ? editing.entry.id : null}
              onEdit={entry => setEditing({ tab, entry })}
              onDelete={id => {
                if (editing?.tab === tab && editing.entry.id === id) setEditing(null)
                del.mutate({ type: tab, id })
              }}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

/* ─── Entry list ──────────────────────────────────────────────────────────── */
function EntryList({
  tab, entries, editingId, onEdit, onDelete,
}: {
  tab: Tab
  entries: Record<string, unknown[]> | undefined
  editingId: number | null
  onEdit: (entry: Entry) => void
  onDelete: (id: number) => void
}) {
  const list = (entries?.[tab] || []) as Entry[]
  const title = tab.replace('_', ' ')

  return (
    <div>
      <h3 className="font-bold text-base mb-3 capitalize">{title} Entries</h3>
      {list.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No {title} logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map(e => (
            <li
              key={e.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-elevated min-w-0 ${
                editingId === e.id ? 'ring-1 ring-lime' : ''
              }`}
            >
              <span className="text-sm text-white flex-1 min-w-0 break-words">
                {tab === 'food'           && `${e.name}${e.time ? ` (${e.time})` : ''} — ${Math.round(e.calories as number)} kcal`}
                {tab === 'water'          && `${e.amount_ml} ml`}
                {tab === 'weight'         && `${(e.weight_kg as number).toFixed(1)} kg`}
                {tab === 'steps'          && `${e.steps} steps`}
                {tab === 'sleep'          && `${(e.duration_hours as number).toFixed(1)} hrs`}
                {tab === 'calories_burnt' && `${e.calories_burnt} kcal burnt`}
              </span>
              <button
                type="button"
                onClick={() => onEdit(e)}
                aria-label={`Edit ${title} entry`}
                className="w-11 h-11 rounded-full text-gray-300 hover:text-lime hover:bg-lime/10 transition-colors flex items-center justify-center flex-shrink-0"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(e.id)}
                aria-label={`Delete ${title} entry`}
                className="w-11 h-11 rounded-full text-danger hover:bg-danger/10 transition-colors flex items-center justify-center flex-shrink-0"
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ─── Form components ─────────────────────────────────────────────────────── */

type LogFormProps = {
  date: string
  editing: Entry | null
  onCancelEdit: () => void
  onSuccess: () => void
}

function FormHeading({
  title, editing, onCancelEdit,
}: {
  title: string; editing: boolean; onCancelEdit: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2 sm:mb-4">
      <h3 className="font-bold text-base">{editing ? `Edit ${title}` : `Log ${title}`}</h3>
      {editing && (
        <button
          type="button"
          onClick={onCancelEdit}
          aria-label="Cancel edit"
          className="w-11 h-11 rounded-full bg-elevated text-gray-300 hover:text-white flex items-center justify-center"
        >
          <X size={17} />
        </button>
      )}
    </div>
  )
}

function FoodForm({ date, editing, onCancelEdit, onSuccess }: LogFormProps) {
  const [f, setF] = useState({
    name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editing) {
      setF({
        name: String(editing.name || ''),
        calories: String(editing.calories ?? ''),
        protein: String(editing.protein ?? ''),
        carbs: String(editing.carbs ?? ''),
        fat: String(editing.fat ?? ''),
        sugar: String(editing.sugar ?? ''),
        time: String(editing.time || ''),
      })
    } else {
      setF({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '' })
    }
  }, [editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await api.put(`/entries/food/${editing.id}`, { ...f, date })
      } else {
        await api.post('/entries/food', { ...f, date })
      }
      setF({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '' })
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-3">
      <FormHeading title="Food" editing={Boolean(editing)} onCancelEdit={onCancelEdit} />
      <Field label="Food Name">
        <input type="text" placeholder="e.g. Chicken Rice Bowl"
          value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required />
      </Field>
      <Field label="Time (optional)">
        <input type="time" value={f.time} onChange={e => setF(p => ({ ...p, time: e.target.value }))} />
      </Field>
      <Field label="Calories">
        <input type="number" placeholder="0"
          value={f.calories} onChange={e => setF(p => ({ ...p, calories: e.target.value }))} required min="0" />
      </Field>
      <SectionLabel title="Macros" />
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 gap-2 sm:gap-3">
        <Field label="Protein (g)">
          <input type="number" placeholder="0"
            value={f.protein} onChange={e => setF(p => ({ ...p, protein: e.target.value }))} min="0" />
        </Field>
        <Field label="Carbs (g)">
          <input type="number" placeholder="0"
            value={f.carbs} onChange={e => setF(p => ({ ...p, carbs: e.target.value }))} min="0" />
        </Field>
        <Field label="Fat (g)">
          <input type="number" placeholder="0"
            value={f.fat} onChange={e => setF(p => ({ ...p, fat: e.target.value }))} min="0" />
        </Field>
        <Field label="Sugar (g)">
          <input type="number" placeholder="0"
            value={f.sugar} onChange={e => setF(p => ({ ...p, sugar: e.target.value }))} min="0" />
        </Field>
      </div>
      <div className="flex justify-center"><Button type="submit" loading={loading}>{editing ? 'Save Food' : 'Log Food'}</Button></div>
    </form>
  )
}

function WaterForm({ date, editing, onCancelEdit, onSuccess }: LogFormProps) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setAmount(editing ? String(editing.amount_ml ?? '') : '')
  }, [editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await api.put(`/entries/water/${editing.id}`, { amount_ml: amount, date })
      } else {
        await api.post('/entries/water', { amount_ml: amount, date })
      }
      setAmount('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
      <FormHeading title="Water" editing={Boolean(editing)} onCancelEdit={onCancelEdit} />
      <Field label="Amount (ml)">
        <input type="number" placeholder="250"
          value={amount} onChange={e => setAmount(e.target.value)} required min="0" />
      </Field>
      <div className="flex justify-center"><Button type="submit" loading={loading}>{editing ? 'Save Water' : 'Log Water'}</Button></div>
    </form>
  )
}

function WeightForm({ date, editing, onCancelEdit, onSuccess }: LogFormProps) {
  const [weight, setWeight] = useState('')
  const [unit, setUnit]     = useState<'kg' | 'lbs'>('kg')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setUnit('kg')
    setWeight(editing ? String(editing.weight_kg ?? '') : '')
  }, [editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await api.put(`/entries/weight/${editing.id}`, { weight_kg: weight, unit, date })
      } else {
        await api.post('/entries/weight', { weight_kg: weight, unit, date })
      }
      setWeight('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
      <FormHeading title="Weight" editing={Boolean(editing)} onCancelEdit={onCancelEdit} />
      {/* Unit toggle — same pill style as tabs */}
      <div className="flex gap-2">
        {(['kg', 'lbs'] as const).map(u => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            className="flex-1 min-h-11 py-2 rounded-xl font-semibold text-sm transition-all"
            style={
              unit === u
                ? { backgroundColor: 'var(--color-lime)', color: '#000' }
                : { backgroundColor: 'var(--color-elevated)', color: '#ccc' }
            }
          >
            {u}
          </button>
        ))}
      </div>
      <Field label={`Weight (${unit})`}>
        <input type="number" placeholder="0"
          value={weight} onChange={e => setWeight(e.target.value)} required min="0" step="0.1" />
      </Field>
      <div className="flex justify-center"><Button type="submit" loading={loading}>{editing ? 'Save Weight' : 'Log Weight'}</Button></div>
    </form>
  )
}

function StepsForm({ date, editing, onCancelEdit, onSuccess }: LogFormProps) {
  const [steps, setSteps] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSteps(editing ? String(editing.steps ?? '') : '')
  }, [editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await api.put(`/entries/steps/${editing.id}`, { steps, date })
      } else {
        await api.post('/entries/steps', { steps, date })
      }
      setSteps('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
      <FormHeading title="Steps" editing={Boolean(editing)} onCancelEdit={onCancelEdit} />
      <Field label="Step Count">
        <input type="number" placeholder="0"
          value={steps} onChange={e => setSteps(e.target.value)} required min="0" />
      </Field>
      <div className="flex justify-center"><Button type="submit" loading={loading}>{editing ? 'Save Steps' : 'Log Steps'}</Button></div>
    </form>
  )
}

function SleepForm({ date, editing, onCancelEdit, onSuccess }: LogFormProps) {
  const [sleepTime, setSleepTime] = useState('22:00')
  const [wakeTime,  setWakeTime]  = useState('06:00')
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    setSleepTime(String(editing?.sleep_time || '22:00'))
    setWakeTime(String(editing?.wake_time || '06:00'))
  }, [editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await api.put(`/entries/sleep/${editing.id}`, { sleep_time: sleepTime, wake_time: wakeTime, date })
      } else {
        await api.post('/entries/sleep', { sleep_time: sleepTime, wake_time: wakeTime, date })
      }
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
      <FormHeading title="Sleep" editing={Boolean(editing)} onCancelEdit={onCancelEdit} />
      <Field label="Sleep Time">
        <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} />
      </Field>
      <Field label="Wake Time">
        <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} />
      </Field>
      <div className="flex justify-center"><Button type="submit" loading={loading}>{editing ? 'Save Sleep' : 'Log Sleep'}</Button></div>
    </form>
  )
}

function CaloriesBurntForm({ date, editing, onCancelEdit, onSuccess }: LogFormProps) {
  const [calories, setCalories] = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setCalories(editing ? String(editing.calories_burnt ?? '') : '')
  }, [editing])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (editing) {
        await api.put(`/entries/calories_burnt/${editing.id}`, { calories_burnt: calories, date })
      } else {
        await api.post('/entries/calories_burnt', { calories_burnt: calories, date })
      }
      setCalories('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
      <FormHeading title="Calories Burnt" editing={Boolean(editing)} onCancelEdit={onCancelEdit} />
      <Field label="Calories Burnt">
        <input type="number" placeholder="0"
          value={calories} onChange={e => setCalories(e.target.value)} required min="0" />
      </Field>
      <div className="flex justify-center"><Button type="submit" loading={loading}>{editing ? 'Save Calories' : 'Log Calories Burnt'}</Button></div>
    </form>
  )
}
