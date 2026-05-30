import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BarChart3, Bot, ListPlus, LogOut, Settings, Target, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import api from '@/api/client'

export default function Layout() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const navItems = [
    { to: '/dashboard', label: 'Home', icon: BarChart3 },
    { to: '/log',       label: 'Log', icon: ListPlus },
    { to: '/coach',     label: 'Nibbly', icon: Bot },
    { to: '/goals',     label: 'Goals', icon: Target },
    { to: '/settings',  label: 'Settings', icon: Settings },
  ]

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
    <div className="min-h-svh bg-bg overflow-x-clip">
      <header
        className="safe-top sticky top-0 z-40 bg-bg/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between border-b border-white/8"
      >
        {/* Brand — links to home */}
        <NavLink to="/dashboard" className="min-h-11 min-w-11 flex items-center font-bold text-lg tracking-tight select-none">
          Fit<span className="text-lime">it</span>
        </NavLink>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `min-h-10 px-3 rounded-lg flex items-center gap-2 transition-colors ${
                  isActive ? 'text-black bg-lime' : 'text-gray-400 hover:text-white hover:bg-surface'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Profile dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen(v => !v)}
            aria-label="Open account menu"
            className={`w-11 h-11 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-colors
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
                { to: '/settings', label: 'Settings' },
              ].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-3 md:py-2 text-sm font-semibold transition-colors
                    ${isActive ? 'text-lime' : 'text-gray-300 hover:text-white hover:bg-elevated'}`
                  }
                >
                  {label}
                </NavLink>
              ))}
              <div className="border-t border-elevated my-1" />
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 md:py-2 text-sm font-semibold text-danger hover:bg-danger/10 transition-colors flex items-center gap-2"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-4 sm:px-5 py-4 sm:py-8 pb-mobile-nav md:pb-12">
        <Outlet />
      </main>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 safe-bottom bg-surface/95 backdrop-blur border-t border-elevated">
        <div className="grid grid-cols-5 px-2 pt-2">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `min-h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors
                ${isActive ? 'text-lime bg-elevated' : 'text-gray-400'}`
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
