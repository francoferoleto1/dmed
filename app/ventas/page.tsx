'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { FilePlus2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { createClient, Venta, VentaItem, Cliente } from '@/lib/supabase'
import { generarRemitoPDF } from '@/lib/pdf'

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState<{ venta: Venta; items: VentaItem[]; cliente: Cliente } | null>(
    null
  )
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('ventas')
        .select('*, clientes(nombre)')
        .order('fecha', { ascending: false })
        .limit(200)
      if (error) toast.error(error.message)
      setVentas(data ?? [])
      setLoading(false)
    }
    cargar()
  }, [])

  const filtradas = ventas.filter(v => {
    const nombre = (v as any).clientes?.nombre?.toLowerCase() ?? ''
    return (
      nombre.includes(busqueda.toLowerCase()) ||
      String(v.control).includes(busqueda)
    )
  })

  const verDetalle = async (v: Venta) => {
    setLoadingDetalle(true)
    setDetalle(null)
    try {
      const [{ data: items, error: e1 }, { data: cliente, error: e2 }] = await Promise.all([
        supabase.from('ventas_items').select('*, articulos(nombre, presentacion)').eq('venta_control', v.control),
        supabase.from('clientes').select('*').eq('id', v.cliente_id).single(),
      ])
      if (e1 || e2) toast.error(e1?.message ?? e2?.message ?? 'Error al cargar el detalle.')
      setDetalle({ venta: v, items: items ?? [], cliente: cliente ?? ({} as Cliente) })
    } finally {
      setLoadingDetalle(false)
    }
  }

  const imprimir = () => {
    if (!detalle) return
    try {
      generarRemitoPDF(detalle.venta, detalle.items, detalle.cliente)
    } catch {
      toast.error('No se pudo generar el PDF.')
    }
  }

  const detalleOpen = detalle !== null || loadingDetalle

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Remitos</h1>
          <p className="mt-1 text-sm text-gray-600">Historial de ventas</p>
        </div>
        <Link href="/ventas/nueva" className="btn-primary w-full justify-center sm:w-auto">
          <FilePlus2 className="h-4 w-4" />
          Nuevo remito
        </Link>
      </div>

      <div className="mb-5">
        <label htmlFor="buscar-ventas" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Buscar
        </label>
        <input
          id="buscar-ventas"
          type="text"
          placeholder="Cliente o número de remito…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="input-base max-w-md"
        />
      </div>

      <div className="table-wrap">
        <table className="table-data">
          <thead>
            <tr>
              <th>N° remito</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th className="text-right">Total</th>
              <th className="text-right w-28">Acciones</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : filtradas.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={5} className="py-14 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {filtradas.map(v => (
                <tr key={v.id}>
                  <td className="font-mono text-xs font-semibold text-gray-700">
                    #{String(v.control).padStart(6, '0')}
                  </td>
                  <td className="text-gray-600">
                    {new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                  </td>
                  <td className="font-medium text-gray-900">{(v as any).clientes?.nombre ?? '—'}</td>
                  <td className="text-right font-semibold tabular-nums text-brand-700">
                    ${Number(v.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => verDetalle(v)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      <Modal
        open={detalleOpen}
        onClose={() => setDetalle(null)}
        title={detalle ? `Remito #${String(detalle.venta.control).padStart(6, '0')}` : 'Detalle'}
        subtitle={
          detalle
            ? `${detalle.cliente.nombre ?? 'Cliente'} — ${new Date(detalle.venta.fecha + 'T00:00:00').toLocaleDateString('es-AR')}`
            : undefined
        }
        size="lg"
        className="max-h-[min(90vh,880px)]"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            {detalle && (
              <button type="button" className="btn-primary" onClick={imprimir}>
                <Printer className="h-4 w-4" />
                Imprimir PDF
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={() => setDetalle(null)}>
              Cerrar
            </button>
          </div>
        }
      >
        {loadingDetalle ? (
          <div className="flex justify-center py-12">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          </div>
        ) : detalle ? (
          <>
            <div className="table-wrap border-0 shadow-none">
              <table className="table-data min-w-0">
                <thead>
                  <tr>
                    <th>Artículo</th>
                    <th className="text-center">Cant.</th>
                    <th className="text-right">Precio</th>
                    <th className="text-center">Dto.</th>
                    <th className="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map(item => (
                    <tr key={item.id}>
                      <td className="text-gray-900">
                        {(item as any).articulos?.nombre ?? item.articulo_codigo}
                      </td>
                      <td className="text-center text-gray-600">{item.cantidad}</td>
                      <td className="text-right tabular-nums text-gray-600">
                        ${Number(item.precio).toFixed(2)}
                      </td>
                      <td className="text-center text-xs text-gray-500">
                        {item.descuento > 0 ? `${item.descuento}%` : '—'}
                      </td>
                      <td className="text-right font-semibold tabular-nums text-gray-900">
                        ${Number(item.importe).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
              <span className="text-sm text-gray-500 mr-3">Total</span>
              <span className="text-xl font-bold tabular-nums text-brand-700">
                ${Number(detalle.venta.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  )
}
