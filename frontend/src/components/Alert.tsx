interface AlertProps {
  message: string
  type?: 'error' | 'success'
}

export default function Alert({ message, type = 'error' }: AlertProps) {
  if (!message) return null
  const color = type === 'error' ? 'var(--color-danger)' : 'var(--color-lime)'
  return (
    <div
      className="mb-4 p-3 rounded-xl text-sm bg-elevated"
      style={{ borderLeft: `4px solid ${color}`, color }}
    >
      {message}
    </div>
  )
}
