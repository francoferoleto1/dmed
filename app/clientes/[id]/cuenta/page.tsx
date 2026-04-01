'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase'
import type { Cliente, MovimientoCuenta } from '@/lib/supabase'

const PAGE_SIZE = 25

function badgeTipo(tipo: string) {
  const t = tipo.toLowerCase()
  if (t === 'cargo') {
    return 'bg-red-50 text-red-700 border-red-100'
  }
  if (t === 'pago') {
    return 'bg-emerald-50 text-emerald-800 border-emerald-100'
  }
  if (t === 'ajuste') {
    return 'bg-amber-50 text-amber-900 border-amber-100'
  }
  return 'bg-gray-50 text-gray-700 border-gray-100'
}

export default function ClienteCuentaPage() {
  const params = useParams()
  const id = Number(params.id)
  const supabase = useMemo(() => createClient(), [])

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [movs, setMovs] = useState<MovimientoCuenta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const [modalPago, setModalPago] = useState(false)
  const [montoPago, setMontoPago] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [detallePago, setDetallePago] = useState('')
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [errorPago, setErrorPago] = useState('')
  const [errorCarga, setErrorCarga] = useState('')

  const cargarCliente = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return
    const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single()
    if (error) setErrorCarga(error.message)
    setCliente(data ?? null)
  }, [supabase, id])

  const cargarMovs = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return
    setLoading(true)
    setErrorCarga('')

    let countQ = supabase
      .from('movimientos_cuenta')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', id)

    let dataQ = supabase
      .from('movimientos_cuenta')
      .select('*')
      .eq('cliente_id', id)
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
    const { data, error } = await dataQ.range(from, to)
    if (error) setErrorCarga(error.message)
    setMovs((data ?? []) as MovimientoCuenta[])
    setLoading(false)
  }, [supabase, id, tipoFiltro, desde, hasta, page])

  useEffect(() => {
    cargarCliente()
  }, [cargarCliente])

  useEffect(() => {
    setPage(0)
  }, [tipoFiltro, desde, hasta])

  useEffect(() => {
    cargarMovs()
  }, [cargarMovs])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const saldoActual = Number(cliente?.saldo ?? 0)
  const saldoDeudor = saldoActual > 0

  const registrarPago = async () => {
    if (!cliente) return
    const monto = parseFloat(montoPago.replace(',', '.'))
    if (!Number.isFinite(monto) || monto <= 0) {
      setErrorPago('Ingresá un monto válido mayor a 0.')
      return
    }

    setGuardandoPago(true)
    setErrorPago('')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const usuarioId = user?.id ?? null

      const { data: pagoRow, error: errPago } = await supabase
        .from('pagos')
        .insert({
          cliente_id: id,
          monto,
          metodo_pago: metodoPago,
          detalle: detallePago.trim() || null,
          usuario_id: usuarioId,
        })
        .select('id')
        .single()

      if (errPago || !pagoRow) {
        throw new Error(errPago?.message ?? 'No se pudo registrar el pago.')
      }

      const saldoAnt = Number(cliente.saldo ?? 0)
      const saldoNuevo = saldoAnt - monto

      const { error: errUp } = await supabase.from('clientes').update({ saldo: saldoNuevo }).eq('id', id)

      if (errUp) {
        await supabase.from('pagos').delete().eq('id', pagoRow.id)
        throw new Error(errUp.message ?? 'No se pudo actualizar el saldo.')
      }

      const { error: errMov } = await supabase.from('movimientos_cuenta').insert({
        cliente_id: id,
        tipo: 'pago',
        monto,
        saldo_anterior: saldoAnt,
        saldo_nuevo: saldoNuevo,
        referencia_tipo: 'pago',
        referencia_id: pagoRow.id,
        detalle: detallePago.trim() || `Pago ${metodoPago}`,
        usuario_id: usuarioId,
      })

      if (errMov) {
        await supabase.from('clientes').update({ saldo: saldoAnt }).eq('id', id)
        await supabase.from('pagos').delete().eq('id', pagoRow.id)
        throw new Error(errMov.message ?? 'No se pudo registrar el movimiento en cuenta.')
      }

      setModalPago(false)
      setMontoPago('')
      setDetallePago('')
      setMetodoPago('efectivo')
      toast.success('Pago registrado.')
      await cargarCliente()
      await cargarMovs()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al registrar el pago.'
      setErrorPago(msg)
      toast.error(msg)
    } finally {
      setGuardandoPago(false)
    }
  }

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div>
        <p className="text-red-600">Cliente inválido.</p>
        <Link href="/clientes" className="text-brand-600 text-sm">Volver</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/clientes" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          ← Clientes
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cuenta corriente</h1>
            {cliente ? (
              <p className="text-sm font-medium text-gray-800 mt-1">{cliente.nombre}</p>
            ) : (
              <p className="text-sm text-gray-400 mt-1">Cargando…</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo actual</p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                saldoDeudor ? 'text-red-600' : 'text-gray-800'
              }`}
            >
              ${saldoActual.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </p>
            {saldoDeudor && (
              <p className="text-xs text-red-500 mt-1">Saldo deudor</p>
            )}
          </div>
        </div>
      </div>

      {errorCarga && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {errorCarga}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5">
        <button
          type="button"
          onClick={() => {
            setModalPago(true)
            setErrorPago('')
          }}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
        >
          Registrar pago
        </button>
        <select
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          aria-label="Filtrar por tipo"
        >
          <option value="">Todos los tipos</option>
          <option value="cargo">Cargo</option>
          <option value="pago">Pago</option>
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
          <table className="table-data min-w-[800px]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th className="text-right">Monto</th>
                <th>Saldo</th>
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
                    <td className="text-right font-semibold tabular-nums text-gray-900">
                      ${Number(m.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="tabular-nums text-gray-700">
                      {Number(m.saldo_anterior).toLocaleString('es-AR', { minimumFractionDigits: 2 })} →{' '}
                      {Number(m.saldo_nuevo).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="max-w-[240px] truncate text-gray-600" title={m.detalle ?? ''}>
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
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <button
              type="button"
              disabled={page <= 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
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
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      <Modal
        open={modalPago}
        onClose={() => {
          setModalPago(false)
          setErrorPago('')
        }}
        title="Registrar pago"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setModalPago(false)
                setErrorPago('')
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={registrarPago} disabled={guardandoPago}>
              {guardandoPago ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        {errorPago && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorPago}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Monto</label>
            <input
              type="text"
              inputMode="decimal"
              value={montoPago}
              onChange={e => {
                setErrorPago('')
                setMontoPago(e.target.value)
              }}
              placeholder="0.00"
              className={`input-base ${errorPago ? 'input-error' : ''}`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Método de pago</label>
            <select
              value={metodoPago}
              onChange={e => setMetodoPago(e.target.value)}
              className="input-base bg-white"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Detalle (opcional)</label>
            <input
              type="text"
              value={detallePago}
              onChange={e => setDetallePago(e.target.value)}
              className="input-base"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
