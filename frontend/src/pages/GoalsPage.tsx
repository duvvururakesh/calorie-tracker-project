import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/api/client'

type Goals = {
  calorie_goal: string
  calories_burnt_goal: string
  protein_goal: string
  carbs_goal: string
  fat_goal: string
  sugar_goal: string
  water_goal: string
  step_goal: string
  sleep_goal: string
}

type GoalKey = keyof Goals

type GoalConfig = {
  key: GoalKey
  title: string
  unit: string
  min: number
  step: number
  color: string
  inputStep?: string
}

const EMPTY: Goals = {
  calorie_goal: '',
  calories_burnt_goal: '',
  protein_goal: '',
  carbs_goal: '',
  fat_goal: '',
  sugar_goal: '',
  water_goal: '',
  step_goal: '',
  sleep_goal: '',
}

const GOALS: GoalConfig[] = [
  {
    key: 'calorie_goal',
    title: 'Intake',
    unit: 'CALORIES/DAY',
    min: 100,
    step: 10,
    color: 'var(--color-move)',
  },
  {
    key: 'calories_burnt_goal',
    title: 'Exercise',
    unit: 'CALORIES/DAY',
    min: 50,
    step: 10,
    color: 'var(--color-exercise)',
  },
  {
    key: 'water_goal',
    title: 'Water',
    unit: 'ML/DAY',
    min: 250,
    step: 250,
    color: 'var(--color-stand)',
  },
  {
    key: 'step_goal',
    title: 'Steps',
    unit: 'STEPS/DAY',
    min: 0,
    step: 500,
    color: 'var(--color-lime)',
  },
  {
    key: 'sleep_goal',
    title: 'Sleep',
    unit: 'HOURS/NIGHT',
    min: 0,
    step: 0.5,
    inputStep: '0.5',
    color: 'var(--color-accent)',
  },
  {
    key: 'protein_goal',
    title: 'Protein',
    unit: 'GRAMS/DAY',
    min: 0,
    step: 5,
    color: 'var(--color-move)',
  },
  {
    key: 'carbs_goal',
    title: 'Carbs',
    unit: 'GRAMS/DAY',
    min: 0,
    step: 5,
    color: 'var(--color-stand)',
  },
  {
    key: 'fat_goal',
    title: 'Fat',
    unit: 'GRAMS/DAY',
    min: 0,
    step: 5,
    color: '#FFD60A',
  },
  {
    key: 'sugar_goal',
    title: 'Sugar',
    unit: 'GRAMS/DAY',
    min: 0,
    step: 5,
    color: 'var(--color-accent)',
  },
]

function toPayload(goals: Goals) {
  return Object.fromEntries(Object.entries(goals).map(([key, value]) => [key, Number(value || 0)]))
}

function GoalRow({
  goal,
  value,
  onChange,
}: {
  goal: GoalConfig
  value: string
  onChange: (value: string) => void
}) {
  const numeric = Number(value || 0)

  function nudge(delta: number) {
    const next = Math.max(goal.min, numeric + delta)
    onChange(String(Number.isInteger(next) ? next : Number(next.toFixed(1))))
  }

  return (
    <section className="border-b border-white/10 py-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight">{goal.title}</h2>
        </div>
        <p className="text-[11px] font-bold text-gray-500 text-right leading-tight">{goal.unit}</p>
      </div>

      <div className="mt-2 grid grid-cols-[44px_1fr_44px] items-center gap-5">
        <button
          type="button"
          onClick={() => nudge(-goal.step)}
          className="min-h-11 text-[30px] font-semibold leading-none flex items-center justify-center"
          style={{ color: goal.color }}
          aria-label={`Decrease ${goal.title}`}
        >
          -
        </button>

        <input
          aria-label={`${goal.title} goal`}
          className="h-14 text-center text-[32px] font-semibold tabular-nums"
          style={{ backgroundColor: 'transparent', borderColor: 'transparent', boxShadow: 'none' }}
          type="number"
          inputMode="decimal"
          min={goal.min}
          step={goal.inputStep || '1'}
          value={value}
          placeholder="0"
          onChange={event => onChange(event.target.value)}
        />

        <button
          type="button"
          onClick={() => nudge(goal.step)}
          className="min-h-11 text-[30px] font-semibold leading-none flex items-center justify-center"
          style={{ color: goal.color }}
          aria-label={`Increase ${goal.title}`}
        >
          +
        </button>
      </div>

    </section>
  )
}

export default function GoalsPage() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then((r: { data: Record<string, number> }) => r.data),
  })

  const [goals, setGoals] = useState<Goals>(EMPTY)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (data) setGoals(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])) as Goals)
  }, [data])

  const mut = useMutation({
    mutationFn: (nextGoals: Goals) => api.put('/goals', toPayload(nextGoals)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  function setGoal(key: GoalKey, value: string) {
    const next = { ...goals, [key]: value }
    setGoals(next)
    mut.mutate(next)
  }

  return (
    <div className="max-w-2xl mx-auto min-w-0 pb-4">
      <div className="mb-5">
        <p className="text-[13px] font-semibold uppercase text-gray-500">Goals</p>
        <h1 className="text-[34px] font-bold tracking-tight leading-none">Daily Targets</h1>
      </div>

      <div>
        {GOALS.map(goal => (
          <GoalRow
            key={goal.key}
            goal={goal}
            value={goals[goal.key]}
            onChange={value => setGoal(goal.key, value)}
          />
        ))}
      </div>
    </div>
  )
}
