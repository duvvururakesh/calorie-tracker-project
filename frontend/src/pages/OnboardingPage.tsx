import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/api/client'
import Alert from '@/components/Alert'
import Button from '@/components/Button'
import { useAuth } from '@/hooks/useAuth'

const activityOptions = [
  { value: 'sedentary', label: 'Mostly sitting', detail: 'Desk-heavy day, limited walking' },
  { value: 'light', label: 'Light movement', detail: 'Some walking or light errands' },
  { value: 'moderate', label: 'Moderate movement', detail: 'Regular walking or training' },
  { value: 'active', label: 'Very active day', detail: 'Workout or active job' },
  { value: 'extra_active', label: 'High-output day', detail: 'Hard training or physical work' },
]

const kgToLb = (kg: number) => kg * 2.20462
const lbToKg = (lb: number) => lb / 2.20462
const cmToInches = (cm: number) => cm / 2.54
const inchesToCm = (inches: number) => inches * 2.54

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState({
    profile_name: user?.profile_name || '',
    height_cm: '',
    weight_kg: '',
    date_of_birth: '',
    gender: '',
    activity_level: 'sedentary',
  })
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm')
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg')
  const [heightFt, setHeightFt] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [weightLb, setWeightLb] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateHeightUnit(next: 'cm' | 'ft') {
    if (next === heightUnit) return
    if (next === 'ft' && profile.height_cm) {
      const totalInches = cmToInches(Number(profile.height_cm))
      const feet = Math.floor(totalInches / 12)
      const inches = Math.round((totalInches - feet * 12) * 10) / 10
      setHeightFt(String(feet || ''))
      setHeightIn(String(inches || ''))
    }
    if (next === 'cm' && (heightFt || heightIn)) {
      const totalInches = Number(heightFt || 0) * 12 + Number(heightIn || 0)
      setProfile(v => ({ ...v, height_cm: totalInches ? String(Math.round(inchesToCm(totalInches))) : '' }))
    }
    setHeightUnit(next)
  }

  function updateWeightUnit(next: 'kg' | 'lb') {
    if (next === weightUnit) return
    if (next === 'lb' && profile.weight_kg) {
      setWeightLb(String(Math.round(kgToLb(Number(profile.weight_kg)) * 10) / 10))
    }
    if (next === 'kg' && weightLb) {
      setProfile(v => ({ ...v, weight_kg: String(Math.round(lbToKg(Number(weightLb)) * 10) / 10) }))
    }
    setWeightUnit(next)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    const height = heightUnit === 'cm'
      ? Number(profile.height_cm)
      : inchesToCm(Number(heightFt || 0) * 12 + Number(heightIn || 0))
    const weight = weightUnit === 'kg'
      ? Number(profile.weight_kg)
      : lbToKg(Number(weightLb))

    if (!height || height < 80 || height > 260) {
      setError('Enter a realistic height.')
      return
    }
    if (!weight || weight < 25 || weight > 350) {
      setError('Enter a realistic weight.')
      return
    }
    if (!profile.date_of_birth || !profile.gender || !profile.activity_level) {
      setError('Complete the required profile details.')
      return
    }

    setLoading(true)
    try {
      await api.put('/profile', {
        ...profile,
        height_cm: String(Math.round(height * 10) / 10),
        weight_kg: String(Math.round(weight * 10) / 10),
      })
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Profile setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-svh bg-bg text-white safe-top safe-bottom">
      <div className="mx-auto flex min-h-svh w-full max-w-md flex-col px-5 pb-6 pt-8">
        <div className="mb-7">
          <p className="text-sm font-semibold text-lime">Fitit setup</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Build your baseline</h1>
          <p className="mt-3 text-base leading-snug text-gray-400">
            These details power BMI, maintenance calories, daily targets, and better Nibbly responses.
          </p>
        </div>

        <Alert message={error} type="error" />

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4">
          <div>
            <label htmlFor="onboarding-name" className="mb-1 block text-sm text-gray-400">Display name</label>
            <input
              id="onboarding-name"
              name="profile_name"
              type="text"
              autoComplete="name"
              placeholder={user?.username || 'Your name'}
              value={profile.profile_name}
              onChange={e => setProfile(v => ({ ...v, profile_name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-gray-400">Height</label>
              <div className="flex rounded-full bg-elevated p-1 text-xs font-semibold">
                {(['cm', 'ft'] as const).map(unit => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => updateHeightUnit(unit)}
                    className={`min-h-8 rounded-full px-3 ${heightUnit === unit ? 'bg-lime text-black' : 'text-gray-400'}`}
                  >
                    {unit === 'cm' ? 'cm' : 'ft/in'}
                  </button>
                ))}
              </div>
            </div>
            {heightUnit === 'cm' ? (
              <input
                id="onboarding-height"
                name="height_cm"
                type="number"
                inputMode="decimal"
                min="80"
                max="260"
                placeholder="175 cm"
                value={profile.height_cm}
                onChange={e => setProfile(v => ({ ...v, height_cm: e.target.value }))}
                required
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <input
                  aria-label="Height feet"
                  name="height_ft"
                  type="number"
                  inputMode="numeric"
                  min="2"
                  max="8"
                  placeholder="5 ft"
                  value={heightFt}
                  onChange={e => setHeightFt(e.target.value)}
                  required
                />
                <input
                  aria-label="Height inches"
                  name="height_in"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="11.9"
                  step="0.1"
                  placeholder="10 in"
                  value={heightIn}
                  onChange={e => setHeightIn(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={weightUnit === 'kg' ? 'onboarding-weight-kg' : 'onboarding-weight-lb'} className="text-sm text-gray-400">Weight</label>
              <div className="flex rounded-full bg-elevated p-1 text-xs font-semibold">
                {(['kg', 'lb'] as const).map(unit => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => updateWeightUnit(unit)}
                    className={`min-h-8 rounded-full px-3 ${weightUnit === unit ? 'bg-lime text-black' : 'text-gray-400'}`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
            {weightUnit === 'kg' ? (
              <input
                id="onboarding-weight-kg"
                name="weight_kg"
                type="number"
                inputMode="decimal"
                min="25"
                max="350"
                step="0.1"
                placeholder="72 kg"
                value={profile.weight_kg}
                onChange={e => setProfile(v => ({ ...v, weight_kg: e.target.value }))}
                required
              />
            ) : (
              <input
                id="onboarding-weight-lb"
                name="weight_lb"
                type="number"
                inputMode="decimal"
                min="55"
                max="770"
                step="0.1"
                placeholder="160 lb"
                value={weightLb}
                onChange={e => setWeightLb(e.target.value)}
                required
              />
            )}
          </div>

          <div>
            <label htmlFor="onboarding-dob" className="mb-1 block text-sm text-gray-400">Date of birth</label>
            <input
              id="onboarding-dob"
              name="date_of_birth"
              type="date"
              autoComplete="bday"
              value={profile.date_of_birth}
              onChange={e => setProfile(v => ({ ...v, date_of_birth: e.target.value }))}
              required
            />
          </div>

          <div>
            <label htmlFor="onboarding-gender" className="mb-1 block text-sm text-gray-400">Gender</label>
            <select
              id="onboarding-gender"
              name="gender"
              value={profile.gender}
              onChange={e => setProfile(v => ({ ...v, gender: e.target.value }))}
              required
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm text-gray-400">Daily routine</legend>
            {activityOptions.map(option => (
              <label
                key={option.value}
                className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                  profile.activity_level === option.value
                    ? 'border-lime bg-lime/12'
                    : 'border-white/10 bg-surface/80'
                }`}
              >
                <input
                  type="radio"
                  name="activity_level"
                  value={option.value}
                  checked={profile.activity_level === option.value}
                  onChange={e => setProfile(v => ({ ...v, activity_level: e.target.value }))}
                  className="h-5 w-5 shrink-0 accent-lime"
                />
                <span className="min-w-0">
                  <span className="block font-semibold">{option.label}</span>
                  <span className="block text-sm leading-snug text-gray-500">{option.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="sticky bottom-0 -mx-5 mt-auto bg-bg/95 px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 backdrop-blur">
            <Button type="submit" loading={loading} loadingText="Setting up...">
              Finish setup
            </Button>
          </div>
        </form>
      </div>
    </main>
  )
}
