import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import WeekSelector from '@/components/WeekSelector'
import Card from '@/components/Card'
import Button from '@/components/Button'

type Tab = 'food' | 'water' | 'weight' | 'steps' | 'sleep' | 'calories_burnt'

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
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

/* ─── Section label (same pattern as GoalsPage) ──────────────────────────── */
function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">{title}</p>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function LogPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tab, setTab]   = useState<Tab>('food')
  const qc = useQueryClient()

  const { data: entries, isLoading } = useQuery({
    queryKey: ['entries', date],
    queryFn:  () => api.get(`/entries?date=${date}`).then(r => r.data),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['entries', date] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const del = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) =>
      api.delete(`/entries/${type}/${id}`),
    onSuccess: invalidate,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Log</h1>
      <WeekSelector selectedDate={date} onSelect={setDate} />

      {/* Tab bar — pill style */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="whitespace-nowrap flex-shrink-0 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form panel */}
        <Card>
          {tab === 'food'           && <FoodForm          date={date} onSuccess={invalidate} />}
          {tab === 'water'          && <WaterForm         date={date} onSuccess={invalidate} />}
          {tab === 'weight'         && <WeightForm        date={date} onSuccess={invalidate} />}
          {tab === 'steps'          && <StepsForm         date={date} onSuccess={invalidate} />}
          {tab === 'sleep'          && <SleepForm         date={date} onSuccess={invalidate} />}
          {tab === 'calories_burnt' && <CaloriesBurntForm date={date} onSuccess={invalidate} />}
        </Card>

        {/* Entry list panel */}
        <Card>
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <EntryList
              tab={tab}
              entries={entries}
              onDelete={id => del.mutate({ type: tab, id })}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

/* ─── Entry list ──────────────────────────────────────────────────────────── */
function EntryList({
  tab, entries, onDelete,
}: {
  tab: Tab; entries: Record<string, unknown[]> | undefined; onDelete: (id: number) => void
}) {
  const list = (entries?.[tab] || []) as Record<string, unknown>[]
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
              key={e.id as number}
              className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-elevated"
            >
              <span className="text-sm text-white">
                {tab === 'food'           && `${e.name}${e.time ? ` (${e.time})` : ''} — ${Math.round(e.calories as number)} kcal`}
                {tab === 'water'          && `${e.amount_ml} ml`}
                {tab === 'weight'         && `${(e.weight_kg as number).toFixed(1)} kg`}
                {tab === 'steps'          && `${e.steps} steps`}
                {tab === 'sleep'          && `${(e.duration_hours as number).toFixed(1)} hrs`}
                {tab === 'calories_burnt' && `${e.calories_burnt} kcal burnt`}
              </span>
              <button
                onClick={() => onDelete(e.id as number)}
                className="text-xs font-semibold text-danger px-2 py-1 rounded-lg hover:bg-danger/10 transition-colors ml-2 flex-shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ─── Form components ─────────────────────────────────────────────────────── */

function FoodForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [f, setF] = useState({
    name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '',
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/entries/food', { ...f, date })
      setF({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '' })
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-base mb-4">Log Food</h3>
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
      <div className="grid grid-cols-2 gap-3">
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
      <Button type="submit" loading={loading}>Log Food</Button>
    </form>
  )
}

function WaterForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/entries/water', { amount_ml: amount, date })
      setAmount('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-base mb-4">Log Water</h3>
      <Field label="Amount (ml)">
        <input type="number" placeholder="250"
          value={amount} onChange={e => setAmount(e.target.value)} required min="0" />
      </Field>
      <Button type="submit" loading={loading}>Log Water</Button>
    </form>
  )
}

function WeightForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [weight, setWeight] = useState('')
  const [unit, setUnit]     = useState<'kg' | 'lbs'>('kg')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/entries/weight', { weight_kg: weight, unit, date })
      setWeight('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-base mb-4">Log Weight</h3>
      {/* Unit toggle — same pill style as tabs */}
      <div className="flex gap-2">
        {(['kg', 'lbs'] as const).map(u => (
          <button
            key={u}
            type="button"
            onClick={() => setUnit(u)}
            className="flex-1 py-2 rounded-xl font-semibold text-sm transition-all"
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
      <Button type="submit" loading={loading}>Log Weight</Button>
    </form>
  )
}

function StepsForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [steps, setSteps] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/entries/steps', { steps, date })
      setSteps('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-base mb-4">Log Steps</h3>
      <Field label="Step Count">
        <input type="number" placeholder="0"
          value={steps} onChange={e => setSteps(e.target.value)} required min="0" />
      </Field>
      <Button type="submit" loading={loading}>Log Steps</Button>
    </form>
  )
}

function SleepForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [sleepTime, setSleepTime] = useState('22:00')
  const [wakeTime,  setWakeTime]  = useState('06:00')
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/entries/sleep', { sleep_time: sleepTime, wake_time: wakeTime, date })
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-base mb-4">Log Sleep</h3>
      <Field label="Sleep Time">
        <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} />
      </Field>
      <Field label="Wake Time">
        <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} />
      </Field>
      <Button type="submit" loading={loading}>Log Sleep</Button>
    </form>
  )
}

function CaloriesBurntForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [calories, setCalories] = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/entries/calories_burnt', { calories_burnt: calories, date })
      setCalories('')
      onSuccess()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="font-bold text-base mb-4">Log Calories Burnt</h3>
      <Field label="Calories Burnt">
        <input type="number" placeholder="0"
          value={calories} onChange={e => setCalories(e.target.value)} required min="0" />
      </Field>
      <Button type="submit" loading={loading}>Log Calories Burnt</Button>
    </form>
  )
}
