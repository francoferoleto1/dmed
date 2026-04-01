export const dynamic = 'force-dynamic'

import DashboardView from '@/components/DashboardView'
import { createServerSupabase } from '@/lib/server'
import { STOCK_LOW_THRESHOLD } from '@/lib/stock'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  let totalClientes = 0
  let totalArticulos = 0
  let totalVentas = 0
  let stockBajoCount = 0
  let ultimasVentas: any[] = []

  // Clientes
  const resClientes = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true })
  totalClientes = resClientes.count ?? 0

  // Artículos activos
  const resArticulos = await supabase
    .from('articulos')
    .select('*', { count: 'exact', head: true })
    .eq('descontinuado', false)
  totalArticulos = resArticulos.count ?? 0

  // Ventas
  const resVentas = await supabase
    .from('ventas')
    .select('*', { count: 'exact', head: true })
  totalVentas = resVentas.count ?? 0

  // Stock bajo
  const resStockBajo = await supabase
    .from('articulos')
    .select('*', { count: 'exact', head: true })
    .eq('descontinuado', false)
    .lt('stock', STOCK_LOW_THRESHOLD)
  stockBajoCount = resStockBajo.count ?? 0

  // Últimas ventas
  const resUltimas = await supabase
    .from('ventas')
    .select('control, fecha, total, clientes(nombre)')
    .order('fecha', { ascending: false })
    .limit(5)
  ultimasVentas = (resUltimas.data ?? []) as any[]

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