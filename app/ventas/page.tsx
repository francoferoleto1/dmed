'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient, Venta, VentaItem, Cliente } from '@/lib/supabase'
import { generarRemitoPDF } from '@/lib/pdf'

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [detalle, setDetalle] = useState<{ venta: Venta; items: VentaItem[]; cliente: Cliente } | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('ventas')
        .select('*, clientes(nombre)')
        .order('fecha', { ascending: false })
        .limit(200)
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
    const [{ data: items }, { data: cliente }] = await Promise.all([
      supabase.from('ventas_items').select('*, articulos(nombre, presentacion)').eq('venta_control', v.control),
      supabase.from('clientes').select('*').eq('id', v.cliente_id).single(),
    ])
    setDetalle({ venta: v, items: items ?? [], cliente: cliente ?? {} as Cliente })
    setLoadingDetalle(false)
  }

  const imprimir = () => {
    if (!detalle) return
    generarRemitoPDF(detalle.venta, detalle.items, detalle.cliente)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Remitos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historial de ventas</p>
        </div>
        <a href="/ventas/nueva"
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          + Nuevo remito
        </a>
      </div>

      <div className="mb-5">
        <input type="text" placeholder="Buscar por cliente o número..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Remito</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Cargando...</td></tr>
            ) : filtradas.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Sin resultados</td></tr>
            ) : filtradas.map(v => (
              <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                  #{String(v.control).padStart(6, '0')}
                </td>
                <td className="px-5 py-3.5 text-gray-600">
                  {new Date(v.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                </td>
                <td className="px-5 py-3.5 font-medium text-gray-800">
                  {(v as any).clientes?.nombre ?? '—'}
                </td>
                <td className="px-5 py-3.5 text-right font-semibold text-brand-700">
                  ${Number(v.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => verDetalle(v)}
                    className="text-brand-600 hover:text-brand-800 font-medium text-xs">
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal detalle */}
      {(detalle || loadingDetalle) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">
                  Remito #{detalle ? String(detalle.venta.control).padStart(6, '0') : '...'}
                </h2>
                {detalle && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {detalle.cliente.nombre} — {new Date(detalle.venta.fecha + 'T00:00:00').toLocaleDateString('es-AR')}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                {detalle && (
                  <button onClick={imprimir}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                    🖨 Imprimir PDF
                  </button>
                )}
                <button onClick={() => setDetalle(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  Cerrar
                </button>
              </div>
            </div>

            <div className="overflow-auto flex-1 p-6">
              {loadingDetalle ? (
                <p className="text-center text-gray-400 py-8">Cargando...</p>
              ) : detalle && (
                <>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-xs font-semibold text-gray-500">Artículo</th>
                        <th className="text-center py-2 text-xs font-semibold text-gray-500">Cant.</th>
                        <th className="text-right py-2 text-xs font-semibold text-gray-500">Precio</th>
                        <th className="text-right py-2 text-xs font-semibold text-gray-500">Dto.</th>
                        <th className="text-right py-2 text-xs font-semibold text-gray-500">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {detalle.items.map(item => (
                        <tr key={item.id}>
                          <td className="py-2.5 text-gray-800">{(item as any).articulos?.nombre ?? item.articulo_codigo}</td>
                          <td className="py-2.5 text-center text-gray-600">{item.cantidad}</td>
                          <td className="py-2.5 text-right text-gray-600">${Number(item.precio).toFixed(2)}</td>
                          <td className="py-2.5 text-center text-gray-500 text-xs">{item.descuento > 0 ? `${item.descuento}%` : '—'}</td>
                          <td className="py-2.5 text-right font-semibold text-gray-800">${Number(item.importe).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                    <div className="text-right">
                      <span className="text-sm text-gray-500 mr-4">Total</span>
                      <span className="text-xl font-bold text-brand-700">
                        ${Number(detalle.venta.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
