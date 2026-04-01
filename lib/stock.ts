/** Umbral para considerar stock bajo (configurable en un solo lugar). */
export const STOCK_LOW_THRESHOLD = 10

export type StockStatus = 'sin' | 'bajo' | 'ok'

export function stockStatus(stock: number): StockStatus {
  const s = Number(stock ?? 0)
  if (s <= 0) return 'sin'
  if (s < STOCK_LOW_THRESHOLD) return 'bajo'
  return 'ok'
}

/** Clase simple para la columna stock — sin pills ni colores estridentes. */
export function stockPillClass(_stock: number): string {
  return 'text-sm font-medium tabular-nums text-gray-900'
}