export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 bg-surface shadow-[0_2px_6px_rgba(0,0,0,0.3)] ${className}`}>
      {children}
    </div>
  )
}
