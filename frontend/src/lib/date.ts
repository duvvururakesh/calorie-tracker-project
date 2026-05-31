export function localDateKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function shiftDateKey(value: string, days: number) {
  const date = dateFromKey(value)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

export function shortDateLabel(value: string) {
  return dateFromKey(value).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })
}
