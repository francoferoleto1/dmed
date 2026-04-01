'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Inicio',
  clientes: 'Clientes',
  articulos: 'Artículos',
  ventas: 'Remitos',
  nueva: 'Nuevo remito',
  movimientos: 'Movimientos',
  cuenta: 'Cuenta corriente',
  login: 'Ingresar',
}

function labelForSegment(segment: string, index: number, segments: string[]) {
  if (/^\d+$/.test(segment)) {
    if (segments[index - 1] === 'articulos') return `Artículo #${segment}`
    if (segments[index - 1] === 'clientes') return `Cliente #${segment}`
    return `#${segment}`
  }
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ')
}

export default function Breadcrumbs() {
  const pathname = usePathname()
  if (!pathname || pathname === '/login' || pathname === '/dashboard') return null

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const crumbs: { href: string; label: string }[] = []
  let acc = ''
  segments.forEach((seg, i) => {
    acc += `/${seg}`
    crumbs.push({ href: acc, label: labelForSegment(seg, i, segments) })
  })

  return (
    <nav aria-label="Ruta" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-gray-500 transition-colors hover:bg-white/80 hover:text-brand-700"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:inline">Inicio</span>
      </Link>
      {crumbs.map((c, i) => (
        <span key={c.href} className="inline-flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          {i === crumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{c.label}</span>
          ) : (
            <Link href={c.href} className="rounded-lg px-1.5 py-1 transition-colors hover:bg-white/80 hover:text-brand-700">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
