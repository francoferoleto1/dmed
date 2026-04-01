'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Articulo, MovimientoStock } from '@/lib/supabase'

const PAGE_SIZE = 25

function badgeTipo(tipo: string) {
  const t = tipo.toLowerCase()
  if (t === 'entrada') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-100'
  }
  if (t === 'salida') {
    return 'bg-red-50 text-red-700 border-red-100'
  }
  if (t === 'ajuste') {
    return 'bg-amber-50 text-amber-900 border-amber-100'
  }
  return 'bg-gray-50 text-gray-700 border-gray-100'
}

export default function ArticuloMovimientosPage() {
  const params = useParams()
  const id = Number(params.id)
  const supabase = useMemo(() => createClient(), [])

  const [articulo, setArticulo] = useState<Articulo | null>(null)
  const [movs, setMovs] = useState<MovimientoStock[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const cargar = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return
    setLoading(true)

    const { data: art } = await supabase.from('articulos').select('*').eq('id', id).single()
    setArticulo(art ?? null)

    let countQ = supabase
      .from('movimientos_stock')
      .select('*', { count: 'exact', head: true })
      .eq('articulo_id', id)

    let dataQ = supabase
      .from('movimientos_stock')
      .select('*')
      .eq('articulo_id', id)
      .order('created_at', { ascending: false })

    if (tipoFiltro) {
      countQ = countQ.eq('tipo', tipoFiltro)
      dataQ = dataQ.eq('tipo', tipoFiltro)
    }
    if (desde) {
      const d = new Date(desde + 'T00:00:00')
      countQ = countQ.gte('created_at', d.toISOString())
      dataQ = dataQ.gte('created_at', d.toISOString())
    }
    if (hasta) {
      const h = new Date(hasta + 'T23:59:59.999')
      countQ = countQ.lte('created_at', h.toISOString())
      dataQ = dataQ.lte('created_at', h.toISOString())
    }

    const { count } = await countQ
    setTotal(count ?? 0)

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const { data } = await dataQ.range(from, to)
    setMovs((data ?? []) as MovimientoStock[])
    setLoading(false)
  }, [supabase, id, tipoFiltro, desde, hasta, page])

  useEffect(() => {
    setPage(0)
  }, [tipoFiltro, desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div>
        <p className="text-red-600">Artículo inválido.</p>
        <Link href="/articulos" className="text-brand-600 text-sm">Volver</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/articulos" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            ← Artículos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Movimientos de stock
          </h1>
          {articulo ? (
            <p className="text-sm text-gray-500 mt-1">
              <span className="font-mono text-xs text-gray-400">{articulo.codigo}</span>
              {' · '}
              <span className="font-medium text-gray-800">{articulo.nombre}</span>
              {articulo.presentacion ? ` · ${articulo.presentacion}` : ''}
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Cargando artículo…</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5">
        <select
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          <option value="entrada">Entrada</option>
          <option value="salida">Salida</option>
          <option value="ajuste">Ajuste</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={e => setDesde(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 uppercase tracking-wide">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={e => setHasta(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
        <span className="text-sm text-gray-500 ml-auto">
          {total} movimiento{total === 1 ? '' : 's'}
        </span>
      </div>

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="table-data min-w-[720px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="text-right">Cantidad</th>
                <th>Stock</th>
                <th>Detalle</th>
                <th>Ref.</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
                  </td>
                </tr>
              ) : movs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-500">Sin movimientos</td>
                </tr>
              ) : (
                movs.map(m => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-gray-600">
                      {new Date(m.created_at).toLocaleString('es-AR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td>
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${badgeTipo(m.tipo)}`}
                      >
                        {m.tipo}
                      </span>
                    </td>
                    <td className="text-right font-mono tabular-nums">{m.cantidad}</td>
                    <td className="tabular-nums text-gray-700">
                      {m.stock_anterior} → {m.stock_nuevo}
                    </td>
                    <td className="max-w-[220px] truncate text-gray-600" title={m.detalle ?? ''}>
                      {m.detalle ?? '—'}
                    </td>
                    <td className="text-xs text-gray-500">
                      {m.referencia_tipo ?? '—'}
                      {m.referencia_id != null ? ` #${m.referencia_id}` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/50 px-5 py-3">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="btn-secondary py-2 text-sm disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página {page + 1} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              className="btn-secondary py-2 text-sm disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
