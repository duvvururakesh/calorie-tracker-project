type Ring = {
  color: string
  goal: number
  label: string
  unit: string
  value: number
}

function ringDash(value: number, goal: number, radius: number) {
  const circumference = 2 * Math.PI * radius
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0
  return {
    dasharray: circumference,
    dashoffset: circumference * (1 - progress),
  }
}

export default function ActivityRings({ rings }: { rings: Ring[] }) {
  const radii = [45, 34, 23]

  return (
    <div className="flex items-center gap-4 min-w-0">
      <svg viewBox="0 0 112 112" className="w-32 h-32 flex-shrink-0 -rotate-90" aria-hidden="true">
        {rings.map((ring, index) => {
          const radius = radii[index]
          const dash = ringDash(ring.value, ring.goal, radius)
          return (
            <g key={ring.label}>
              <circle
                cx="56"
                cy="56"
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeOpacity="0.18"
                strokeWidth="10"
              />
              <circle
                cx="56"
                cy="56"
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeLinecap="round"
                strokeWidth="10"
                strokeDasharray={dash.dasharray}
                strokeDashoffset={dash.dashoffset}
              />
            </g>
          )
        })}
      </svg>

      <div className="min-w-0 flex-1 space-y-2">
        {rings.map(ring => (
          <div key={ring.label} className="min-w-0">
            <p className="text-[13px] text-gray-300">{ring.label}</p>
            <p className="text-2xl font-bold tracking-tight leading-none" style={{ color: ring.color }}>
              {Math.round(ring.value)}
              <span className="text-sm font-bold">{ring.unit}</span>
              <span className="text-sm text-gray-500">/{Math.round(ring.goal)}{ring.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
