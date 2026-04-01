import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  // viewAnchor controls which week is visible; selectedDate controls the highlight
  const [viewAnchor, setViewAnchor] = useState(selectedDate)
  const days = getWeekDates(viewAnchor)
  const today = toISO(new Date())

  // If selectedDate moves outside the visible week (e.g. set externally), follow it
  useEffect(() => {
    setViewAnchor(current => {
      const visible = getWeekDates(current).map(d => toISO(d))
      return visible.includes(selectedDate) ? current : selectedDate
    })
  }, [selectedDate])

  function shiftWeek(n: number) {
    const d = new Date(viewAnchor + 'T12:00:00')
    d.setDate(d.getDate() + n)
    setViewAnchor(toISO(d))
  }

  return (
    <div className="flex justify-between items-center mb-6 p-2 rounded-2xl bg-surface shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
      <button
        onClick={() => shiftWeek(-7)}
        aria-label="Previous week"
        className="p-2 rounded-full hover:bg-elevated transition-colors text-gray-400 hover:text-white flex-shrink-0"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex-1 flex justify-between mx-2 overflow-x-auto gap-1">
        {days.map(d => {
          const iso = toISO(d)
          const isSelected = iso === selectedDate
          const isToday = iso === today
          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className={`flex-1 flex flex-col items-center py-2 px-1 rounded-full transition-all min-w-[40px] ${
                isSelected ? 'bg-lime text-black font-bold' : 'bg-elevated text-white/70'
              }`}
            >
              <span className={`text-[10px] font-normal leading-tight ${isSelected ? 'opacity-50' : 'text-gray-500'}`}>
                {d.toLocaleDateString('en', { weekday: 'short' })}
              </span>
              <span className="text-sm font-bold leading-tight">{d.getDate()}</span>
              <span className={`w-1 h-1 rounded-full mt-0.5 ${
                isToday
                  ? isSelected ? 'bg-black/40' : 'bg-lime'
                  : 'invisible'
              }`} />
            </button>
          )
        })}
      </div>

      <button
        onClick={() => shiftWeek(7)}
        aria-label="Next week"
        className="p-2 rounded-full hover:bg-elevated transition-colors text-gray-400 hover:text-white flex-shrink-0"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
