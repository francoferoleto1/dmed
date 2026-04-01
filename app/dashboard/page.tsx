export const dynamic = 'force-dynamic'

import DashboardView from '@/components/DashboardView'
import { createServerSupabase } from '@/lib/server'
import { STOCK_LOW_THRESHOLD } from '@/lib/stock'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  // Queries con null safety — no destructuramos directo
  const [clientesRes, articulosRes, ventasRes, stockBajoRes, ultimasVentasRes] =
    await Promise.all([
      supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .catch(() => ({ count: null, data: null, error: null })),
      supabase
        .from('articulos')
        .select('*', { count: 'exact', head: true })
        .eq('descontinuado', false)
        .catch(() => ({ count: null, data: null, error: null })),
      supabase
        .from('ventas')
        .select('*', { count: 'exact', head: true })
        .catch(() => ({ count: null, data: null, error: null })),
      supabase
        .from('articulos')
        .select('*', { count: 'exact', head: true })
        .eq('descontinuado', false)
        .lt('stock', STOCK_LOW_THRESHOLD)
        .catch(() => ({ count: null, data: null, error: null })),
      supabase
        .from('ventas')
        .select('control, fecha, total, clientes(nombre)')
        .order('fecha', { ascending: false })
        .limit(5)
        .catch(() => ({ count: null, data: null, error: null })),
    ])

  // Extraer con ?? 0 para que NUNCA sea undefined
  const totalClientes = clientesRes?.count ?? 0
  const totalArticulos = articulosRes?.count ?? 0
  const totalVentas = ventasRes?.count ?? 0
  const stockBajoCount = stockBajoRes?.count ?? 0
  const ultimasVentas = (ultimasVentasRes?.data ?? []) as any[]

  const baseStats = [
    {
      label: 'Clientes',
      value: totalClientes,
      icon: 'users' as const,
      cardClass: 'bg-white border-blue-100 text-blue-900',
      iconWrap: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'Artículos activos',
      value: totalArticulos,
      icon: 'pill' as const,
      cardClass: 'bg-white border-emerald-100 text-emerald-900',
      iconWrap: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'Remitos totales',
      value: totalVentas,
      icon: 'file' as const,
      cardClass: 'bg-white border-amber-100 text-amber-950',
      iconWrap: 'bg-amber-100 text-amber-800',
    },
  ]

  return (
    <DashboardView
      baseStats={baseStats}
      stockBajo={{ count: stockBajoCount, threshold: STOCK_LOW_THRESHOLD }}
      ultimasVentas={ultimasVentas}
    />
  )
}