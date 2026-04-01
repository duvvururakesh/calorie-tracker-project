import { PieChart, Pie, Cell } from 'recharts'

interface Props {
  value: number
  goal: number
  color: string
  size?: number
}

export default function RingChart({ value, goal, color, size = 120 }: Props) {
  const filled = Math.min(value, goal)
  const remaining = Math.max(0, goal - filled)
  const over = Math.max(0, value - goal)
  const data = over > 0
    ? [{ v: goal }, { v: 0 }]
    : [{ v: filled }, { v: remaining }]

  return (
    <PieChart width={size} height={size}>
      <Pie
        data={data}
        dataKey="v"
        cx="50%"
        cy="50%"
        innerRadius={size * 0.35}
        outerRadius={size * 0.46}
        startAngle={90}
        endAngle={-270}
        strokeWidth={0}
      >
        <Cell fill={over > 0 ? 'var(--color-danger)' : color} />
        <Cell fill="var(--color-elevated)" />
      </Pie>
    </PieChart>
  )
}
