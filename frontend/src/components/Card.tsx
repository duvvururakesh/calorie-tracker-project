interface CardProps {
  children: React.ReactNode
  className?: string
  interactive?: boolean
  onClick?: () => void
}

export default function Card({ children, className = '', interactive, onClick }: CardProps) {
  return (
    <div
      className={`rounded-2xl p-5 bg-surface shadow-[0_2px_6px_rgba(0,0,0,0.3)] relative
        ${interactive ? 'cursor-pointer hover:ring-1 hover:ring-lime/30 transition-all' : ''}
        ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
