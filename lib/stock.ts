/** Umbral para considerar stock bajo (configurable en un solo lugar). */
export const STOCK_LOW_THRESHOLD = 10

export type StockStatus = 'sin' | 'bajo' | 'ok'

export function stockStatus(stock: number): StockStatus {
  const s = Number(stock ?? 0)
  if (s <= 0) return 'sin'
  if (s < STOCK_LOW_THRESHOLD) return 'bajo'
  return 'ok'
}

export function stockAmountClass(stock: number): string {
  const s = stockStatus(stock)
  if (s === 'sin') return 'text-red-600 font-bold tabular-nums'
  if (s === 'bajo') return 'text-amber-600 font-semibold tabular-nums'
  return 'text-emerald-600 font-semibold tabular-nums'
}
