'use client'

import Link from 'next/link'
import { FileText, Pill, TriangleAlert, Users } from 'lucide-react'

type VentaRow = {
  control: number
  fecha: string
  total: number
  clientes?: { nombre: string } | null
}

type Stat = {
  label: string
  value: number
  icon: 'users' | 'pill' | 'file' | 'alert'
  cardClass: string
  iconWrap: string
}

const icons = {
  users: Users,
  pill: Pill,
  file: FileText,
  alert: TriangleAlert,
}

export default function DashboardView({
  stats,
  ultimasVentas,
}: {
  stats: Stat[]
  ultimasVentas: VentaRow[] | null
}) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Panel principal</h1>
        <p className="mt-1 text-sm text-gray-600">Bienvenido al sistema de gestión DMED</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        {stats.map(s => {
          const Icon = icons[s.icon]
          return (
            <div
              key={s.label}
              className={`rounded-2xl border p-6 shadow-card transition-shadow duration-200 hover:shadow-card-md ${s.cardClass}`}
            >
              <div className={`mb-4 inline-flex rounded-xl p-2.5 ${s.iconWrap}`}>
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <div className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
                {s.value.toLocaleString('es-AR')}
              </div>
              <div className="mt-2 text-sm font-medium leading-snug opacity-90">{s.label}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-gray-900">Últimos remitos</h2>
          <Link
            href="/ventas"
            className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
          >
            Ver todos →
          </Link>
        </div>
        <ul className="divide-y divide-gray-50">
          {ultimasVentas?.map(v => (
            <li
              key={v.control}
              className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-gray-50/90 sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-lg bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand-800 ring-1 ring-brand-100">
                  #{String(v.control).padStart(6, '0')}
                </span>
                <span className="font-medium text-gray-900">{v.clientes?.nombre ?? 'Sin cliente'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                </span>
                <span className="font-semibold tabular-nums text-brand-700">
                  ${Number(v.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
