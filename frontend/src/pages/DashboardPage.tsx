import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import FlipMetricBlock from '@/components/logging/FlipMetricBlock'
import CalorieBlock from '@/components/logging/CalorieBlock'
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
import InlineLogForm from '@/components/logging/InlineLogForm'
import BottomSheet from '@/components/logging/BottomSheet'
import FoodSheetForm from '@/components/logging/FoodSheetForm'
import TodaysLog from '@/components/logging/TodaysLog'

/* ─── Chart constants ─────────────────────────────────────────────────────── */
const TICK = { fill: '#8E8E93', fontSize: 10 }
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
        onClick={e => {
          e.stopPropagation()
          if (isOpen) onClose()
          else onOpen(metric)
        }}
        className={`absolute top-2 right-2 w-11 h-11 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-colors
          ${isOpen
            ? 'bg-lime text-black'
            : 'text-gray-500 bg-elevated/60 group-hover:text-white'}`}
        aria-label={isOpen ? 'Close log form' : 'Open log form'}
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
    <div className="flex flex-col items-start justify-between h-full gap-3">
      <p className="text-[13px] font-semibold text-gray-400">{label}</p>
      <div>
        <p className="text-[27px] leading-none font-semibold tracking-tight" style={{ color }}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1 leading-tight">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuth()
  const [date, setDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [showLbs, setShowLbs] = useState(false)
  const [activeLog, setActiveLog] = useState<ActiveLog | null>(null)

  // Derive which card is expanded (card-tier or sheet-tier)
  const activeCard: MetricType | null = activeLog?.metric ?? null

  function openCard(metric: MetricType) {
    if (metric === 'food') { setActiveLog({ tier: 'sheet', metric: 'food' }); return }
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
    { name: 'Protein', value: totals.protein,      goal: goals.protein_goal,      color: 'var(--color-move)' },
    { name: 'Carbs',   value: totals.carbs,         goal: goals.carbs_goal,         color: 'var(--color-stand)' },
    { name: 'Fat',     value: totals.fat,           goal: goals.fat_goal,           color: '#FFD60A' },
    { name: 'Sugar',   value: totals.sugar,         goal: goals.sugar_goal,         color: 'var(--color-accent)' },
  ]

  const weightData = chart.weight_labels.map((l: string, i: number) => ({ date: l, kg:  chart.weight_values[i] }))
  const sleepData  = chart.sleep_labels.map( (l: string, i: number) => ({ date: l, hrs: chart.sleep_values[i]  }))

  const deficit      = Number(metrics.calorie_deficit)
  const deficitColor = isNaN(deficit) || metrics.calorie_deficit === 'N/A'
    ? 'var(--color-info)'
    : deficit >= 0 ? 'var(--color-lime)' : 'var(--color-danger)'

  return (
    <div className="min-w-0">
      <div className="mb-4 sm:mb-6">
        <div className="space-y-1">
          <p className="text-[13px] font-semibold uppercase text-gray-500">Today</p>
          <h1 className="text-[32px] sm:text-4xl font-semibold leading-none tracking-tight">
            {user?.profile_name || user?.username}
          </h1>
        </div>
      </div>

      <WeekSelector selectedDate={date} onSelect={setDate} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">

        {/* ── LEFT ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 content-start min-w-0">
          {/* Calorie Intake — opens Food sheet */}
          <LoggableCard metric="food" activeCard={activeCard} onOpen={openCard} onClose={closeCard} className="col-span-2">
            <div className="min-h-[172px] pr-10">
              <div className="mb-2">
                <p className="text-[13px] font-semibold text-gray-400">Move</p>
                <h2 className="text-2xl font-semibold tracking-tight">Calories</h2>
              </div>
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative flex-shrink-0">
                  <RingChart value={totals.calories} goal={goals.calorie_goal} color="var(--color-move)" size={138} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold tracking-tight text-danger">{Math.round(totals.calories)}</span>
                    <span className="text-xs text-gray-400">CAL</span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase text-gray-500">Goal</p>
                  <p className="text-[30px] leading-none font-semibold tracking-tight text-danger tabular-nums mt-1">
                    {goals.calorie_goal} <span className="text-sm text-gray-400">CAL</span>
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-tight text-gray-300">
                    {Math.max(0, Math.round(goals.calorie_goal - totals.calories))} left
                  </p>
                </div>
              </div>
            </div>
          </LoggableCard>

          {/* Calories Burnt */}
          <Card className="col-span-2">
            <CalorieBlock kind="burnt" value={totals.calories_burnt} goal={goals.calories_burnt_goal} date={date} onSuccess={invalidate} />
          </Card>

          {/* BMI — read-only */}
          <Card className="min-h-[108px] sm:min-h-[96px]">
            <MetricTile label="BMI" value={metrics.bmi} sub={metrics.bmi_status} color="var(--color-info)" />
          </Card>

          {/* Weight — inline form */}
          <LoggableCard metric="weight" activeCard={activeCard} onOpen={openCard} onClose={closeCard} className="min-h-[108px] sm:min-h-[96px]">
            <div onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowLbs(v => !v)}
                className="w-full text-left"
              >
                <MetricTile
                  label="Weight"
                  value={weight_kg ? (showLbs ? `${weight_lbs}` : `${weight_kg.toFixed(1)}`) : 'N/A'}
                  sub={weight_kg ? (showLbs ? 'lbs — tap to switch' : 'kg — tap to switch') : '—'}
                  color="var(--color-exercise)"
                />
              </button>
            </div>
            {activeCard === 'weight' && (
              <InlineLogForm metric="weight" date={date} onSuccess={invalidate} onClose={closeCard} />
            )}
          </LoggableCard>

          {/* Maintenance — read-only */}
          <Card className="min-h-[108px] sm:min-h-[96px]">
            <MetricTile label="Maintenance" value={metrics.maintenance_calories} sub="kcal / day" color="var(--color-info)" />
          </Card>

          {/* Deficit — read-only */}
          <Card className="min-h-[108px] sm:min-h-[96px]">
            <MetricTile
              label="Deficit"
              value={metrics.calorie_deficit !== 'N/A' ? String(metrics.calorie_deficit) : 'N/A'}
              sub="kcal"
              color={deficitColor}
            />
          </Card>
        </div>

        {/* ── RIGHT ───────────────────────────────────────────────────────── */}
        <div className="space-y-3 sm:space-y-4 min-w-0">

          {/* Macros */}
          <Card>
            <h2 className="text-xl font-semibold tracking-tight mb-4">Nutrition</h2>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 min-w-0">
              {macros.map(m => (
                <div key={m.name} className="flex flex-col items-center min-w-0">
                  <div className="relative">
                    <RingChart value={m.value} goal={m.goal} color={m.color} size={80} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold" style={{ color: m.color }}>{Math.round(m.value)}g</span>
                      <span className="text-[10px] text-gray-500">/{m.goal}g</span>
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold mt-1 truncate max-w-full">{m.name}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Activity — flip blocks */}
          <h2 className="text-xl font-semibold tracking-tight px-1">Daily Basics</h2>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 min-w-0">
            <FlipMetricBlock metric="water" value={totals.water} goal={goals.water_goal} date={date} onSuccess={invalidate} />
            <FlipMetricBlock metric="steps" value={totals.steps} goal={goals.step_goal}  date={date} onSuccess={invalidate} />
            <FlipMetricBlock metric="sleep" value={totals.sleep} goal={goals.sleep_goal} date={date} onSuccess={invalidate} />
          </div>

          {/* Trend charts — read-only */}
          <div className="hidden sm:grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
            <Card>
              <h3 className="text-sm font-bold mb-3">Weight</h3>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-elevated)" />
                  <XAxis dataKey="date" tick={TICK} hide={weightData.length > 7} />
                  <YAxis tick={TICK} domain={['auto', 'auto']} width={30} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="kg" stroke="var(--color-stand)" strokeWidth={2}
                    dot={{ fill: 'var(--color-exercise)', r: 3 }} />
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

    </div>
  )
}
