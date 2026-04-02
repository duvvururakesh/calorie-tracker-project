import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import FlipMetricBlock from '@/components/logging/FlipMetricBlock'
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
import type { ActiveLog, MetricType } from '@/components/logging/types'
import QuickLogStrip from '@/components/logging/QuickLogStrip'
import InlineLogForm from '@/components/logging/InlineLogForm'
import BottomSheet from '@/components/logging/BottomSheet'
import FoodSheetForm from '@/components/logging/FoodSheetForm'
import SleepSheetForm from '@/components/logging/SleepSheetForm'
import TodaysLog from '@/components/logging/TodaysLog'

/* ─── Chart constants ─────────────────────────────────────────────────────── */
const TICK = { fill: '#9CA3AF', fontSize: 10 }
const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-surface)',
  border: 'none',
  borderRadius: 8,
  fontSize: 12,
}

/* ─── Loggable card wrapper ───────────────────────────────────────────────── */
function LoggableCard({
  metric, activeCard, onOpen, onClose, children, className = '',
}: {
  metric: MetricType
  activeCard: MetricType | null
  onOpen: (m: MetricType) => void
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  const isOpen = activeCard === metric
  return (
    <Card interactive className={`group ${className}`} onClick={() => !isOpen && onOpen(metric)}>
      {/* + icon top-right */}
      <button
        onClick={e => { e.stopPropagation(); isOpen ? onClose() : onOpen(metric) }}
        className={`absolute top-2 right-2 p-1 rounded-full transition-all
          ${isOpen
            ? 'bg-lime text-black rotate-45'
            : 'text-gray-600 group-hover:text-gray-300'}`}
      >
        <Plus size={14} />
      </button>
      {children}
    </Card>
  )
}


/* ─── MetricTile ──────────────────────────────────────────────────────────── */
function MetricTile({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth()
  const [date, setDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [showLbs, setShowLbs] = useState(false)
  const [activeLog, setActiveLog] = useState<ActiveLog | null>(null)

  // Derive which card is expanded (only card-tier)
  const activeCard: MetricType | null =
    activeLog?.tier === 'card' ? activeLog.metric : null

  function openCard(metric: MetricType) {
    if (metric === 'food')  { setActiveLog({ tier: 'sheet', metric: 'food' });  return }
    if (metric === 'sleep') { setActiveLog({ tier: 'sheet', metric: 'sleep' }); return }
    setActiveLog({ tier: 'card', metric })
  }
  function closeCard() { setActiveLog(null) }

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', date],
    queryFn:  () => api.get(`/dashboard?date=${date}`).then(r => r.data),
  })

  function invalidate() {
    // TanStack Query will auto-refetch via invalidation in useLogMutation
  }

  if (isLoading) return <Spinner />

  const { totals, goals, metrics, weight_kg, weight_lbs, chart } = data

  const macros = [
    { name: 'Protein', value: totals.protein,      goal: goals.protein_goal,      color: '#FF375F' },
    { name: 'Carbs',   value: totals.carbs,         goal: goals.carbs_goal,         color: '#5BEAFF' },
    { name: 'Fat',     value: totals.fat,           goal: goals.fat_goal,           color: '#FFD60A' },
    { name: 'Sugar',   value: totals.sugar,         goal: goals.sugar_goal,         color: '#A970FF' },
  ]

  const weightData = chart.weight_labels.map((l: string, i: number) => ({ date: l, kg:  chart.weight_values[i] }))
  const sleepData  = chart.sleep_labels.map( (l: string, i: number) => ({ date: l, hrs: chart.sleep_values[i]  }))

  const deficit      = Number(metrics.calorie_deficit)
  const deficitColor = isNaN(deficit) || metrics.calorie_deficit === 'N/A'
    ? 'var(--color-info)'
    : deficit >= 0 ? 'var(--color-lime)' : 'var(--color-danger)'

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

      {/* ── Tier 1: Quick-Log Strip ─────────────────────────────────────── */}
      <QuickLogStrip
        activeLog={activeLog}
        setActiveLog={setActiveLog}
        date={date}
        onSuccess={invalidate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 content-start">

          {/* Calorie Intake — opens Food sheet */}
          <LoggableCard metric="food" activeCard={activeCard} onOpen={openCard} onClose={closeCard}>
            <div className="flex flex-col items-center justify-center text-center min-h-[120px]">
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Intake</p>
              <div className="relative">
                <RingChart value={totals.calories} goal={goals.calorie_goal} color="#C7FF41" size={110} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-lime">{Math.round(totals.calories)}</span>
                  <span className="text-xs text-gray-400">/ {goals.calorie_goal}</span>
                </div>
              </div>
            </div>
          </LoggableCard>

          {/* Calories Burnt — inline form */}
          <LoggableCard metric="burnt" activeCard={activeCard} onOpen={openCard} onClose={closeCard}>
            <div className="flex flex-col items-center justify-center text-center min-h-[120px]">
              <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Burnt</p>
              <div className="relative">
                <RingChart value={totals.calories_burnt} goal={goals.calories_burnt_goal} color="#A970FF" size={110} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-accent">{Math.round(totals.calories_burnt)}</span>
                  <span className="text-xs text-gray-400">/ {goals.calories_burnt_goal}</span>
                </div>
              </div>
            </div>
            {activeCard === 'burnt' && (
              <InlineLogForm metric="burnt" date={date} onSuccess={invalidate} onClose={closeCard} />
            )}
          </LoggableCard>

          {/* BMI — read-only */}
          <Card className="min-h-[90px]">
            <MetricTile label="BMI" value={metrics.bmi} sub={metrics.bmi_status} color="var(--color-info)" />
          </Card>

          {/* Weight — inline form */}
          <LoggableCard metric="weight" activeCard={activeCard} onOpen={openCard} onClose={closeCard} className="min-h-[90px]">
            <div onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowLbs(v => !v)}
                className="w-full text-left"
              >
                <MetricTile
                  label="Weight"
                  value={weight_kg ? (showLbs ? `${weight_lbs}` : `${weight_kg.toFixed(1)}`) : 'N/A'}
                  sub={weight_kg ? (showLbs ? 'lbs — tap to switch' : 'kg — tap to switch') : '—'}
                  color="var(--color-lime)"
                />
              </button>
            </div>
            {activeCard === 'weight' && (
              <InlineLogForm metric="weight" date={date} onSuccess={invalidate} onClose={closeCard} />
            )}
          </LoggableCard>

          {/* Maintenance — read-only */}
          <Card className="min-h-[90px]">
            <MetricTile label="Maintenance" value={metrics.maintenance_calories} sub="kcal / day" color="var(--color-info)" />
          </Card>

          {/* Deficit — read-only */}
          <Card className="min-h-[90px]">
            <MetricTile
              label="Deficit"
              value={metrics.calorie_deficit !== 'N/A' ? String(metrics.calorie_deficit) : 'N/A'}
              sub="kcal"
              color={deficitColor}
            />
          </Card>
        </div>

        {/* ── RIGHT ───────────────────────────────────────────────────────── */}
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
                      <span className="text-xs font-bold" style={{ color: m.color }}>{Math.round(m.value)}g</span>
                      <span className="text-[10px] text-gray-500">/{m.goal}g</span>
                    </div>
                  </div>
                  <p className="text-xs font-semibold mt-1">{m.name}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity — flip blocks */}
          <div className="grid grid-cols-3 gap-3">
            <FlipMetricBlock metric="water" value={totals.water} goal={goals.water_goal} date={date} onSuccess={invalidate} />
            <FlipMetricBlock metric="steps" value={totals.steps} goal={goals.step_goal}  date={date} onSuccess={invalidate} />
            <FlipMetricBlock metric="sleep" value={totals.sleep} goal={goals.sleep_goal} date={date} onSuccess={invalidate} />
          </div>

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
                  <Line type="monotone" dataKey="kg" stroke="var(--color-info)" strokeWidth={2}
                    dot={{ fill: 'var(--color-lime)', r: 3 }} />
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

      {/* ── Today's Log ─────────────────────────────────────────────────── */}
      <TodaysLog date={date} />

      {/* ── Tier 3: Bottom Sheets ────────────────────────────────────────── */}
      <BottomSheet
        isOpen={activeLog?.tier === 'sheet' && activeLog.metric === 'food'}
        onClose={() => setActiveLog(null)}
        title="Log Food"
      >
        <FoodSheetForm date={date} onSuccess={invalidate} />
      </BottomSheet>

      <BottomSheet
        isOpen={activeLog?.tier === 'sheet' && activeLog.metric === 'sleep'}
        onClose={() => setActiveLog(null)}
        title="Log Sleep"
      >
        <SleepSheetForm date={date} onSuccess={invalidate} />
      </BottomSheet>
    </div>
  )
}
