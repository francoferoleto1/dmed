'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import ImportExcel from '@/components/ImportExcel'
import Modal from '@/components/ui/Modal'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { createClient, Articulo } from '@/lib/supabase'
import { stockPillClass, STOCK_LOW_THRESHOLD } from '@/lib/stock'

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
  const supabase = createClient()

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('articulos').select('*').order('nombre')
    setArticulos(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  useEffect(() => {
    if (filtroStockBajo) setSoloActivos(true)
  }, [filtroStockBajo])

  const laboratoriosUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const a of articulos) {
      const l = (a.laboratorio ?? '').trim()
      if (l) set.add(l)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [articulos])

  // Filtros combinados: búsqueda (todos los campos) + laboratorio + solo activos.
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return articulos.filter(a => {
      if (filtroStockBajo) {
        if (a.descontinuado) return false
        if (Number(a.stock) >= STOCK_LOW_THRESHOLD) return false
      }
      if (laboratorioFiltro) {
        const lab = (a.laboratorio ?? '').trim()
        if (lab !== laboratorioFiltro) return false
      }
      if (soloActivos && a.descontinuado) return false
      if (!q) return true
      const codigoNorm = String(a.codigo ?? '').trim().toLowerCase()
      const nombreNorm = (a.nombre ?? '').toLowerCase()
      const labNorm = (a.laboratorio ?? '').toLowerCase()
      return (
        nombreNorm.includes(q) ||
        codigoNorm.includes(q) ||
        labNorm.includes(q)
      )
    })
  }, [articulos, busqueda, soloActivos, laboratorioFiltro, filtroStockBajo])

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
      if (modal?.id) {
        const { error } = await supabase.from('articulos').update(form).eq('id', modal.id)
        if (error) throw error
        toast.success('Artículo actualizado.')
      } else {
        const { error } = await supabase.from('articulos').insert(form)
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

  return (
    <div>
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

      <div className="table-wrap">
        <table className="table-data min-w-[900px]">
          <thead>
            <tr>
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
            <TableSkeleton rows={8} cols={7} />
          ) : filtrados.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={7} className="py-14 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {filtrados.map(a => (
                <tr
                  key={a.id}
                  className={a.descontinuado ? 'bg-gray-50/80 opacity-[0.65]' : ''}
                >
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
              ))}
            </tbody>
          )}
        </table>
      </div>

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
              onChange={e =>
                setForm(prev => ({ ...prev, descontinuado: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <label htmlFor="desc" className="text-sm text-gray-700">
              Descontinuado
            </label>
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
