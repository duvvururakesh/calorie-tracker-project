import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import api from '@/api/client'

export default function Layout() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await api.post('/auth/logout')
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#121212' }}>
      <header style={{ backgroundColor: '#1E1E1E', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
              className="px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-3">
        <div className="font-bold text-lg">
          Welcome, <span style={{ color: '#C7FF41' }}>{user?.profile_name || user?.username}</span>
        </div>
        <nav className="flex items-center gap-6 font-semibold text-sm">
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/log', label: 'Log' },
            { to: '/goals', label: 'Goals' },
            { to: '/settings', label: 'Settings' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => isActive ? '' : 'text-gray-400 hover:text-white transition-colors'}
              style={({ isActive }) => isActive ? { color: '#C7FF41' } : {}}>
              {label}
            </NavLink>
          ))}
          <button onClick={handleLogout} style={{ color: '#FF375F' }}
                  className="hover:opacity-80 transition-opacity">
            Logout
          </button>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24">
        <Outlet />
      </main>
    </div>
  )
}
