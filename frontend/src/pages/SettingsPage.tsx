import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '@/api/client'

type TabKey = 'profile' | 'account'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>('profile')
  const [profileMsg, setProfileMsg] = useState('')
  const [accountMsg, setAccountMsg] = useState('')
  const [accountErr, setAccountErr] = useState('')

  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: () => api.get('/profile').then(r => r.data) })

  const [p, setP] = useState({ height_cm: '', weight_kg: '', date_of_birth: '', gender: '', activity_level: 'sedentary', profile_name: '' })
  const [a, setA] = useState({ username: '', profile_name: '', email: '', current_password: '', new_password: '', confirm_new_password: '' })

  useEffect(() => {
    if (profile) {
      setP({ height_cm: profile.height_cm || '', weight_kg: profile.weight_kg || '', date_of_birth: profile.date_of_birth || '', gender: profile.gender || '', activity_level: profile.activity_level || 'sedentary', profile_name: profile.profile_name || '' })
      setA(prev => ({ ...prev, username: profile.username || '', email: profile.email || '', profile_name: profile.profile_name || '' }))
    }
  }, [profile])

  const profileMut = useMutation({
    mutationFn: () => api.put('/profile', p),
    onSuccess: () => { setProfileMsg('Profile updated!'); setTimeout(() => setProfileMsg(''), 2500) },
  })

  const accountMut = useMutation({
    mutationFn: () => api.put('/account', a),
    onSuccess: () => { setAccountMsg('Account updated!'); setAccountErr(''); setTimeout(() => setAccountMsg(''), 2500) },
    onError: (err: any) => { setAccountErr(err.response?.data?.error || 'Update failed') },
  })

  const tabs: { key: TabKey; label: string }[] = [{ key: 'profile', label: 'Profile' }, { key: 'account', label: 'Account' }]

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <a href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">← Dashboard</a>
      </div>
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#1E1E1E' }}>
        {/* Tab bar */}
        <div className="flex mb-6 border-b" style={{ borderColor: '#2A2A2A' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className="flex-1 py-3 font-semibold text-sm transition-all border-b-2"
                    style={tab === t.key
                      ? { borderColor: '#C7FF41', color: '#C7FF41' }
                      : { borderColor: 'transparent', color: '#888' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <Field label="Display Name">
              <input type="text" value={p.profile_name} onChange={e => setP(v => ({ ...v, profile_name: e.target.value }))} />
            </Field>
            <Field label="Height (cm)">
              <input type="number" value={p.height_cm} onChange={e => setP(v => ({ ...v, height_cm: e.target.value }))} min="0" />
            </Field>
            <Field label="Weight (kg)">
              <input type="number" value={p.weight_kg} onChange={e => setP(v => ({ ...v, weight_kg: e.target.value }))} min="0" step="0.1" />
            </Field>
            <Field label="Date of Birth">
              <input type="date" value={p.date_of_birth} onChange={e => setP(v => ({ ...v, date_of_birth: e.target.value }))} />
            </Field>
            <Field label="Gender">
              <select value={p.gender} onChange={e => setP(v => ({ ...v, gender: e.target.value }))}>
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Activity Level">
              <select value={p.activity_level} onChange={e => setP(v => ({ ...v, activity_level: e.target.value }))}>
                <option value="sedentary">Sedentary</option>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="active">Active</option>
                <option value="extra_active">Extra Active</option>
              </select>
            </Field>
            {profileMsg && <p className="text-sm" style={{ color: '#C7FF41' }}>{profileMsg}</p>}
            <button onClick={() => profileMut.mutate()}
                    className="w-full py-3 rounded-xl font-bold transition-all"
                    style={{ backgroundColor: '#C7FF41', color: '#000' }}>
              {profileMut.isPending ? 'Saving…' : 'Save Profile'}
            </button>
          </div>
        )}

        {/* Account tab */}
        {tab === 'account' && (
          <div className="space-y-4">
            <Field label="Username">
              <input type="text" value={a.username} onChange={e => setA(v => ({ ...v, username: e.target.value }))} />
            </Field>
            <Field label="Display Name">
              <input type="text" value={a.profile_name} onChange={e => setA(v => ({ ...v, profile_name: e.target.value }))} />
            </Field>
            <Field label="Email">
              <input type="email" value={a.email} onChange={e => setA(v => ({ ...v, email: e.target.value }))} />
            </Field>
            <hr style={{ borderColor: '#2A2A2A' }} />
            <Field label="Current Password">
              <input type="password" placeholder="Current Password" value={a.current_password} onChange={e => setA(v => ({ ...v, current_password: e.target.value }))} />
            </Field>
            <Field label="New Password">
              <input type="password" placeholder="New Password" value={a.new_password} onChange={e => setA(v => ({ ...v, new_password: e.target.value }))} />
            </Field>
            <Field label="Confirm New Password">
              <input type="password" placeholder="Confirm New Password" value={a.confirm_new_password} onChange={e => setA(v => ({ ...v, confirm_new_password: e.target.value }))} />
            </Field>
            {accountErr && <p className="text-sm" style={{ color: '#FF375F' }}>{accountErr}</p>}
            {accountMsg && <p className="text-sm" style={{ color: '#C7FF41' }}>{accountMsg}</p>}
            <button onClick={() => accountMut.mutate()}
                    className="w-full py-3 rounded-xl font-bold transition-all"
                    style={{ backgroundColor: '#C7FF41', color: '#000' }}>
              {accountMut.isPending ? 'Saving…' : 'Save Account'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
