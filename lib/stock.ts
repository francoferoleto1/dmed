/** Umbral para considerar stock bajo (configurable en un solo lugar). */
export const STOCK_LOW_THRESHOLD = 10

export type StockStatus = 'sin' | 'bajo' | 'ok'

export function stockStatus(stock: number): StockStatus {
  const s = Number(stock ?? 0)
  if (s <= 0) return 'sin'
  if (s < STOCK_LOW_THRESHOLD) return 'bajo'
  return 'ok'
}

/** Pill/badge para columna stock en listados (fondo + texto). */
export function stockPillClass(stock: number): string {
  const s = stockStatus(stock)
  const base =
    'inline-flex min-w-[3.25rem] justify-end rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ring-1 ring-inset'
  if (s === 'sin') return `${base} bg-red-50 text-red-700 ring-red-100`
  if (s === 'bajo') return `${base} bg-amber-50 text-amber-800 ring-amber-100`
  return `${base} bg-emerald-50 text-emerald-800 ring-emerald-100`
}
