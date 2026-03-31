'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient, Cliente } from '@/lib/supabase'

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Cliente | null>(null)
  const [form, setForm] = useState<Partial<Cliente>>({})
  const [guardando, setGuardando] = useState(false)
  const supabase = createClient()

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.cuit ?? '').includes(busqueda)
  )

  const abrirNuevo = () => {
    setForm({ condicion_pago: 'CONTADO', condicion_iva: 1, saldo: 0, descuento: 0 })
    setModal({} as Cliente)
  }

  const abrirEditar = (c: Cliente) => { setForm(c); setModal(c) }

  const guardar = async () => {
    setGuardando(true)
    if (modal?.id) {
      await supabase.from('clientes').update(form).eq('id', modal.id)
    } else {
      const maxCod = clientes.reduce((m, c) => Math.max(m, c.codigo), 0)
      await supabase.from('clientes').insert({ ...form, codigo: maxCod + 1 })
    }
    setGuardando(false)
    setModal(null)
    cargar()
  }

  const f = (k: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clientes.length} clientes registrados</p>
        </div>
        <button onClick={abrirNuevo}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          + Nuevo cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div className="mb-5">
        <input type="text" placeholder="Buscar por nombre o CUIT..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">CUIT</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condición</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Sin resultados</td></tr>
            ) : filtrados.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 font-medium text-gray-800">{c.nombre}</td>
                <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{c.cuit?.trim() || '—'}</td>
                <td className="px-5 py-3.5 text-gray-500">{c.condicion_pago ?? '—'}</td>
                <td className={`px-5 py-3.5 text-right font-semibold ${(c.saldo ?? 0) > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                  ${Number(c.saldo ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => abrirEditar(c)}
                    className="text-brand-600 hover:text-brand-800 font-medium text-xs">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {modal.id ? 'Editar cliente' : 'Nuevo cliente'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Nombre', key: 'nombre', col: 2 },
                { label: 'Dirección', key: 'direccion', col: 2 },
                { label: 'Localidad', key: 'localidad', col: 1 },
                { label: 'CUIT', key: 'cuit', col: 1 },
                { label: 'Condición de pago', key: 'condicion_pago', col: 1 },
                { label: 'Descuento %', key: 'descuento', col: 1 },
              ].map(({ label, key, col }) => (
                <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" value={(form as any)[key] ?? ''}
                    onChange={f(key as keyof Cliente)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(null)}
                className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando}
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-60">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
