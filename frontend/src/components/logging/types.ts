export type MetricType = 'water' | 'steps' | 'weight' | 'food' | 'sleep'

export type ActiveLog =
  | { tier: 'strip'; metric: MetricType }
  | { tier: 'card';  metric: MetricType }
  | { tier: 'sheet'; metric: 'food' | 'sleep' }

export const SIMPLE_METRICS: MetricType[] = ['water', 'steps', 'weight']
export const SHEET_METRICS: MetricType[]  = ['food', 'sleep']
