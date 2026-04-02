import { useState, useMemo } from 'react'
import useLogMutation from '@/hooks/useLogMutation'
import Button from '@/components/Button'
import Alert from '@/components/Alert'

interface Props {
  date: string
  onSuccess: () => void
}

function calcDuration(sleep: string, wake: string): string {
  if (!sleep || !wake) return '—'
  const [sh, sm] = sleep.split(':').map(Number)
  const [wh, wm] = wake.split(':').map(Number)
  let mins = (wh * 60 + wm) - (sh * 60 + sm)
  if (mins <= 0) mins += 24 * 60 // overnight
  return (mins / 60).toFixed(1)
}

export default function SleepSheetForm({ date, onSuccess }: Props) {
  const [sleepTime, setSleepTime] = useState('22:00')
  const [wakeTime, setWakeTime]   = useState('06:00')
  const [saved, setSaved]         = useState('')

  const duration = useMemo(() => calcDuration(sleepTime, wakeTime), [sleepTime, wakeTime])

  const mut = useLogMutation('sleep', date, () => {
    setSaved(`Logged: ${duration} hrs of sleep`)
    onSuccess()
    setTimeout(() => setSaved(''), 2500)
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mut.mutate({ sleep_time: sleepTime, wake_time: wakeTime })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {saved && <Alert message={saved} type="success" />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Sleep Time</label>
          <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Wake Time</label>
          <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} />
        </div>
      </div>
      <div className="text-center py-2">
        <span className="text-2xl font-bold text-accent">{duration}</span>
        <span className="text-sm text-gray-400 ml-1">hrs</span>
      </div>
      <Button type="submit" loading={mut.isPending}>Log Sleep</Button>
    </form>
  )
}
