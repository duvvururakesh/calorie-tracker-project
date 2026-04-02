import { useState } from 'react'
import { Check } from 'lucide-react'
import useLogMutation from '@/hooks/useLogMutation'

interface Props {
  metric: string
  date: string
  onSuccess: () => void
  onClose: () => void
}

export default function InlineLogForm({ metric, date, onSuccess, onClose }: Props) {
  return (
    <div className="mt-3 pt-3 border-t border-elevated">
      {metric === 'water'  && <WaterInline  date={date} onSuccess={onSuccess} />}
      {metric === 'steps'  && <SimpleInline date={date} onSuccess={onSuccess} type="steps"          field="steps"          placeholder="Steps" />}
      {metric === 'weight' && <WeightInline date={date} onSuccess={onSuccess} />}
      {metric === 'burnt'  && <SimpleInline date={date} onSuccess={onSuccess} type="calories_burnt" field="calories_burnt" placeholder="kcal" />}
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors mt-2"
      >
        Close
      </button>
    </div>
  )
}

/* ─── Water with presets ──────────────────────────────────────────────────── */
function WaterInline({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const mut = useLogMutation('water', date, () => { setAmount(''); onSuccess() })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {[100, 250, 500].map(ml => (
          <button
            key={ml}
            type="button"
            onClick={() => mut.mutate({ amount_ml: ml })}
            disabled={mut.isPending}
            className="px-3 py-1.5 rounded-lg bg-elevated text-sm font-semibold text-info
              hover:bg-info/20 transition-colors disabled:opacity-50"
          >
            +{ml}ml
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder="Custom ml" value={amount}
          onChange={e => setAmount(e.target.value)} min="0"
          className="!py-1.5 !text-sm !rounded-lg flex-1" />
        <SubmitIcon onClick={() => { if (amount) mut.mutate({ amount_ml: Number(amount) }) }}
          disabled={!amount || mut.isPending} />
      </div>
    </div>
  )
}

/* ─── Weight with kg/lbs toggle ───────────────────────────────────────────── */
function WeightInline({ date, onSuccess }: { date: string; onSuccess: () => void }) {
  const [value, setValue] = useState('')
  const [unit, setUnit]   = useState<'kg' | 'lbs'>('kg')
  const mut = useLogMutation('weight', date, () => { setValue(''); onSuccess() })

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(['kg', 'lbs'] as const).map(u => (
          <button key={u} type="button" onClick={() => setUnit(u)}
            className="flex-1 py-1.5 rounded-lg font-semibold text-xs transition-all"
            style={unit === u
              ? { backgroundColor: 'var(--color-lime)', color: '#000' }
              : { backgroundColor: 'var(--color-elevated)', color: '#ccc' }}>
            {u}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="number" placeholder={`Weight (${unit})`} value={value}
          onChange={e => setValue(e.target.value)} min="0" step="0.1"
          className="!py-1.5 !text-sm !rounded-lg flex-1" />
        <SubmitIcon onClick={() => { if (value) mut.mutate({ weight_kg: Number(value), unit }) }}
          disabled={!value || mut.isPending} />
      </div>
    </div>
  )
}

/* ─── Generic single-field ────────────────────────────────────────────────── */
function SimpleInline({ date, onSuccess, type, field, placeholder }: {
  date: string; onSuccess: () => void; type: string; field: string; placeholder: string
}) {
  const [value, setValue] = useState('')
  const mut = useLogMutation(type, date, () => { setValue(''); onSuccess() })

  return (
    <div className="flex gap-2">
      <input type="number" placeholder={placeholder} value={value}
        onChange={e => setValue(e.target.value)} min="0"
        className="!py-1.5 !text-sm !rounded-lg flex-1" autoFocus />
      <SubmitIcon onClick={() => { if (value) mut.mutate({ [field]: Number(value) }) }}
        disabled={!value || mut.isPending} />
    </div>
  )
}

/* ─── Small submit button ─────────────────────────────────────────────────── */
function SubmitIcon({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="p-1.5 rounded-lg bg-lime text-black disabled:opacity-40 flex-shrink-0 hover:brightness-110 transition-all">
      <Check size={16} />
    </button>
  )
}
