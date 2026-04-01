'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  FilePlus2,
  Users,
  Package,
  LogOut,
  Pill,
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

const nav = [
  { href: '/dashboard', label: 'Inicio', Icon: LayoutDashboard },
  { href: '/ventas', label: 'Remitos', Icon: FileText },
  { href: '/ventas/nueva', label: 'Nuevo remito', Icon: FilePlus2 },
  { href: '/clientes', label: 'Clientes', Icon: Users },
  { href: '/articulos', label: 'Artículos', Icon: Package },
] as const

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  if (href === '/ventas/nueva') return pathname === '/ventas/nueva'
  if (href === '/ventas') return pathname.startsWith('/ventas') && pathname !== '/ventas/nueva'
  if (href === '/clientes') return pathname.startsWith('/clientes')
  if (href === '/articulos') return pathname.startsWith('/articulos')
  return pathname === href
}

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
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-slate-950 via-brand-950 to-slate-900 shadow-xl sm:w-64">
      <div className="border-b border-white/10 px-4 py-6 sm:px-5">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-900/40 transition-transform duration-200 group-hover:scale-[1.03]">
            <Pill className="h-5 w-5 text-white" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-white">DMED</p>
            <p className="text-xs font-medium text-brand-200/90">Gestión farmacéutica</p>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4 sm:px-3">
        {nav.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-white/12 text-white shadow-inner'
                  : 'text-slate-300 hover:bg-white/6 hover:text-white'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-brand-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]" />
              )}
              <Icon
                className={`h-[18px] w-[18px] shrink-0 transition-transform duration-200 ${
                  active ? 'text-brand-300' : 'text-slate-400 group-hover:text-brand-200 group-hover:scale-105'
                }`}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-2 sm:p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-200"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
          Salir
        </button>
      </div>
    </aside>
  )
}
