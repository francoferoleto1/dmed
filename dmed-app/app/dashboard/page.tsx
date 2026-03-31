import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies })

  const [
    { count: totalClientes },
    { count: totalArticulos },
    { count: totalVentas },
    { data: ultimasVentas },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('articulos').select('*', { count: 'exact', head: true }).eq('descontinuado', false),
    supabase.from('ventas').select('*', { count: 'exact', head: true }),
    supabase.from('ventas').select('control, fecha, total, clientes(nombre)').order('fecha', { ascending: false }).limit(5),
  ])

  const stats = [
    { label: 'Clientes', value: totalClientes ?? 0, icon: '👥', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'Artículos activos', value: totalArticulos ?? 0, icon: '💊', color: 'bg-green-50 text-green-700 border-green-100' },
    { label: 'Remitos totales', value: totalVentas ?? 0, icon: '🧾', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Panel principal</h1>
        <p className="text-gray-500 text-sm mt-1">Bienvenido al sistema de gestión DMED</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {stats.map(s => (
          <div key={s.label} className={`rounded-2xl border p-6 ${s.color}`}>
            <div className="text-3xl mb-3">{s.icon}</div>
            <div className="text-3xl font-bold">{s.value.toLocaleString('es-AR')}</div>
            <div className="text-sm font-medium mt-1 opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Últimas ventas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Últimos remitos</h2>
          <a href="/ventas" className="text-sm text-brand-600 hover:text-brand-700 font-medium">Ver todos →</a>
        </div>
        <div className="divide-y divide-gray-50">
          {ultimasVentas?.map((v: any) => (
            <div key={v.control} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div>
                <span className="font-mono text-xs text-gray-400 mr-3">#{String(v.control).padStart(6, '0')}</span>
                <span className="text-sm font-medium text-gray-800">{v.clientes?.nombre ?? 'Sin cliente'}</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-xs text-gray-400">{new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR')}</span>
                <span className="text-sm font-semibold text-brand-700">${Number(v.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
