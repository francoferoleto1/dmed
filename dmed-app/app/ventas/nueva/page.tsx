'use client'
import { useEffect, useState } from 'react'
import { createClient, Cliente, Articulo } from '@/lib/supabase'
import { generarRemitoPDF } from '@/lib/pdf'
import { useRouter } from 'next/navigation'

type Item = { articulo: Articulo; cantidad: number; precio: number; descuento: number; importe: number }

export default function NuevoRemitoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [busArt, setBusArt] = useState('')
  const [artSugs, setArtSugs] = useState<Articulo[]>([])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [detalle, setDetalle] = useState('')
  const [guardando, setGuardando] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const cargar = async () => {
      const [{ data: cls }, { data: arts }] = await Promise.all([
        supabase.from('clientes').select('*').order('nombre'),
        supabase.from('articulos').select('*').eq('descontinuado', false).order('nombre'),
      ])
      setClientes(cls ?? [])
      setArticulos(arts ?? [])
    }
    cargar()
  }, [])

  useEffect(() => {
    if (busArt.length < 2) { setArtSugs([]); return }
    const q = busArt.toLowerCase()
    setArtSugs(articulos.filter(a =>
      a.nombre.toLowerCase().includes(q) || a.codigo.toLowerCase().includes(q)
    ).slice(0, 8))
  }, [busArt, articulos])

  const agregarArticulo = (a: Articulo) => {
    setBusArt('')
    setArtSugs([])
    setItems(prev => {
      const existe = prev.findIndex(i => i.articulo.codigo === a.codigo)
      if (existe >= 0) {
        const next = [...prev]
        next[existe].cantidad++
        next[existe].importe = +(next[existe].cantidad * next[existe].precio * (1 - next[existe].descuento / 100)).toFixed(2)
        return next
      }
      return [...prev, { articulo: a, cantidad: 1, precio: a.precio, descuento: 0, importe: a.precio }]
    })
  }

  const actualizarItem = (idx: number, campo: 'cantidad' | 'precio' | 'descuento', val: string) => {
    setItems(prev => {
      const next = [...prev]
      const n = parseFloat(val) || 0
      next[idx] = { ...next[idx], [campo]: n }
      next[idx].importe = +(next[idx].cantidad * next[idx].precio * (1 - next[idx].descuento / 100)).toFixed(2)
      return next
    })
  }

  const eliminarItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const total = items.reduce((s, i) => s + i.importe, 0)

  const guardar = async () => {
    if (!clienteId || items.length === 0) return
    setGuardando(true)

    // Obtener próximo número de control
    const { data: maxData } = await supabase.from('ventas').select('control').order('control', { ascending: false }).limit(1)
    const control = ((maxData?.[0]?.control) ?? 0) + 1

    await supabase.from('ventas').insert({
      control, fecha, cliente_id: clienteId, total, tipo: 1, detalle, es_historico: false
    })

    await supabase.from('ventas_items').insert(items.map(i => ({
      venta_control: control,
      articulo_codigo: i.articulo.codigo,
      cantidad: i.cantidad,
      precio: i.precio,
      descuento: i.descuento,
      importe: i.importe,
    })))

    // Generar PDF automáticamente
    const cliente = clientes.find(c => c.id === clienteId)!
    const venta = { id: 0, control, fecha, cliente_id: clienteId, total, tipo: 1, detalle }
    const ventaItems = items.map(i => ({
      id: 0, venta_control: control, articulo_codigo: i.articulo.codigo,
      cantidad: i.cantidad, precio: i.precio, descuento: i.descuento, importe: i.importe,
      articulos: { nombre: i.articulo.nombre, presentacion: i.articulo.presentacion ?? '' }
    }))
    generarRemitoPDF(venta, ventaItems, cliente)

    setGuardando(false)
    router.push('/ventas')
  }

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo remito</h1>
        <p className="text-sm text-gray-500 mt-0.5">El PDF se generará automáticamente al guardar</p>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        {/* Cliente */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cliente</label>
          <select value={clienteId ?? ''} onChange={e => setClienteId(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
            <option value="">— Seleccionar cliente —</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {clienteSeleccionado && (
            <div className="mt-3 text-xs text-gray-500 space-y-0.5">
              {clienteSeleccionado.condicion_pago && <p>Condición: {clienteSeleccionado.condicion_pago}</p>}
              {clienteSeleccionado.cuit?.trim() && <p>CUIT: {clienteSeleccionado.cuit}</p>}
              {(clienteSeleccionado.descuento ?? 0) > 0 && <p>Descuento habitual: {clienteSeleccionado.descuento}%</p>}
            </div>
          )}
        </div>

        {/* Fecha y detalle */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalle</label>
            <input type="text" value={detalle} onChange={e => setDetalle(e.target.value)}
              placeholder="Opcional..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        </div>
      </div>

      {/* Buscador de artículos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Agregar artículo</label>
        <div className="relative">
          <input type="text" placeholder="Buscar por nombre o código..."
            value={busArt} onChange={e => setBusArt(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          {artSugs.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg z-10 overflow-hidden">
              {artSugs.map(a => (
                <button key={a.codigo} onClick={() => agregarArticulo(a)}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0">
                  <span className="font-medium text-sm text-gray-800">{a.nombre}</span>
                  <span className="text-xs text-gray-400 ml-2">{a.presentacion}</span>
                  <span className="float-right text-sm font-semibold text-brand-700">${Number(a.precio).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      {items.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Artículo</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Precio</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Dto. %</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Importe</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{item.articulo.nombre}</p>
                    <p className="text-xs text-gray-400">{item.articulo.presentacion}</p>
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min="1" value={item.cantidad}
                      onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                      className="w-16 text-center px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min="0" step="0.01" value={item.precio}
                      onChange={e => actualizarItem(idx, 'precio', e.target.value)}
                      className="w-24 text-right px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </td>
                  <td className="px-3 py-3">
                    <input type="number" min="0" max="100" value={item.descuento}
                      onChange={e => actualizarItem(idx, 'descuento', e.target.value)}
                      className="w-16 text-center px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-800">
                    ${item.importe.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => eliminarItem(idx)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="px-5 py-4 bg-brand-50 border-t border-brand-100 flex justify-end items-center gap-8">
            <span className="text-sm font-medium text-brand-700">Total del remito</span>
            <span className="text-2xl font-bold text-brand-800">
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-3">
        <a href="/ventas"
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          Cancelar
        </a>
        <button onClick={guardar}
          disabled={guardando || !clienteId || items.length === 0}
          className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {guardando ? 'Guardando...' : '💾 Guardar y generar PDF'}
        </button>
      </div>
    </div>
  )
}
