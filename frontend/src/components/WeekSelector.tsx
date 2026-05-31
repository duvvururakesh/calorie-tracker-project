import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dateFromKey, localDateKey, shiftDateKey } from '@/lib/date'

interface Props {
  selectedDate: string
  onSelect: (date: string) => void
}

function getWeekDates(dateStr: string) {
  const d = dateFromKey(dateStr)
  const day = d.getDay()
  const sun = new Date(d)
  sun.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sun)
    dd.setDate(sun.getDate() + i)
    return dd
  })
}

export default function WeekSelector({ selectedDate, onSelect }: Props) {
  // viewAnchor controls which week is visible; selectedDate controls the highlight
  const [viewAnchor, setViewAnchor] = useState(selectedDate)
  const days = getWeekDates(viewAnchor)
  const today = localDateKey()

  // If selectedDate moves outside the visible week (e.g. set externally), follow it
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewAnchor(current => {
      const visible = getWeekDates(current).map(d => localDateKey(d))
      return visible.includes(selectedDate) ? current : selectedDate
    })
  }, [selectedDate])

  function shiftWeek(n: number) {
    setViewAnchor(shiftDateKey(viewAnchor, n))
  }

  return (
    <div className="flex justify-between items-center mb-2 sm:mb-6 p-1 rounded-xl bg-surface border border-white/8 min-w-0">
      <button
        onClick={() => shiftWeek(-7)}
        aria-label="Previous week"
        className="w-11 h-11 rounded-lg hover:bg-elevated transition-colors text-gray-400 hover:text-white flex-shrink-0 flex items-center justify-center"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex-1 flex gap-1 mx-1 overflow-x-auto no-scrollbar min-w-0">
        {days.map(d => {
          const iso = localDateKey(d)
          const isSelected = iso === selectedDate
          const isToday = iso === today
          const isFuture = iso > today
          return (
            <button
              key={iso}
              onClick={() => onSelect(iso)}
              className={`min-h-12 min-w-11 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg transition-colors ${
                isSelected
                  ? isFuture ? 'bg-elevated text-gray-300 ring-1 ring-white/10' : 'bg-lime text-black font-bold'
                  : isFuture ? 'text-gray-600 hover:bg-elevated/40' : 'text-white/70 hover:bg-elevated'
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
        className="w-11 h-11 rounded-lg hover:bg-elevated transition-colors text-gray-400 hover:text-white flex-shrink-0 flex items-center justify-center"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
