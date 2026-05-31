import { cloneElement, isValidElement, useId, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import api from '@/api/client'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Alert from '@/components/Alert'

type TabKey = 'profile' | 'sharing' | 'account'

type Privacy = {
  show_calories: boolean
  show_macros: boolean
  show_water: boolean
  show_steps: boolean
  show_sleep: boolean
  show_weight: boolean
  show_food_names: boolean
}

const privacyLabels: { key: keyof Privacy; label: string; detail: string }[] = [
  { key: 'show_calories', label: 'Calories Intake', detail: 'Daily food calories' },
  { key: 'show_macros', label: 'Macros', detail: 'Protein, carbs, and fat' },
  { key: 'show_water', label: 'Water', detail: 'Daily water total' },
  { key: 'show_steps', label: 'Steps', detail: 'Daily step total' },
  { key: 'show_sleep', label: 'Sleep', detail: 'Sleep duration' },
  { key: 'show_weight', label: 'Weight', detail: 'Latest weight' },
  { key: 'show_food_names', label: 'Food names', detail: 'Recent food labels' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-gray-400 mb-1">{label}</label>
      {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id: children.props.id || id }) : children}
    </div>
  )
}

export default function SettingsPage() {
  const qc = useQueryClient()
  const [tab, setTab]           = useState<TabKey>('profile')
  const [profileMsg, setProfileMsg] = useState('')
  const [accountMsg, setAccountMsg] = useState('')
  const [accountErr, setAccountErr] = useState('')

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then(r => r.data),
  })
  const { data: privacy } = useQuery({
    queryKey: ['friend-privacy'],
    queryFn: () => api.get('/privacy/friends').then(r => r.data as Privacy),
  })

  const [p, setP] = useState({
    height_cm: '', weight_kg: '', date_of_birth: '',
    gender: '', activity_level: 'sedentary', profile_name: '',
  })
  const [a, setA] = useState({
    username: '', email: '',
    current_password: '', new_password: '', confirm_new_password: '',
  })

  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setP({
        height_cm:     profile.height_cm     || '',
        weight_kg:     profile.weight_kg     || '',
        date_of_birth: profile.date_of_birth || '',
        gender:        profile.gender        || '',
        activity_level: profile.activity_level || 'sedentary',
        profile_name:  profile.profile_name  || '',
      })
      setA(prev => ({
        ...prev,
        username: profile.username || '',
        email:    profile.email    || '',
      }))
    }
  }, [profile])

  const profileMut = useMutation({
    mutationFn: () => api.put('/profile', p),
    onSuccess: () => {
      setProfileMsg('Profile saved')
      setTimeout(() => setProfileMsg(''), 2500)
    },
  })

  const accountMut = useMutation({
    mutationFn: () => api.put('/account', a),
    onSuccess: () => {
      setAccountMsg('Account saved')
      setAccountErr('')
      setTimeout(() => setAccountMsg(''), 2500)
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } }
      setAccountErr(e.response?.data?.error || 'Update failed')
    },
  })
  const privacyMut = useMutation({
    mutationFn: (next: Privacy) => api.put('/privacy/friends', next),
    onSuccess: response => {
      qc.setQueryData(['friend-privacy'], response.data)
      qc.invalidateQueries({ queryKey: ['friends'] })
      qc.invalidateQueries({ queryKey: ['friends-activity'] })
    },
  })

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'sharing', label: 'Sharing' },
    { key: 'account', label: 'Account' },
  ]

  return (
    <div className="max-w-2xl mx-auto min-w-0">
      <div className="mb-3 sm:mb-6">
        <p className="text-sm text-gray-400">Profile, sharing, and sign-in</p>
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
      </div>

      <Card>
        <div className="flex gap-2 mb-4 sm:mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 min-h-11 px-2 py-2 rounded-xl font-semibold text-sm transition-colors"
              style={
                tab === t.key
                  ? { backgroundColor: 'var(--color-lime)', color: '#000' }
                  : { backgroundColor: 'var(--color-elevated)', color: '#ccc' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === 'profile' && (
          <div className="space-y-3 sm:space-y-4">
            <Field label="Display name">
              <input name="profile_name" type="text" value={p.profile_name}
                onChange={e => setP(v => ({ ...v, profile_name: e.target.value }))} />
            </Field>
            <Field label="Height (cm)">
              <input name="height_cm" type="number" value={p.height_cm}
                onChange={e => setP(v => ({ ...v, height_cm: e.target.value }))} min="0" />
            </Field>
            <Field label="Weight (kg)">
              <input name="weight_kg" type="number" value={p.weight_kg}
                onChange={e => setP(v => ({ ...v, weight_kg: e.target.value }))} min="0" step="0.1" />
            </Field>
            <Field label="Date of birth">
              <input name="date_of_birth" type="date" value={p.date_of_birth}
                onChange={e => setP(v => ({ ...v, date_of_birth: e.target.value }))} />
            </Field>
            <Field label="Gender">
              <select name="gender" value={p.gender} onChange={e => setP(v => ({ ...v, gender: e.target.value }))}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Daily routine">
              <select name="activity_level" value={p.activity_level}
                onChange={e => setP(v => ({ ...v, activity_level: e.target.value }))}>
                <option value="sedentary">Mostly sitting</option>
                <option value="light">Light movement</option>
                <option value="moderate">Moderate movement</option>
                <option value="active">Very active day</option>
                <option value="extra_active">High-output day</option>
              </select>
            </Field>
            {profileMsg && <Alert message={profileMsg} type="success" />}
            <Button onClick={() => profileMut.mutate()} loading={profileMut.isPending}>
              Save Profile
            </Button>
          </div>
        )}

        {/* Sharing tab */}
        {tab === 'sharing' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-elevated text-lime flex items-center justify-center shrink-0">
                <Lock size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight">Friend sharing</h2>
                <p className="text-sm text-gray-500 leading-snug">
                  Accepted friends only see the daily totals you enable here.
                </p>
              </div>
            </div>

            {privacy && (
              <div className="divide-y divide-white/8 rounded-2xl bg-elevated/45 px-3">
                {privacyLabels.map(item => (
                  <label key={item.key} className="flex items-center justify-between gap-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold">{item.label}</span>
                      <span className="block text-sm text-gray-500 leading-snug">{item.detail}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-6 w-6 shrink-0 accent-lime"
                      checked={privacy[item.key]}
                      onChange={e => privacyMut.mutate({ ...privacy, [item.key]: e.target.checked })}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Account tab */}
        {tab === 'account' && (
          <div className="space-y-3 sm:space-y-4">
            <Field label="Username">
              <input name="username" type="text" value={a.username}
                onChange={e => setA(v => ({ ...v, username: e.target.value }))} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" value={a.email}
                onChange={e => setA(v => ({ ...v, email: e.target.value }))} />
            </Field>
            <hr style={{ borderColor: 'var(--color-elevated)' }} />
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Change password
            </p>
            <Field label="Current password">
              <input name="current_password" type="password" placeholder="Current password"
                value={a.current_password}
                onChange={e => setA(v => ({ ...v, current_password: e.target.value }))} />
            </Field>
            <Field label="New password">
              <input name="new_password" type="password" placeholder="New password"
                value={a.new_password}
                onChange={e => setA(v => ({ ...v, new_password: e.target.value }))} />
            </Field>
            <Field label="Confirm new password">
              <input name="confirm_new_password" type="password" placeholder="Confirm new password"
                value={a.confirm_new_password}
                onChange={e => setA(v => ({ ...v, confirm_new_password: e.target.value }))} />
            </Field>
            {accountErr && <Alert message={accountErr} type="error" />}
            {accountMsg && <Alert message={accountMsg} type="success" />}
            <Button onClick={() => accountMut.mutate()} loading={accountMut.isPending}>
              Save Account
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
