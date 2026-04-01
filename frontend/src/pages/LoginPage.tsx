import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/api/client'
import { useAuth } from '@/hooks/useAuth'
import Alert from '@/components/Alert'
import Button from '@/components/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/login', { email, password })
      setUser(r.data)
      navigate('/dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-sm p-8 rounded-2xl bg-surface">
        <h1 className="text-3xl font-bold text-center mb-8">Login</h1>
        <Alert message={error} type="error" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" loading={loading} loadingText="Logging in…">
            Login
          </Button>
        </form>
        <p className="text-center mt-6 text-sm text-gray-400">
          Don't have an account?{' '}
          <Link to="/signup" className="text-lime hover:brightness-110 transition-all">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
