'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import TableSkeleton from '@/components/ui/TableSkeleton'
import { createClient, Cliente } from '@/lib/supabase'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Cliente | null>(null)
  const [form, setForm] = useState<Partial<Cliente>>({})
  const [guardando, setGuardando] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  const filtrados = clientes.filter(
    c =>
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (c.cuit ?? '').includes(busqueda)
  )

  const abrirNuevo = () => {
    setFieldErrors({})
    setForm({ condicion_pago: 'CONTADO', condicion_iva: 1, saldo: 0, descuento: 0 })
    setModal({} as Cliente)
  }

  const abrirEditar = (c: Cliente) => {
    setFieldErrors({})
    setForm(c)
    setModal(c)
  }

  const guardar = async () => {
    const nombreOk = !!(form.nombre ?? '').trim()
    setFieldErrors({ nombre: !nombreOk })
    if (!nombreOk) {
      toast.error('El nombre es obligatorio.')
      return
    }

    setGuardando(true)
    try {
      if (modal?.id) {
        const { error } = await supabase.from('clientes').update(form).eq('id', modal.id)
        if (error) throw error
        toast.success('Cliente actualizado.')
      } else {
        const maxCod = clientes.reduce((m, c) => Math.max(m, c.codigo), 0)
        const { error } = await supabase.from('clientes').insert({ ...form, codigo: maxCod + 1 })
        if (error) throw error
        toast.success('Cliente creado.')
      }
      setModal(null)
      cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const f =
    (k: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setFieldErrors(prev => ({ ...prev, [k]: false }))
      setForm(prev => ({ ...prev, [k]: e.target.value }))
    }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-gray-600">{clientes.length} clientes registrados</p>
        </div>
        <button type="button" onClick={abrirNuevo} className="btn-primary w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      <div className="mb-5">
        <label htmlFor="buscar-clientes" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Buscar
        </label>
        <input
          id="buscar-clientes"
          type="text"
          placeholder="Nombre o CUIT..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="input-base max-w-md"
        />
      </div>

      <div className="table-wrap">
        <table className="table-data">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>CUIT</th>
              <th>Condición</th>
              <th className="text-right">Saldo</th>
              <th className="text-right w-32">Acciones</th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={7} cols={5} />
          ) : filtrados.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={5} className="py-14 text-center text-gray-500">
                  Sin resultados
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id}>
                  <td className="font-medium">{c.nombre}</td>
                  <td className="font-mono text-xs text-gray-600">{c.cuit?.trim() || '—'}</td>
                  <td className="text-gray-600">{c.condicion_pago ?? '—'}</td>
                  <td
                    className={`text-right font-semibold tabular-nums ${
                      (c.saldo ?? 0) > 0 ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    ${Number(c.saldo ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/clientes/${c.id}/cuenta`}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                      >
                        Cuenta
                      </Link>
                      <button
                        type="button"
                        onClick={() => abrirEditar(c)}
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
        title={modal?.id ? 'Editar cliente' : 'Nuevo cliente'}
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
            { label: 'Nombre', key: 'nombre' as const, col: 2, required: true },
            { label: 'Dirección', key: 'direccion' as const, col: 2 },
            { label: 'Localidad', key: 'localidad' as const, col: 1 },
            { label: 'CUIT', key: 'cuit' as const, col: 1 },
            { label: 'Condición de pago', key: 'condicion_pago' as const, col: 1 },
            { label: 'Descuento %', key: 'descuento' as const, col: 1 },
          ].map(({ label, key, col, required }) => (
            <div key={key} className={col === 2 ? 'col-span-2' : ''}>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</label>
              <input
                type="text"
                value={(form as any)[key] ?? ''}
                onChange={f(key)}
                className={`input-base ${fieldErrors[key] ? 'input-error' : ''}`}
                aria-invalid={fieldErrors[key]}
              />
              {required && fieldErrors[key] && (
                <p className="mt-1 text-xs text-red-600">Requerido</p>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
