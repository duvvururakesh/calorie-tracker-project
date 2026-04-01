interface Props {
  selectedDate: string
  onSelect: (date: string) => void
}

function getWeekDates(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const sun = new Date(d)
  sun.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sun)
    dd.setDate(sun.getDate() + i)
    return dd
  })
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function WeekSelector({ selectedDate, onSelect }: Props) {
  const days = getWeekDates(selectedDate)
  const today = toISO(new Date())

  function shift(n: number) {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + n)
    onSelect(toISO(d))
  }

  return (
    <div className="flex justify-between items-center mb-6 p-2 rounded-2xl"
         style={{ backgroundColor: '#1E1E1E', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
      <button onClick={() => shift(-7)} className="p-2 rounded-full hover:bg-[#292929] transition-colors">‹</button>
      <div className="flex-1 flex justify-between mx-2 overflow-x-auto gap-1">
        {days.map(d => {
          const iso = toISO(d)
          const isSelected = iso === selectedDate
          const isToday = iso === today
          return (
            <button key={iso} onClick={() => onSelect(iso)}
              className="flex-1 text-center py-2 px-1 rounded-full font-semibold transition-all text-sm min-w-[40px]"
              style={isSelected
                ? { backgroundColor: '#C7FF41', color: '#000' }
                : { backgroundColor: '#2A2A2A', color: '#ccc' }}>
              <span className="block text-xs">{d.toLocaleDateString('en', { weekday: 'short' })}</span>
              <span className="text-xs">{isToday ? 'Today' : d.getDate()}</span>
            </button>
          )
        })}
      </div>
      <button onClick={() => shift(7)} className="p-2 rounded-full hover:bg-[#292929] transition-colors">›</button>
    </div>
  )
}
