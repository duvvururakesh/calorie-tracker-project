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
      setError(e.response?.data?.error || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-4 py-8 safe-top safe-bottom bg-bg">
      <div className="w-full max-w-sm p-5 sm:p-8 rounded-2xl bg-surface">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-7 sm:mb-8">Welcome back</h1>
        <Alert message={error} type="error" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" loading={loading} loadingText="Signing in…">
            Sign in
          </Button>
        </form>
        <p className="text-center mt-6 text-sm text-gray-400">
          New to Fitit?{' '}
          <Link to="/signup" className="text-lime hover:brightness-110 transition-all">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
