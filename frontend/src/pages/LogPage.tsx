import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'
import WeekSelector from '@/components/WeekSelector'

type Tab = 'food' | 'water' | 'weight' | 'steps' | 'sleep' | 'calories_burnt'

const TABS: { key: Tab; label: string }[] = [
  { key: 'food', label: 'Food' },
  { key: 'water', label: 'Water' },
  { key: 'weight', label: 'Weight' },
  { key: 'steps', label: 'Steps' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'calories_burnt', label: 'Calories Burnt' },
]

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#1E1E1E' }}>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="mb-3" />
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold transition-opacity"
            style={{ backgroundColor: '#C7FF41', color: '#000' }}>
      {loading ? 'Saving…' : label}
    </button>
  )
}

export default function LogPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [tab, setTab] = useState<Tab>('food')
  const qc = useQueryClient()

  const { data: entries, isLoading } = useQuery({
    queryKey: ['entries', date],
    queryFn: () => api.get(`/entries?date=${date}`).then(r => r.data),
  })

  function invalidate() { qc.invalidateQueries({ queryKey: ['entries', date] }); qc.invalidateQueries({ queryKey: ['dashboard'] }) }

  const del = useMutation({
    mutationFn: ({ type, id }: { type: string; id: number }) =>
      api.delete(`/entries/${type}/${id}`),
    onSuccess: invalidate,
  })

  return (
    <div>
      <WeekSelector selectedDate={date} onSelect={setDate} />

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className="whitespace-nowrap flex-shrink-0 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
                  style={tab === t.key
                    ? { backgroundColor: '#C7FF41', color: '#000' }
                    : { backgroundColor: '#2A2A2A', color: '#ccc' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Forms */}
        <Card>
          {tab === 'food' && <FoodForm date={date} onSuccess={invalidate} />}
          {tab === 'water' && <WaterForm date={date} onSuccess={invalidate} />}
          {tab === 'weight' && <WeightForm date={date} onSuccess={invalidate} />}
          {tab === 'steps' && <StepsForm date={date} onSuccess={invalidate} />}
          {tab === 'sleep' && <SleepForm date={date} onSuccess={invalidate} />}
          {tab === 'calories_burnt' && <CaloriesBurntForm date={date} onSuccess={invalidate} />}
        </Card>

        {/* Logged entries */}
        <Card>
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : (
            <EntryList tab={tab} entries={entries} onDelete={(id) => del.mutate({ type: tab, id })} />
          )}
        </Card>
      </div>
    </div>
  )
}

function EntryList({ tab, entries, onDelete }: { tab: Tab; entries: any; onDelete: (id: number) => void }) {
  const list = entries?.[tab] || []
  return (
    <div>
      <h3 className="font-bold text-lg mb-3 capitalize">{tab.replace('_', ' ')} Entries</h3>
      {list.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">No {tab.replace('_', ' ')} logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((e: any) => (
            <li key={e.id} className="flex justify-between items-center p-3 rounded-xl"
                style={{ backgroundColor: '#2A2A2A' }}>
              <span className="text-sm text-gray-200">
                {tab === 'food' && `${e.name}${e.time ? ` (${e.time})` : ''} — ${Math.round(e.calories)} kcal`}
                {tab === 'water' && `${e.amount_ml} ml`}
                {tab === 'weight' && `${e.weight_kg.toFixed(1)} kg`}
                {tab === 'steps' && `${e.steps} steps`}
                {tab === 'sleep' && `${e.duration_hours.toFixed(1)} hrs`}
                {tab === 'calories_burnt' && `${e.calories_burnt} kcal burnt`}
              </span>
              <button onClick={() => onDelete(e.id)} className="text-xs font-semibold"
                      style={{ color: '#FF375F' }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FoodForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [f, setF] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '' })
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try { await api.post('/entries/food', { ...f, date }); setF({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '' }); onSuccess() }
    finally { setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-bold text-lg mb-4">Log Food</h3>
      <Input type="text" placeholder="Food Name" value={f.name} onChange={e => setF(p => ({...p, name: e.target.value}))} required />
      <Input type="time" value={f.time} onChange={e => setF(p => ({...p, time: e.target.value}))} />
      <Input type="number" placeholder="Calories" value={f.calories} onChange={e => setF(p => ({...p, calories: e.target.value}))} required min="0" />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input type="number" placeholder="Protein (g)" value={f.protein} onChange={e => setF(p => ({...p, protein: e.target.value}))} min="0" />
        <input type="number" placeholder="Carbs (g)" value={f.carbs} onChange={e => setF(p => ({...p, carbs: e.target.value}))} min="0" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <input type="number" placeholder="Fat (g)" value={f.fat} onChange={e => setF(p => ({...p, fat: e.target.value}))} min="0" />
        <input type="number" placeholder="Sugar (g)" value={f.sugar} onChange={e => setF(p => ({...p, sugar: e.target.value}))} min="0" />
      </div>
      <SubmitBtn loading={loading} label="Log Food" />
    </form>
  )
}

function WaterForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try { await api.post('/entries/water', { amount_ml: amount, date }); setAmount(''); onSuccess() }
    finally { setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-bold text-lg mb-4">Log Water</h3>
      <Input type="number" placeholder="Amount (ml)" value={amount} onChange={e => setAmount(e.target.value)} required min="0" />
      <SubmitBtn loading={loading} label="Log Water" />
    </form>
  )
}

function WeightForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try { await api.post('/entries/weight', { weight_kg: weight, unit, date }); setWeight(''); onSuccess() }
    finally { setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-bold text-lg mb-4">Log Weight</h3>
      <div className="flex gap-2 mb-3">
        {(['kg', 'lbs'] as const).map(u => (
          <button key={u} type="button" onClick={() => setUnit(u)}
                  className="flex-1 py-2 rounded-xl font-semibold text-sm transition-all"
                  style={unit === u ? { backgroundColor: '#C7FF41', color: '#000' } : { backgroundColor: '#2A2A2A', color: '#ccc' }}>
            {u}
          </button>
        ))}
      </div>
      <Input type="number" placeholder={`Weight (${unit})`} value={weight} onChange={e => setWeight(e.target.value)} required min="0" step="0.1" />
      <SubmitBtn loading={loading} label="Log Weight" />
    </form>
  )
}

function StepsForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [steps, setSteps] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try { await api.post('/entries/steps', { steps, date }); setSteps(''); onSuccess() }
    finally { setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-bold text-lg mb-4">Log Steps</h3>
      <Input type="number" placeholder="Steps" value={steps} onChange={e => setSteps(e.target.value)} required min="0" />
      <SubmitBtn loading={loading} label="Log Steps" />
    </form>
  )
}

function SleepForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [sleepTime, setSleepTime] = useState('22:00')
  const [wakeTime, setWakeTime] = useState('06:00')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try { await api.post('/entries/sleep', { sleep_time: sleepTime, wake_time: wakeTime, date }); onSuccess() }
    finally { setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-bold text-lg mb-4">Log Sleep</h3>
      <label className="block text-sm text-gray-400 mb-1">Sleep Time</label>
      <Input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} />
      <label className="block text-sm text-gray-400 mb-1">Wake Time</label>
      <Input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} />
      <SubmitBtn loading={loading} label="Log Sleep" />
    </form>
  )
}

function CaloriesBurntForm({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [calories, setCalories] = useState('')
  const [loading, setLoading] = useState(false)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try { await api.post('/entries/calories_burnt', { calories_burnt: calories, date }); setCalories(''); onSuccess() }
    finally { setLoading(false) }
  }
  return (
    <form onSubmit={handleSubmit}>
      <h3 className="font-bold text-lg mb-4">Log Calories Burnt</h3>
      <Input type="number" placeholder="Calories Burnt" value={calories} onChange={e => setCalories(e.target.value)} required min="0" />
      <SubmitBtn loading={loading} label="Log Calories Burnt" />
    </form>
  )
}
