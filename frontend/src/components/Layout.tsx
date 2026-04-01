import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import api from '@/api/client'

export default function Layout() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await api.post('/auth/logout')
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg">
      <header
        className="bg-surface px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-3"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
      >
        {/* Brand */}
        <span className="font-bold text-lg tracking-tight select-none">
          Fit<span className="text-lime">it</span>
        </span>

        {/* Nav */}
        <nav className="flex items-center gap-5 text-sm font-semibold flex-wrap justify-center">
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/log',       label: 'Log' },
            { to: '/goals',     label: 'Goals' },
            { to: '/settings',  label: 'Settings' },
          ].map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive
                  ? 'text-lime font-bold'
                  : 'text-gray-400 hover:text-white transition-colors'
              }
            >
              {label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="text-danger px-3 py-1 rounded-lg hover:bg-danger/10 transition-colors font-semibold"
          >
            Logout
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
