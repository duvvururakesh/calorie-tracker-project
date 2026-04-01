import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import api from '@/api/client'

interface User { id: number; username: string; profile_name: string; email: string }
interface AuthCtx { user: User | null; loading: boolean; setUser: (u: User | null) => void }

const Ctx = createContext<AuthCtx>({ user: null, loading: true, setUser: () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/auth/me')
      .then((r: { data: User }) => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return <Ctx.Provider value={{ user, loading, setUser }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
