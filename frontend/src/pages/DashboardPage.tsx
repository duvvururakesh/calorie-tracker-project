import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import api from '@/api/client'
import WeekSelector from '@/components/WeekSelector'
import RingChart from '@/components/RingChart'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
         style={{ backgroundColor: '#1E1E1E', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
      {children}
    </div>
  )
}

function MetricTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="flex flex-col items-center justify-center text-center min-h-[130px]">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </Card>
  )
}

function ProgressRow({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0)
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-gray-400">{Math.round(value)} / {goal}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#2A2A2A' }}>
        <div className="h-full rounded-full transition-all duration-500"
             style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [showLbs, setShowLbs] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => api.get(`/dashboard?date=${date}`).then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
  )

  const { totals, goals, metrics, weight_kg, weight_lbs, chart } = data

  const macros = [
    { name: 'Protein', value: totals.protein, goal: goals.protein_goal, color: '#FF375F' },
    { name: 'Carbs', value: totals.carbs, goal: goals.carbs_goal, color: '#5BEAFF' },
    { name: 'Fat', value: totals.fat, goal: goals.fat_goal, color: '#FFD60A' },
    { name: 'Sugar', value: totals.sugar, goal: goals.sugar_goal, color: '#A970FF' },
  ]

  const weightData = chart.weight_labels.map((l: string, i: number) => ({ date: l, kg: chart.weight_values[i] }))
  const sleepData = chart.sleep_labels.map((l: string, i: number) => ({ date: l, hrs: chart.sleep_values[i] }))

  return (
    <div>
      <WeekSelector selectedDate={date} onSelect={setDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="grid grid-cols-2 gap-4">
          {/* Calorie Intake ring */}
          <Card className="flex flex-col items-center justify-center text-center">
            <p className="text-sm text-gray-300 mb-2 font-semibold">Calorie Intake</p>
            <div className="relative">
              <RingChart value={totals.calories} goal={goals.calorie_goal} color="#C7FF41" size={110} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: '#C7FF41' }}>{Math.round(totals.calories)}</span>
                <span className="text-xs text-gray-400">/ {goals.calorie_goal}</span>
              </div>
            </div>
          </Card>

          {/* Calories Burnt ring */}
          <Card className="flex flex-col items-center justify-center text-center">
            <p className="text-sm text-gray-300 mb-2 font-semibold">Calories Burnt</p>
            <div className="relative">
              <RingChart value={totals.calories_burnt} goal={goals.calories_burnt_goal} color="#A970FF" size={110} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold" style={{ color: '#A970FF' }}>{Math.round(totals.calories_burnt)}</span>
                <span className="text-xs text-gray-400">/ {goals.calories_burnt_goal}</span>
              </div>
            </div>
          </Card>

          <MetricTile label="BMI" value={metrics.bmi} sub={metrics.bmi_status} color="#5BEAFF" />

          <button onClick={() => setShowLbs(v => !v)} className="text-left">
            <MetricTile label="Current Weight"
              value={weight_kg ? (showLbs ? `${weight_lbs}` : `${weight_kg.toFixed(1)}`) : 'N/A'}
              sub={weight_kg ? (showLbs ? 'lbs (tap to switch)' : 'kg (tap to switch)') : '—'}
              color="#C7FF41" />
          </button>

          <MetricTile label="Maintenance" value={metrics.maintenance_calories} sub="kcal/day" color="#5BEAFF" />
          <MetricTile label="Calorie Deficit"
            value={metrics.calorie_deficit !== 'N/A' ? String(metrics.calorie_deficit) : 'N/A'}
            sub="kcal" color={Number(metrics.calorie_deficit) >= 0 ? '#C7FF41' : '#A970FF'} />
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* Macros */}
          <Card>
            <h2 className="text-lg font-bold mb-4 text-center">Macros</h2>
            <div className="grid grid-cols-4 gap-2">
              {macros.map(m => (
                <div key={m.name} className="flex flex-col items-center">
                  <div className="relative">
                    <RingChart value={m.value} goal={m.goal} color={m.color} size={80} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-bold" style={{ color: m.color }}>{Math.round(m.value)}g</span>
                      <span style={{ fontSize: '9px', color: '#888' }}>/{m.goal}g</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold mt-1">{m.name}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity */}
          <Card className="space-y-3">
            <h2 className="text-lg font-bold mb-1">Activity</h2>
            <ProgressRow label="Water" value={totals.water} goal={goals.water_goal} color="#5BEAFF" />
            <ProgressRow label="Steps" value={totals.steps} goal={goals.step_goal} color="#C7FF41" />
            <ProgressRow label="Sleep" value={totals.sleep} goal={goals.sleep_goal} color="#A970FF" />
          </Card>

          {/* Trends */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <h3 className="font-bold mb-3 text-sm">Weight Trend</h3>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} hide={weightData.length > 7} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} domain={['auto', 'auto']} width={30} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="kg" stroke="#5BEAFF" strokeWidth={2} dot={{ fill: '#C7FF41', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card>
              <h3 className="font-bold mb-3 text-sm">Sleep Trend</h3>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={sleepData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                  <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} hide={sleepData.length > 7} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} width={25} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E1E1E', border: 'none', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="hrs" fill="#A970FF" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
