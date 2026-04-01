import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/api/client'
import { useAuth } from '@/hooks/useAuth'

export default function SignupPage() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try {
      const r = await api.post('/auth/signup', { username, email, password })
      setUser(r.data); navigate('/settings')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Signup failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#121212' }}>
      <div className="w-full max-w-sm p-8 rounded-2xl" style={{ backgroundColor: '#1E1E1E' }}>
        <h1 className="text-3xl font-bold text-center mb-8">Sign Up</h1>
        {error && <div className="mb-4 p-3 rounded-xl text-sm" style={{ borderLeft: '4px solid #FF375F', color: '#FF375F', backgroundColor: '#1a1a1a' }}>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <input type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl font-bold" style={{ backgroundColor: '#C7FF41', color: '#000' }}>
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>
        <p className="text-center mt-6 text-sm text-gray-400">
          Already have an account? <Link to="/login" style={{ color: '#C7FF41' }}>Login</Link>
        </p>
      </div>
    </div>
  )
}
