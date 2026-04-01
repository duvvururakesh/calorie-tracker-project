import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} min="0" step="0.1" />
    </div>
  )
}

type Goals = { calorie_goal: string; calories_burnt_goal: string; protein_goal: string; carbs_goal: string; fat_goal: string; sugar_goal: string; water_goal: string; step_goal: string; sleep_goal: string }

export default function GoalsPage() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['goals'], queryFn: () => api.get('/goals').then((r: { data: Record<string, number> }) => r.data) })

  const [g, setG] = useState<Goals>({ calorie_goal: '', calories_burnt_goal: '', protein_goal: '', carbs_goal: '', fat_goal: '', sugar_goal: '', water_goal: '', step_goal: '', sleep_goal: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setG(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) as Goals)
  }, [data])

  const mut = useMutation({
    mutationFn: () => api.put('/goals', Object.fromEntries(Object.entries(g).map(([k, v]) => [k, Number(v)]))),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setSaved(true); setTimeout(() => setSaved(false), 2500) },
  })

  function f(key: keyof Goals) {
    return { value: g[key], onChange: (v: string) => setG(p => ({ ...p, [key]: v })) }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6" style={{ color: '#C7FF41' }}>Goals</h1>
      <div className="rounded-2xl p-6 space-y-6" style={{ backgroundColor: '#1E1E1E' }}>
        <Section title="Calories">
          <Field label="Calorie Goal" {...f('calorie_goal')} />
          <Field label="Calories Burnt Goal" {...f('calories_burnt_goal')} />
        </Section>
        <hr style={{ borderColor: '#2A2A2A' }} />
        <Section title="Macros">
          <Field label="Protein Goal (g)" {...f('protein_goal')} />
          <Field label="Carbs Goal (g)" {...f('carbs_goal')} />
          <Field label="Fat Goal (g)" {...f('fat_goal')} />
          <Field label="Sugar Goal (g)" {...f('sugar_goal')} />
        </Section>
        <hr style={{ borderColor: '#2A2A2A' }} />
        <Section title="Activity">
          <Field label="Water Goal (ml)" {...f('water_goal')} />
          <Field label="Step Goal" {...f('step_goal')} />
          <Field label="Sleep Goal (hrs)" {...f('sleep_goal')} />
        </Section>
        <button onClick={() => mut.mutate()} className="w-full py-3 rounded-xl font-bold mt-2"
                style={{ backgroundColor: saved ? '#a8d435' : '#C7FF41', color: '#000' }}>
          {saved ? 'Saved!' : mut.isPending ? 'Saving…' : 'Update Goals'}
        </button>
      </div>
    </div>
  )
}
