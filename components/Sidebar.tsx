'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const nav = [
  { href: '/dashboard', label: 'Inicio', icon: '◈' },
  { href: '/ventas', label: 'Remitos', icon: '🧾' },
  { href: '/ventas/nueva', label: 'Nuevo Remito', icon: '＋' },
  { href: '/clientes', label: 'Clientes', icon: '👥' },
  { href: '/articulos', label: 'Artículos', icon: '💊' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 min-h-screen bg-brand-800 flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-brand-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-400 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">DMED</p>
            <p className="text-brand-300 text-xs mt-0.5">Gestión</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/ventas/nueva')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand-600 text-white'
                  : 'text-brand-200 hover:bg-brand-700 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-brand-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-300 hover:bg-brand-700 hover:text-white transition-colors"
        >
          <span>↩</span> Salir
        </button>
      </div>
    </aside>
  )
}
