import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import api from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import WeekSelector from '@/components/WeekSelector'
import RingChart from '@/components/RingChart'
import Card from '@/components/Card'
import Spinner from '@/components/Spinner'

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function MetricTile({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string
}) {
  return (
    <Card className="flex flex-col items-center justify-center text-center min-h-[120px]">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </Card>
  )
}

function ProgressRow({ label, value, goal, color }: {
  label: string; value: number; goal: number; color: string
}) {
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0)
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-gray-400">{Math.round(value)} / {goal}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-elevated">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/* ─── Shared chart constants ──────────────────────────────────────────────── */
const TICK  = { fill: '#9CA3AF', fontSize: 10 }
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-surface)',
  border: 'none',
  borderRadius: 8,
  fontSize: 12,
}

/* ─── Macro config ────────────────────────────────────────────────────────── */
const MACRO_COLORS = {
  Protein: '#FF375F',
  Carbs:   '#5BEAFF',
  Fat:     '#FFD60A',
  Sugar:   '#A970FF',
} as const

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const { user } = useAuth()
  const [date, setDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [showLbs, setShowLbs] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', date],
    queryFn:  () => api.get(`/dashboard?date=${date}`).then(r => r.data),
  })

  if (isLoading) return <Spinner />

  const { totals, goals, metrics, weight_kg, weight_lbs, chart } = data

  const macros = [
    { name: 'Protein', value: totals.protein,      goal: goals.protein_goal,      color: MACRO_COLORS.Protein },
    { name: 'Carbs',   value: totals.carbs,         goal: goals.carbs_goal,         color: MACRO_COLORS.Carbs   },
    { name: 'Fat',     value: totals.fat,           goal: goals.fat_goal,           color: MACRO_COLORS.Fat     },
    { name: 'Sugar',   value: totals.sugar,         goal: goals.sugar_goal,         color: MACRO_COLORS.Sugar   },
  ]

  const weightData = chart.weight_labels.map((l: string, i: number) => ({ date: l, kg:  chart.weight_values[i] }))
  const sleepData  = chart.sleep_labels.map( (l: string, i: number) => ({ date: l, hrs: chart.sleep_values[i]  }))

  const deficit      = Number(metrics.calorie_deficit)
  const deficitColor = isNaN(deficit) || metrics.calorie_deficit === 'N/A'
    ? 'var(--color-info)'
    : deficit >= 0
      ? 'var(--color-lime)'
      : 'var(--color-danger)'

  return (
    <div>
      {/* Page header */}
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-400">
          Welcome, <span className="text-white font-semibold">{user?.profile_name || user?.username}</span>
        </p>
      </div>

      <WeekSelector selectedDate={date} onSelect={setDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: metrics ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Calorie Intake ring */}
          <Card className="flex flex-col items-center justify-center text-center">
            <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Intake</p>
            <div className="relative">
              <RingChart value={totals.calories} goal={goals.calorie_goal} color="#C7FF41" size={110} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-lime">{Math.round(totals.calories)}</span>
                <span className="text-xs text-gray-400">/ {goals.calorie_goal}</span>
              </div>
            </div>
          </Card>

          {/* Calories Burnt ring */}
          <Card className="flex flex-col items-center justify-center text-center">
            <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Burnt</p>
            <div className="relative">
              <RingChart value={totals.calories_burnt} goal={goals.calories_burnt_goal} color="#A970FF" size={110} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-accent">{Math.round(totals.calories_burnt)}</span>
                <span className="text-xs text-gray-400">/ {goals.calories_burnt_goal}</span>
              </div>
            </div>
          </Card>

          <MetricTile label="BMI" value={metrics.bmi} sub={metrics.bmi_status} color="var(--color-info)" />

          <button onClick={() => setShowLbs(v => !v)} className="text-left rounded-2xl">
            <MetricTile
              label="Weight"
              value={weight_kg ? (showLbs ? `${weight_lbs}` : `${weight_kg.toFixed(1)}`) : 'N/A'}
              sub={weight_kg ? (showLbs ? 'lbs — tap to switch' : 'kg — tap to switch') : '—'}
              color="var(--color-lime)"
            />
          </button>

          <MetricTile
            label="Maintenance"
            value={metrics.maintenance_calories}
            sub="kcal / day"
            color="var(--color-info)"
          />
          <MetricTile
            label="Deficit"
            value={metrics.calorie_deficit !== 'N/A' ? String(metrics.calorie_deficit) : 'N/A'}
            sub="kcal"
            color={deficitColor}
          />
        </div>

        {/* ── RIGHT: macros + activity + trends ─────────────────────────── */}
        <div className="space-y-4">

          {/* Macros */}
          <Card>
            <h2 className="text-base font-bold mb-4 text-center">Macros</h2>
            <div className="grid grid-cols-4 gap-2">
              {macros.map(m => (
                <div key={m.name} className="flex flex-col items-center">
                  <div className="relative">
                    <RingChart value={m.value} goal={m.goal} color={m.color} size={80} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold" style={{ color: m.color }}>
                        {Math.round(m.value)}g
                      </span>
                      <span className="text-[10px] text-gray-500">/{m.goal}g</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold mt-1">{m.name}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity */}
          <Card className="space-y-3">
            <h2 className="text-base font-bold mb-1">Activity</h2>
            <ProgressRow label="Water" value={totals.water} goal={goals.water_goal}  color="var(--color-info)"   />
            <ProgressRow label="Steps" value={totals.steps} goal={goals.step_goal}   color="var(--color-lime)"   />
            <ProgressRow label="Sleep" value={totals.sleep} goal={goals.sleep_goal}  color="var(--color-accent)" />
          </Card>

          {/* Trend charts */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <h3 className="text-sm font-bold mb-3">Weight</h3>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-elevated)" />
                  <XAxis dataKey="date" tick={TICK} hide={weightData.length > 7} />
                  <YAxis tick={TICK} domain={['auto', 'auto']} width={30} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line
                    type="monotone"
                    dataKey="kg"
                    stroke="var(--color-info)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--color-lime)', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h3 className="text-sm font-bold mb-3">Sleep</h3>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={sleepData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-elevated)" />
                  <XAxis dataKey="date" tick={TICK} hide={sleepData.length > 7} />
                  <YAxis tick={TICK} width={25} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="hrs" fill="var(--color-accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}
