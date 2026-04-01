export const dynamic = 'force-dynamic'

import DashboardView from '@/components/DashboardView'
import { createServerSupabase } from '@/lib/server'
import { STOCK_LOW_THRESHOLD } from '@/lib/stock'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()

  const [
    { count: totalClientes },
    { count: totalArticulos },
    { count: totalVentas },
    { count: stockBajoCount },
    { data: ultimasVentas },
  ] = await Promise.all([
    supabase.from('clientes').select('*', { count: 'exact', head: true }),
    supabase.from('articulos').select('*', { count: 'exact', head: true }).eq('descontinuado', false),
    supabase.from('ventas').select('*', { count: 'exact', head: true }),
    supabase
      .from('articulos')
      .select('*', { count: 'exact', head: true })
      .eq('descontinuado', false)
      .lt('stock', STOCK_LOW_THRESHOLD),
    supabase.from('ventas').select('control, fecha, total, clientes(nombre)').order('fecha', { ascending: false }).limit(5),
  ])

  const stats = [
    {
      label: 'Clientes',
      value: totalClientes ?? 0,
      icon: 'users' as const,
      cardClass: 'bg-white border-blue-100 text-blue-900',
      iconWrap: 'bg-blue-100 text-blue-700',
    },
    {
      label: 'Artículos activos',
      value: totalArticulos ?? 0,
      icon: 'pill' as const,
      cardClass: 'bg-white border-emerald-100 text-emerald-900',
      iconWrap: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'Remitos totales',
      value: totalVentas ?? 0,
      icon: 'file' as const,
      cardClass: 'bg-white border-amber-100 text-amber-950',
      iconWrap: 'bg-amber-100 text-amber-800',
    },
    {
      label: `Stock bajo (menos de ${STOCK_LOW_THRESHOLD} u.)`,
      value: stockBajoCount ?? 0,
      icon: 'alert' as const,
      cardClass: 'bg-white border-orange-100 text-orange-950',
      iconWrap: 'bg-orange-100 text-orange-700',
    },
  ]

  return <DashboardView stats={stats} ultimasVentas={ultimasVentas as any} />
}
