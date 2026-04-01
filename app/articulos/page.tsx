'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, XCircle, Ban, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import ImportExcel from '@/components/ImportExcel'
import Modal from '@/components/ui/Modal'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { createClient, Articulo } from '@/lib/supabase'
import { stockPillClass, STOCK_LOW_THRESHOLD } from '@/lib/stock'

/* ────────────────────────────────────────────── */
/*  Batched Supabase helper                       */
/* ────────────────────────────────────────────── */
const BATCH = 80

async function batchUpdate(
  supabase: ReturnType<typeof createClient>,
  ids: number[],
  payload: Partial<Articulo>
) {
  let ok = 0
  let errMsg = ''
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH)
    const { error } = await supabase
      .from('articulos')
      .update(payload)
      .in('id', slice)
    if (error) {
      errMsg = error.message
    } else {
      ok += slice.length
    }
  }
  return { ok, errMsg }
}

async function batchDelete(
  supabase: ReturnType<typeof createClient>,
  ids: number[]
) {
  let ok = 0
  let errMsg = ''
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH)
    const { error } = await supabase
      .from('articulos')
      .delete()
      .in('id', slice)
    if (error) {
      errMsg = error.message
    } else {
      ok += slice.length
    }
  }
  return { ok, errMsg }
}

/* ────────────────────────────────────────────── */
/*  Main component                                */
/* ────────────────────────────────────────────── */

function ArticulosPageContent() {
  const searchParams = useSearchParams()
  const filtroStockBajo = searchParams.get('stockBajo') === '1'

  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [laboratorioFiltro, setLaboratorioFiltro] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Articulo | null>(null)
  const [form, setForm] = useState<Partial<Articulo>>({})
  const [guardando, setGuardando] = useState(false)
  const [soloActivos, setSoloActivos] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})

  // ── Selección múltiple ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const supabase = createClient()

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('articulos').select('*').order('nombre')
    setArticulos(data ?? [])
    setSelectedIds(new Set())
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (filtroStockBajo) setSoloActivos(true)
  }, [filtroStockBajo])

  /* ── Laboratorios únicos ── */
  const laboratoriosUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const a of articulos) {
      const l = (a.laboratorio ?? '').trim()
      if (l) set.add(l)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [articulos])

  /* ── Filtros combinados ── */
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return articulos.filter(a => {
      if (filtroStockBajo) {
        if (a.descontinuado) return false
        if (Number(a.stock) >= STOCK_LOW_THRESHOLD) return false
      }
      if (laboratorioFiltro) {
        if ((a.laboratorio ?? '').trim() !== laboratorioFiltro) return false
      }
      if (soloActivos && a.descontinuado) return false
      if (!q) return true
      const codigoNorm = String(a.codigo ?? '').trim().toLowerCase()
      const nombreNorm = (a.nombre ?? '').toLowerCase()
      const labNorm = (a.laboratorio ?? '').toLowerCase()
      return nombreNorm.includes(q) || codigoNorm.includes(q) || labNorm.includes(q)
    })
  }, [articulos, busqueda, soloActivos, laboratorioFiltro, filtroStockBajo])

  /* ── IDs visibles (para "seleccionar todos") ── */
  const filtradoIds = useMemo(() => new Set(filtrados.map(a => a.id)), [filtrados])

  /* ── Selección helpers ── */
  const selectedCount = selectedIds.size
  const allVisibleSelected =
    filtrados.length > 0 && filtrados.every(a => selectedIds.has(a.id))

  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allVisibleSelected) {
      // Deseleccionar los visibles
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const a of filtrados) next.delete(a.id)
        return next
      })
    } else {
      // Seleccionar todos los visibles
      setSelectedIds(prev => {
        const next = new Set(prev)
        for (const a of filtrados) next.add(a.id)
        return next
      })
    }
  }

  const clearSelection = () => setSelectedIds(new Set())

  /* ── Acciones masivas ── */
  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds])

  const bulkDescontinuar = async () => {
    if (!selectedArray.length) return
    setBulkProcessing(true)
    try {
      const { ok, errMsg } = await batchUpdate(supabase, selectedArray, { descontinuado: true })
      if (errMsg) {
        toast.error(`Algunos artículos no se pudieron descontinuar: ${errMsg}`)
      } else {
        toast.success(`${ok} artículo${ok !== 1 ? 's' : ''} descontinuado${ok !== 1 ? 's' : ''}.`)
      }
      clearSelection()
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al descontinuar.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const bulkReactivar = async () => {
    if (!selectedArray.length) return
    setBulkProcessing(true)
    try {
      const { ok, errMsg } = await batchUpdate(supabase, selectedArray, { descontinuado: false })
      if (errMsg) {
        toast.error(`Algunos artículos no se pudieron reactivar: ${errMsg}`)
      } else {
        toast.success(`${ok} artículo${ok !== 1 ? 's' : ''} reactivado${ok !== 1 ? 's' : ''}.`)
      }
      clearSelection()
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al reactivar.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const bulkEliminar = async () => {
    if (!selectedArray.length) return
    setBulkProcessing(true)
    try {
      const { ok, errMsg } = await batchDelete(supabase, selectedArray)
      if (errMsg) {
        toast.error(
          `No se pudieron eliminar algunos artículos. Pueden estar asociados a remitos. Intentá descontinuarlos. (${errMsg})`
        )
      }
      if (ok > 0) {
        toast.success(`${ok} artículo${ok !== 1 ? 's' : ''} eliminado${ok !== 1 ? 's' : ''}.`)
      }
      setConfirmDeleteOpen(false)
      clearSelection()
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar.')
    } finally {
      setBulkProcessing(false)
    }
  }

  /* ── Modal alta/edición ── */
  const abrirNuevo = () => {
    setFieldErrors({})
    setForm({ precio: 0, precio_publico: 0, stock: 0, descontinuado: false })
    setModal({} as Articulo)
  }

  const abrirEditar = (a: Articulo) => {
    setFieldErrors({})
    setForm(a)
    setModal(a)
  }

  const guardar = async () => {
    const nombreOk = !!(form.nombre ?? '').toString().trim()
    const codigoOk = !!(form.codigo ?? '').toString().trim()
    setFieldErrors({ nombre: !nombreOk, codigo: !codigoOk })
    if (!nombreOk || !codigoOk) {
      toast.error('Completá código y nombre.')
      return
    }

    setGuardando(true)
    try {
      const dataToSave = {
        ...form,
        precio: parseFloat(String(form.precio ?? 0)) || 0,
        precio_publico: parseFloat(String(form.precio_publico ?? 0)) || 0,
        stock: parseFloat(String(form.stock ?? 0)) || 0,
      }

      if (modal?.id) {
        const { error } = await supabase.from('articulos').update(dataToSave).eq('id', modal.id)
        if (error) throw error
        toast.success('Artículo actualizado.')
      } else {
        const { error } = await supabase.from('articulos').insert(dataToSave)
        if (error) throw error
        toast.success('Artículo creado.')
      }
      setModal(null)
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const f = (k: keyof Articulo) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFieldErrors(prev => ({ ...prev, [k]: false }))
    setForm(prev => ({
      ...prev,
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))
  }

  /* ────────────────────────────────────────────── */
  /*  RENDER                                        */
  /* ────────────────────────────────────────────── */

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Artículos</h1>
          <p className="mt-1 text-sm text-gray-600">
            Mostrando{' '}
            <span className="font-semibold text-gray-900">{filtrados.length}</span> de{' '}
            <span className="font-semibold text-gray-900">{articulos.length}</span> artículos
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <ImportExcel onImported={cargar} />
          <button type="button" onClick={abrirNuevo} className="btn-primary w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Nuevo artículo
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-card md:flex-row md:items-end md:gap-4">
        <div className="min-w-0 w-full flex-[2]">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Buscar
          </label>
          <input
            type="text"
            placeholder="Buscar por nombre, código o laboratorio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="input-base w-full"
          />
        </div>
        <div className="w-full min-w-[13rem] md:w-56 md:flex-shrink-0">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Laboratorio
          </label>
          <select
            value={laboratorioFiltro}
            onChange={e => setLaboratorioFiltro(e.target.value)}
            className="input-base w-full bg-white"
            aria-label="Filtrar por laboratorio"
          >
            <option value="">Todos los laboratorios</option>
            {laboratoriosUnicos.map(lab => (
              <option key={lab} value={lab}>
                {lab}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-0.5 text-sm text-gray-700 select-none md:flex-shrink-0 md:pb-2">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={e => setSoloActivos(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          Solo activos
        </label>
      </div>

      {filtroStockBajo && (
        <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Mostrando artículos activos con stock menor a {STOCK_LOW_THRESHOLD} unidades.{' '}
          <Link href="/articulos" className="font-semibold text-brand-700 underline underline-offset-2">
            Quitar filtro
          </Link>
        </div>
      )}

      {/* ── Barra de acciones masivas ── */}
      {selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50/80 px-4 py-3 shadow-sm">
          <span className="text-sm font-semibold text-brand-900">
            {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={bulkDescontinuar}
              disabled={bulkProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              <Ban className="h-3.5 w-3.5" />
              Descontinuar
            </button>

            <button
              type="button"
              onClick={bulkReactivar}
              disabled={bulkProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reactivar
            </button>

            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={bulkProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>

            <button
              type="button"
              onClick={clearSelection}
              disabled={bulkProcessing}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-white/80 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Tabla ── */}
      <div className="table-wrap">
        <table className="table-data min-w-[960px]">
          <thead>
            <tr>
              <th className="w-10 text-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected && filtrados.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  aria-label="Seleccionar todos"
                />
              </th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Present.</th>
              <th>Lab.</th>
              <th className="text-right">Precio</th>
              <th className="text-right">Stock</th>
              <th className="text-right w-40">Acciones</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={8} cols={8} />
          ) : filtrados.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={8} className="py-14 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {filtrados.map(a => {
                const checked = selectedIds.has(a.id)
                return (
                  <tr
                    key={a.id}
                    className={`${a.descontinuado ? 'bg-gray-50/80 opacity-[0.65]' : ''} ${
                      checked ? 'bg-brand-50/60' : ''
                    }`}
                  >
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(a.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Seleccionar ${a.nombre}`}
                      />
                    </td>
                    <td className="font-mono text-xs text-gray-600">{a.codigo}</td>
                    <td className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{a.nombre}</span>
                        {a.descontinuado && (
                          <span className="inline-flex items-center rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                            Descontinuado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-xs text-gray-600">{a.presentacion ?? '—'}</td>
                    <td className="text-xs text-gray-600">{a.laboratorio ?? '—'}</td>
                    <td className="text-right font-semibold tabular-nums">
                      ${Number(a.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-right">
                      <span className={stockPillClass(Number(a.stock))}>
                        {Number(a.stock).toLocaleString('es-AR', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/articulos/${a.id}/movimientos`}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        >
                          📋 Movimientos
                        </Link>
                        <button
                          type="button"
                          onClick={() => abrirEditar(a)}
                          className="rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          )}
        </table>
      </div>

      {/* ── Modal alta/edición ── */}
      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Editar artículo' : 'Nuevo artículo'}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Código', key: 'codigo' as const, col: 1, required: true },
            { label: 'Laboratorio', key: 'laboratorio' as const, col: 1 },
            { label: 'Nombre', key: 'nombre' as const, col: 2, required: true },
            { label: 'Presentación', key: 'presentacion' as const, col: 1 },
            { label: 'Registro', key: 'registro' as const, col: 1 },
            { label: 'Precio', key: 'precio' as const, col: 1 },
            { label: 'Precio público', key: 'precio_publico' as const, col: 1 },
            { label: 'Stock', key: 'stock' as const, col: 1 },
          ].map(({ label, key, col, required }) => (
            <div key={key} className={col === 2 ? 'col-span-2' : ''}>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</label>
              <input
                type="text"
                value={(form as any)[key] ?? ''}
                onChange={f(key)}
                className={`input-base ${fieldErrors[key] ? 'input-error' : ''}`}
              />
              {required && fieldErrors[key] && (
                <p className="mt-1 text-xs text-red-600">Requerido</p>
              )}
            </div>
          ))}
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="desc"
              checked={!!form.descontinuado}
              onChange={e => setForm(prev => ({ ...prev, descontinuado: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="desc" className="text-sm text-gray-700">
              Descontinuado
            </label>
          </div>
        </div>
      </Modal>

      {/* ── Modal confirmación eliminar ── */}
      <Modal
        open={confirmDeleteOpen}
        onClose={() => !bulkProcessing && setConfirmDeleteOpen(false)}
        title="Eliminar artículos"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setConfirmDeleteOpen(false)}
              disabled={bulkProcessing}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={bulkEliminar}
              disabled={bulkProcessing}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {bulkProcessing ? 'Eliminando…' : 'Confirmar eliminación'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Vas a eliminar{' '}
            <span className="font-bold text-red-700">{selectedCount} artículo{selectedCount !== 1 ? 's' : ''}</span>.
            Esta acción <strong>no se puede deshacer</strong>.
          </p>
          <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
            <strong>Nota:</strong> Los artículos que estén asociados a remitos no se podrán eliminar.
            En ese caso, te recomendamos <strong>descontinuarlos</strong> en su lugar.
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function ArticulosPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-gray-500 text-sm">Cargando artículos…</div>
      }
    >
      <ArticulosPageContent />
    </Suspense>
  )
}