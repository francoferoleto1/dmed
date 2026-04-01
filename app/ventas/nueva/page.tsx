'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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
  const [errorMsg, setErrorMsg] = useState('')
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
    setErrorMsg('')

    const cliente = clientes.find(c => c.id === clienteId)
    if (!cliente) {
      const m = 'Cliente no encontrado.'
      setErrorMsg(m)
      toast.error(m)
      setGuardando(false)
      return
    }

    const { data: maxData } = await supabase.from('ventas').select('control').order('control', { ascending: false }).limit(1)
    const control = ((maxData?.[0]?.control) ?? 0) + 1

    let ventaId: number | null = null

    try {
      const { data: ventaRow, error: errVenta } = await supabase
        .from('ventas')
        .insert({
          control,
          fecha,
          cliente_id: clienteId,
          total,
          tipo: 1,
          detalle,
          es_historico: false,
        })
        .select('id')
        .single()

      if (errVenta || !ventaRow) {
        throw new Error(errVenta?.message ?? 'No se pudo crear el remito.')
      }

      ventaId = ventaRow.id

      const { error: errItems } = await supabase.from('ventas_items').insert(
        items.map(i => ({
          venta_control: control,
          articulo_codigo: i.articulo.codigo,
          cantidad: i.cantidad,
          precio: i.precio,
          descuento: i.descuento,
          importe: i.importe,
        }))
      )

      if (errItems) {
        await supabase.from('ventas').delete().eq('id', ventaId)
        throw new Error(errItems.message ?? 'No se pudieron guardar los ítems del remito.')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido al guardar el remito.'
      setErrorMsg(msg)
      toast.error(msg)
      setGuardando(false)
      return
    }

    const detalleMovStock = `Remito #${control} - ${cliente.nombre}`
    const detalleMovCuenta = `Remito #${control}`

    let stockPostError = false

    for (const i of items) {
      try {
        const { data: artRow, error: errArt } = await supabase
          .from('articulos')
          .select('id, stock')
          .eq('codigo', i.articulo.codigo)
          .single()

        if (errArt || !artRow) {
          console.error('Remito: no se pudo leer artículo por código', i.articulo.codigo, errArt)
          stockPostError = true
          continue
        }

        const stockAnterior = Number(artRow.stock ?? 0)
        const stockNuevo = stockAnterior - i.cantidad

        if (stockNuevo < 0) {
          toast.warning(`Stock negativo para ${i.articulo.nombre}`)
        }

        const { error: errUpStock } = await supabase
          .from('articulos')
          .update({ stock: stockNuevo })
          .eq('codigo', i.articulo.codigo)

        if (errUpStock) {
          console.error('Remito: error al actualizar stock', errUpStock)
          stockPostError = true
          continue
        }

        const { error: errMovStock } = await supabase.from('movimientos_stock').insert({
          articulo_id: artRow.id,
          articulo_codigo: i.articulo.codigo,
          tipo: 'salida',
          cantidad: i.cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          referencia_tipo: 'remito',
          referencia_id: control,
          detalle: detalleMovStock,
        })

        if (errMovStock) {
          console.error('Remito: error movimiento_stock', errMovStock)
          stockPostError = true
        }
      } catch (e) {
        console.error('Remito: error en post-proceso de stock', e)
        stockPostError = true
      }
    }

    let saldoPostError = false

    try {
      const { data: cliFresh, error: errCliRead } = await supabase
        .from('clientes')
        .select('id, saldo')
        .eq('id', clienteId)
        .single()

      if (errCliRead || !cliFresh) {
        throw new Error(errCliRead?.message ?? 'No se pudo leer el saldo del cliente.')
      }

      const saldoAnteriorCliente = Number(cliFresh.saldo ?? 0)
      const saldoNuevoCliente = saldoAnteriorCliente + total

      const { error: errCliUp } = await supabase
        .from('clientes')
        .update({ saldo: saldoNuevoCliente })
        .eq('id', clienteId)

      if (errCliUp) {
        throw new Error(errCliUp.message ?? 'No se pudo actualizar el saldo del cliente.')
      }

      const { error: errMovCuenta } = await supabase.from('movimientos_cuenta').insert({
        cliente_id: clienteId,
        tipo: 'cargo',
        monto: total,
        saldo_anterior: saldoAnteriorCliente,
        saldo_nuevo: saldoNuevoCliente,
        referencia_tipo: 'remito',
        referencia_id: control,
        detalle: detalleMovCuenta,
      })

      if (errMovCuenta) {
        await supabase.from('clientes').update({ saldo: saldoAnteriorCliente }).eq('id', clienteId)
        throw new Error(errMovCuenta.message ?? 'Error al registrar movimiento en cuenta corriente.')
      }
    } catch (e) {
      console.error('Remito: error en cargo de cuenta corriente', e)
      saldoPostError = true
    }

    const venta = { id: ventaId!, control, fecha, cliente_id: clienteId, total, tipo: 1, detalle }
    const ventaItems = items.map(i => ({
      id: 0,
      venta_control: control,
      articulo_codigo: i.articulo.codigo,
      cantidad: i.cantidad,
      precio: i.precio,
      descuento: i.descuento,
      importe: i.importe,
      articulos: { nombre: i.articulo.nombre, presentacion: i.articulo.presentacion ?? '' },
    }))
    try {
      generarRemitoPDF(venta, ventaItems, cliente)
    } catch {
      /* PDF no debe deshacer el remito ya persistido */
    }

    const partes: string[] = []
    if (stockPostError) partes.push('stock')
    if (saldoPostError) partes.push('saldo')
    if (partes.length > 0) {
      toast.error(
        `Remito guardado pero hubo un error actualizando ${partes.join(' y ')}. Contacte al administrador.`
      )
    } else {
      toast.success('Remito guardado correctamente.')
    }

    router.push('/ventas')
    setGuardando(false)
  }

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Nuevo remito</h1>
        <p className="mt-1 text-sm text-gray-600">El PDF se generará automáticamente al guardar</p>
        {errorMsg && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {errorMsg}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-card md:col-span-2">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</label>
          <select value={clienteId ?? ''} onChange={e => setClienteId(Number(e.target.value))}
            className="input-base bg-white">
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
        <div className="rounded-2xl border border-gray-200/80 bg-white space-y-4 p-5 shadow-card md:col-span-1">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="input-base" />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Detalle</label>
            <input type="text" value={detalle} onChange={e => setDetalle(e.target.value)}
              placeholder="Opcional..."
              className="input-base" />
          </div>
        </div>
      </div>

      {/* Buscador de artículos */}
      <div className="mb-5 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-card">
        <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-gray-500">Agregar artículo</label>
        <div className="relative">
          <input type="text" placeholder="Buscar por nombre o código..."
            value={busArt} onChange={e => setBusArt(e.target.value)}
            className="input-base" />
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
        <div className="table-wrap mb-5 overflow-hidden p-0">
          <table className="table-data min-w-[720px]">
            <thead>
              <tr>
                <th>Artículo</th>
                <th className="text-center">Cant.</th>
                <th className="text-right">Precio</th>
                <th className="text-center">Dto. %</th>
                <th className="text-right">Importe</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
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
                  <td className="text-center">
                    <button type="button" onClick={() => eliminarItem(idx)}
                      className="rounded-lg px-2 py-1 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                      aria-label="Quitar ítem"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="flex items-center justify-end gap-8 border-t border-brand-100 bg-brand-50/80 px-5 py-4">
            <span className="text-sm font-medium text-brand-800">Total del remito</span>
            <span className="text-2xl font-bold tabular-nums text-brand-900">
              ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <a href="/ventas" className="btn-secondary">
          Cancelar
        </a>
        <button
          type="button"
          onClick={guardar}
          disabled={guardando || !clienteId || items.length === 0}
          className="btn-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar y generar PDF'}
        </button>
      </div>
    </div>
  )
}
