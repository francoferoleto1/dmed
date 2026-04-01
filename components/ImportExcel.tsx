'use client'

import { useCallback, useId, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Upload, FileSpreadsheet, Download } from 'lucide-react'
import { toast } from 'sonner'
import Modal from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase'

export type ImportExcelProps = {
  /** Called after an import run finishes (success or partial), so the parent can refresh. */
  onImported?: () => void
}

type ArticleUpsertRow = {
  codigo: string
  nombre: string
  precio: number
  precio_publico: number
  presentacion: string | null
  registro: string | null
  detalle: string | null
  laboratorio: string | null
  descontinuado: boolean
  stock: number
}

const FIELD_DEFS: { key: keyof ArticleUpsertRow; label: string; required?: boolean }[] = [
  { key: 'codigo', label: 'Código', required: true },
  { key: 'nombre', label: 'Nombre', required: true },
  { key: 'precio', label: 'Precio' },
  { key: 'precio_publico', label: 'Precio público' },
  { key: 'presentacion', label: 'Presentación' },
  { key: 'registro', label: 'Registro' },
  { key: 'detalle', label: 'Detalle' },
  { key: 'laboratorio', label: 'Laboratorio' },
  { key: 'descontinuado', label: 'Descontinuado' },
  { key: 'stock', label: 'Stock' },
]

const NORM = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const HEADER_ALIASES: Record<string, keyof ArticleUpsertRow> = {
  codigo: 'codigo',
  code: 'codigo',
  'cod.': 'codigo',
  cod: 'codigo',
  nombre: 'nombre',
  name: 'nombre',
  descripcion: 'nombre',
  precio: 'precio',
  'precio venta': 'precio',
  'precio_publico': 'precio_publico',
  'precio publico': 'precio_publico',
  'precio público': 'precio_publico',
  pvp: 'precio_publico',
  presentacion: 'presentacion',
  presentación: 'presentacion',
  registro: 'registro',
  detalle: 'detalle',
  laboratorio: 'laboratorio',
  lab: 'laboratorio',
  descontinuado: 'descontinuado',
  discontinuado: 'descontinuado',
  activo: 'descontinuado', // inverted handled separately if needed; treat as synonym only for exact match ambiguity — skip alias
  stock: 'stock',
}

function autoMapHeaders(headers: string[]): Partial<Record<keyof ArticleUpsertRow, string>> {
  const out: Partial<Record<keyof ArticleUpsertRow, string>> = {}
  const used = new Set<string>()
  for (const h of headers) {
    const raw = String(h ?? '').trim()
    if (!raw) continue
    const n = NORM(raw)
    let field: keyof ArticleUpsertRow | undefined = HEADER_ALIASES[n.replace(/ /g, '_')]
    if (!field) field = HEADER_ALIASES[n]
    if (!field) {
      const underscored = n.replace(/ /g, '_')
      if (underscored in HEADER_ALIASES) field = HEADER_ALIASES[underscored]
    }
    if (field === 'descontinuado' && (n === 'activo' || n === 'activa')) continue
    if (field && !out[field] && !used.has(raw)) {
      out[field] = raw
      used.add(raw)
    }
  }
  return out
}

function parseNum(v: unknown): number {
  if (v === '' || v === null || v === undefined) return 0
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  const s = String(v).trim().replace(/\s/g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  const s = String(v).trim().toLowerCase()
  if (['1', 'true', 'si', 'sí', 'yes', 'x', 's'].includes(s)) return true
  return false
}

function strOrNull(v: unknown, max?: number): string | null {
  const t = String(v ?? '').trim()
  if (!t) return null
  if (max != null && t.length > max) return t.slice(0, max)
  return t
}

type ProblemRow = { row: number; reason: string }

const PREVIEW_ROWS = 10
const UPSERT_BATCH = 80

export function descargarPlantilla() {
  const ejemplos = [
    {
      codigo: '0001',
      nombre: 'IBUPROFENO 400MG',
      presentacion: 'COMP X 10',
      laboratorio: 'BAYER',
      precio: 450.5,
      precio_publico: 650,
      stock: 25,
      registro: 'REG123',
    },
    {
      codigo: '0002',
      nombre: 'PARACETAMOL 500MG',
      presentacion: 'COMP X 20',
      laboratorio: 'ROEMMERS',
      precio: 320,
      precio_publico: 480,
      stock: 120,
      registro: 'REG456',
    },
    {
      codigo: '0003',
      nombre: 'AMOXICILINA 500MG',
      presentacion: 'CAP X 14',
      laboratorio: 'GEDEON RICHTER',
      precio: 890.75,
      precio_publico: 1250,
      stock: 8,
      registro: 'REG789',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(ejemplos)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Artículos')
  XLSX.writeFile(wb, 'plantilla_articulos_dmed.xlsx')
}

export default function ImportExcel({ onImported }: ImportExcelProps) {
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [columnNames, setColumnNames] = useState<string[]>([])
  /** data rows as objects keyed by original Excel header */
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Partial<Record<keyof ArticleUpsertRow, string>>>({})

  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [problemRows, setProblemRows] = useState<ProblemRow[]>([])
  const [importSummary, setImportSummary] = useState<{ ok: number; err: number } | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const resetFileState = useCallback(() => {
    setFileName(null)
    setColumnNames([])
    setRows([])
    setMapping({})
    setProblemRows([])
    setImportSummary(null)
    setProgress({ done: 0, total: 0 })
  }, [])

  const handleOpen = () => {
    resetFileState()
    setOpen(true)
  }

  const handleClose = () => {
    if (importing) return
    setOpen(false)
    resetFileState()
  }

  const processFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Formato no soportado. Usá .xlsx, .xls o .csv')
      return
    }
    setImportSummary(null)
    setProblemRows([])
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const buf = e.target?.result
      if (!buf || !(buf instanceof ArrayBuffer)) {
        toast.error('No se pudo leer el archivo.')
        return
      }
      try {
        const wb = XLSX.read(buf, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        if (!sheetName) {
          toast.error('El archivo no tiene hojas.')
          return
        }
        const sheet = wb.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        })
        if (json.length === 0) {
          toast.error('No hay filas de datos en la primera hoja.')
          setColumnNames([])
          setRows([])
          setMapping({})
          return
        }
        const headers = Object.keys(json[0] ?? {})
        setColumnNames(headers)
        setRows(json)
        setMapping(autoMapHeaders(headers))
      } catch {
        toast.error('Error al interpretar el archivo.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const previewTable = useMemo(() => {
    if (!columnNames.length) return { headers: [] as string[], rows: [] as Record<string, unknown>[] }
    const slice = rows.slice(0, PREVIEW_ROWS)
    return { headers: columnNames, rows: slice }
  }, [columnNames, rows])

  const mappingReady = !!(mapping.codigo && mapping.nombre)

  const runImport = async () => {
    if (!mappingReady || !rows.length) {
      toast.error('Mapeá al menos código y nombre a columnas del archivo.')
      return
    }

    setImporting(true)
    setProblemRows([])
    setImportSummary(null)
    const problems: ProblemRow[] = []
    let ok = 0
    const toUpsert: ArticleUpsertRow[] = []
    const excelRowByIndex: number[] = []

    const totalLogical = rows.length
    setProgress({ done: 0, total: totalLogical })

    const bumpProgress = (i: number) => {
      if (i % 10 === 0 || i === rows.length - 1) {
        setProgress({ done: i + 1, total: totalLogical })
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const obj = rows[i]
      const excelRowNum = i + 2 // 1-based: fila 1 = encabezados
      const codRaw = mapping.codigo ? obj[mapping.codigo] : ''
      const nomRaw = mapping.nombre ? obj[mapping.nombre] : ''
      const codigo = String(codRaw ?? '').trim().slice(0, 10)
      const nombre = String(nomRaw ?? '').trim().slice(0, 80)

      if (!codigo) {
        problems.push({ row: excelRowNum, reason: 'Sin código' })
        bumpProgress(i)
        continue
      }
      if (!nombre) {
        problems.push({ row: excelRowNum, reason: 'Sin nombre' })
        bumpProgress(i)
        continue
      }

      const row: ArticleUpsertRow = {
        codigo,
        nombre,
        precio: mapping.precio ? parseNum(obj[mapping.precio]) : 0,
        precio_publico: mapping.precio_publico ? parseNum(obj[mapping.precio_publico]) : 0,
        presentacion: mapping.presentacion ? strOrNull(obj[mapping.presentacion], 30) : null,
        registro: mapping.registro ? strOrNull(obj[mapping.registro], 15) : null,
        detalle: mapping.detalle ? strOrNull(obj[mapping.detalle]) : null,
        laboratorio: mapping.laboratorio ? strOrNull(obj[mapping.laboratorio], 20) : null,
        descontinuado: mapping.descontinuado ? parseBool(obj[mapping.descontinuado]) : false,
        stock: mapping.stock ? parseNum(obj[mapping.stock]) : 0,
      }

      toUpsert.push(row)
      excelRowByIndex.push(excelRowNum)
      bumpProgress(i)
    }

    setProgress({ done: totalLogical, total: totalLogical })

    const flushUpsert = async (batch: ArticleUpsertRow[], rowNums: number[]) => {
      const { error } = await supabase
        .from('articulos')
        .upsert(batch, { onConflict: 'codigo' })

      if (!error) {
        ok += batch.length
        return
      }
      for (let b = 0; b < batch.length; b++) {
        const { error: oneErr } = await supabase
          .from('articulos')
          .upsert([batch[b]!], { onConflict: 'codigo' })
        if (oneErr) {
          problems.push({
            row: rowNums[b]!,
            reason: oneErr.message || 'Error al guardar en base de datos',
          })
        } else {
          ok += 1
        }
      }
    }

    let batch: ArticleUpsertRow[] = []
    let batchRows: number[] = []

    for (let j = 0; j < toUpsert.length; j++) {
      batch.push(toUpsert[j]!)
      batchRows.push(excelRowByIndex[j]!)
      if (batch.length >= UPSERT_BATCH) {
        await flushUpsert(batch, batchRows)
        batch = []
        batchRows = []
      }
    }
    if (batch.length) await flushUpsert(batch, batchRows)

    setImporting(false)
    setProblemRows(problems)
    setImportSummary({ ok, err: problems.length })
    toast.success(
      `${ok} artículos importados${problems.length ? `, ${problems.length} errores` : ''}`
    )
    onImported?.()
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="btn-secondary w-full sm:w-auto">
        <Upload className="h-4 w-4" />
        Importar Excel
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title="Importar artículos"
        subtitle="Excel o CSV · coincidencia por código"
        size="xl"
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="order-2 text-sm font-medium text-brand-700 underline-offset-2 hover:underline sm:order-1"
              onClick={() => descargarPlantilla()}
            >
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                Descargar plantilla
              </span>
            </button>
            <div className="order-1 flex justify-end gap-3 sm:order-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleClose}
                disabled={importing}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!mappingReady || !rows.length || importing}
                onClick={() => void runImport()}
              >
                {importing ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                document.getElementById(inputId)?.click()
              }
            }}
            onDragEnter={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragOver={e => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={e => {
              e.preventDefault()
              setDragOver(false)
            }}
            onDrop={e => {
              e.preventDefault()
              setDragOver(false)
              const f = e.dataTransfer.files[0]
              if (f) processFile(f)
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors ${
              dragOver
                ? 'border-brand-500 bg-brand-50/60'
                : 'border-gray-300 bg-gray-50/40 hover:border-brand-400/80 hover:bg-brand-50/30'
            }`}
            onClick={() => document.getElementById(inputId)?.click()}
          >
            <input
              id={inputId}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) processFile(f)
                e.target.value = ''
              }}
            />
            <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-gray-100">
              <FileSpreadsheet className="h-8 w-8 text-brand-600" />
            </div>
            <p className="mt-3 text-center text-sm font-semibold text-gray-900">
              Arrastrá un archivo aquí o hacé click para elegir
            </p>
            <p className="mt-1 text-center text-xs text-gray-500">.xlsx · .xls · .csv</p>
            {fileName && (
              <p className="mt-2 text-sm font-medium text-brand-700">{fileName}</p>
            )}
          </div>

          {importing && progress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-gray-600">
                <span>Progreso</span>
                <span>
                  {progress.done >= progress.total
                    ? 'Enviando al servidor…'
                    : `Importando ${progress.done} de ${progress.total}…`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-200 ease-out"
                  style={{
                    width: `${Math.min(100, (progress.done / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {columnNames.length > 0 && (
            <>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Mapeo de columnas
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {FIELD_DEFS.map(({ key, label, required }) => (
                    <div key={key}>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        {label}
                        {required && <span className="text-red-500"> *</span>}
                      </label>
                      <select
                        value={mapping[key] ?? ''}
                        onChange={e =>
                          setMapping(m => ({
                            ...m,
                            [key]: e.target.value || undefined,
                          }))
                        }
                        className="input-base w-full bg-white"
                      >
                        <option value="">— No importar —</option>
                        {columnNames.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {!mappingReady && (
                  <p className="mt-2 text-xs text-amber-700">
                    Seleccioná columnas para código y nombre para poder importar.
                  </p>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Vista previa (primeras {PREVIEW_ROWS} filas)
                </h3>
                <div className="table-wrap max-h-56 overflow-auto">
                  <table className="table-data min-w-[480px] text-xs">
                    <thead>
                      <tr>
                        {previewTable.headers.map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewTable.rows.map((r, idx) => (
                        <tr key={idx}>
                          {previewTable.headers.map(h => (
                            <td key={h} className="max-w-[10rem] truncate font-mono text-[11px]">
                              {String(r[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {importSummary && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Resumen</p>
              <p className="mt-1">
                {importSummary.ok} importados correctamente.
                {importSummary.err > 0 && (
                  <span className="text-red-700"> {importSummary.err} filas con problemas.</span>
                )}
              </p>
            </div>
          )}

          {problemRows.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">
                Filas con errores u omisiones
              </h3>
              <div className="max-h-40 overflow-auto rounded-xl border border-red-100 bg-red-50/40">
                <ul className="divide-y divide-red-100 px-3 py-1 text-sm">
                  {problemRows.map((p, i) => (
                    <li key={i} className="flex gap-2 py-2 text-red-900">
                      <span className="shrink-0 font-mono text-xs text-red-600">Fila {p.row}</span>
                      <span>{p.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
