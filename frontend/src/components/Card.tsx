interface CardProps {
  children: React.ReactNode
  className?: string
  interactive?: boolean
  onClick?: () => void
}

export default function Card({ children, className = '', interactive, onClick }: CardProps) {
  return (
    <div
      className={`rounded-[1.25rem] p-3 sm:p-5 bg-surface/95 border border-white/10 relative min-w-0
        ${interactive ? 'cursor-pointer hover:border-lime/40 transition-colors' : ''}
        ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
