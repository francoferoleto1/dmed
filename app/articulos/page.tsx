'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient, Articulo } from '@/lib/supabase'

export default function ArticulosPage() {
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<Articulo | null>(null)
  const [form, setForm] = useState<Partial<Articulo>>({})
  const [guardando, setGuardando] = useState(false)
  const [soloActivos, setSoloActivos] = useState(true)
  const supabase = createClient()

  const cargar = async () => {
    setLoading(true)
    const { data } = await supabase.from('articulos').select('*').order('nombre')
    setArticulos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const filtrados = articulos.filter(a => {
    if (soloActivos && a.descontinuado) return false
    return (
      a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
      (a.laboratorio ?? '').toLowerCase().includes(busqueda.toLowerCase())
    )
  })

  const abrirNuevo = () => {
    setForm({ precio: 0, precio_publico: 0, stock: 0, descontinuado: false })
    setModal({} as Articulo)
  }

  const abrirEditar = (a: Articulo) => { setForm(a); setModal(a) }

  const guardar = async () => {
    setGuardando(true)
    if (modal?.id) {
      await supabase.from('articulos').update(form).eq('id', modal.id)
    } else {
      await supabase.from('articulos').insert(form)
    }
    setGuardando(false)
    setModal(null)
    cargar()
  }

  const f = (k: keyof Articulo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Artículos</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filtrados.length} artículos</p>
        </div>
        <button onClick={abrirNuevo}
          className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          + Nuevo artículo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-5 items-center">
        <input type="text" placeholder="Buscar por nombre, código o laboratorio..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)}
            className="accent-brand-600 w-4 h-4" />
          Solo activos
        </label>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Present.</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lab.</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Precio</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Sin resultados</td></tr>
            ) : filtrados.map(a => (
              <tr key={a.id} className={`hover:bg-gray-50 transition-colors ${a.descontinuado ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3 font-mono text-xs text-gray-500">{a.codigo}</td>
                <td className="px-5 py-3 font-medium text-gray-800">{a.nombre}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{a.presentacion ?? '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">{a.laboratorio ?? '—'}</td>
                <td className="px-5 py-3 text-right font-semibold text-gray-800">
                  ${Number(a.precio).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 py-3 text-right text-gray-600">{a.stock}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => abrirEditar(a)}
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
              {modal.id ? 'Editar artículo' : 'Nuevo artículo'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Código', key: 'codigo', col: 1 },
                { label: 'Laboratorio', key: 'laboratorio', col: 1 },
                { label: 'Nombre', key: 'nombre', col: 2 },
                { label: 'Presentación', key: 'presentacion', col: 1 },
                { label: 'Registro', key: 'registro', col: 1 },
                { label: 'Precio', key: 'precio', col: 1 },
                { label: 'Precio público', key: 'precio_publico', col: 1 },
                { label: 'Stock', key: 'stock', col: 1 },
              ].map(({ label, key, col }) => (
                <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type="text" value={(form as any)[key] ?? ''}
                    onChange={f(key as keyof Articulo)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              ))}
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="desc" checked={!!form.descontinuado}
                  onChange={e => setForm(prev => ({ ...prev, descontinuado: e.target.checked }))}
                  className="accent-brand-600 w-4 h-4" />
                <label htmlFor="desc" className="text-sm text-gray-600">Descontinuado</label>
              </div>
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
