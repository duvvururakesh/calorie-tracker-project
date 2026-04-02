import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/api/client'

export default function Layout() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function handleLogout() {
    await api.post('/auth/logout')
    setUser(null)
    navigate('/login')
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-bg">
      <header
        className="bg-surface px-6 py-4 flex items-center justify-between"
        style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
      >
        {/* Brand — links to home */}
        <NavLink to="/dashboard" className="font-bold text-lg tracking-tight select-none">
          Fit<span className="text-lime">it</span>
        </NavLink>

        {/* Nav */}
        <nav className="flex items-center gap-5 text-sm font-semibold">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? 'text-lime font-bold' : 'text-gray-400 hover:text-white transition-colors'
            }
          >
            Home
          </NavLink>

          {/* Profile dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
                ${open ? 'bg-lime text-black' : 'bg-elevated text-gray-300 hover:text-white'}`}
            >
              <User size={16} />
            </button>

            {open && (
              <div
                className="absolute right-0 mt-2 w-44 rounded-xl bg-surface py-1 z-50"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
              >
                {[
                  { to: '/log',      label: 'Log' },
                  { to: '/goals',    label: 'Goals' },
                  { to: '/settings', label: 'Settings' },
                ].map(({ to, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `block px-4 py-2 text-sm font-semibold transition-colors
                      ${isActive ? 'text-lime' : 'text-gray-300 hover:text-white hover:bg-elevated'}`
                    }
                  >
                    {label}
                  </NavLink>
                ))}
                <div className="border-t border-elevated my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
