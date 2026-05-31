import { useEffect, useState } from 'react'
import { localDateKey } from '@/lib/date'

export default function useCurrentLocalDate() {
  const [today, setToday] = useState(() => localDateKey())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(localDateKey())
    }, 30_000)

    const updateOnFocus = () => setToday(localDateKey())
    window.addEventListener('focus', updateOnFocus)
    document.addEventListener('visibilitychange', updateOnFocus)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', updateOnFocus)
      document.removeEventListener('visibilitychange', updateOnFocus)
    }
  }, [])

  return today
}
