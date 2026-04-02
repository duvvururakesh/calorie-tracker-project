import { useState } from 'react'
import useLogMutation from '@/hooks/useLogMutation'
import Button from '@/components/Button'
import Alert from '@/components/Alert'

interface Props {
  date: string
  onSuccess: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function FoodSheetForm({ date, onSuccess }: Props) {
  const [f, setF] = useState({
    name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '',
  })
  const [saved, setSaved] = useState('')

  const mut = useLogMutation('food', date, () => {
    setSaved(`Logged: ${f.name || 'Food'} — ${f.calories} kcal`)
    setF({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', time: '' })
    onSuccess()
    setTimeout(() => setSaved(''), 2500)
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mut.mutate(f)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {saved && <Alert message={saved} type="success" />}
      <Field label="Food Name">
        <input type="text" placeholder="e.g. Chicken Rice Bowl"
          value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories">
          <input type="number" placeholder="0"
            value={f.calories} onChange={e => setF(p => ({ ...p, calories: e.target.value }))} required min="0" />
        </Field>
        <Field label="Time (optional)">
          <input type="time" value={f.time} onChange={e => setF(p => ({ ...p, time: e.target.value }))} />
        </Field>
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 pt-1">Macros</p>
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
      <Button type="submit" loading={mut.isPending}>Log Food</Button>
    </form>
  )
}
