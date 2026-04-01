import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

export type Cliente = {
  id: number
  codigo: number
  nombre: string
  direccion?: string
  localidad?: string
  condicion_pago?: string
  cuit?: string
  condicion_iva?: number
  saldo?: number
  descuento?: number
}

export type Articulo = {
  id: number
  codigo: string
  nombre: string
  precio: number
  precio_publico: number
  presentacion?: string
  laboratorio?: string
  stock: number
  descontinuado: boolean
}

export type Venta = {
  id: number
  control: number
  fecha: string
  cliente_id: number
  total: number
  tipo: number
  detalle?: string
  clientes?: { nombre: string }
}

export type VentaItem = {
  id: number
  venta_control: number
  articulo_codigo: string
  cantidad: number
  precio: number
  descuento: number
  importe: number
  articulos?: { nombre: string; presentacion: string }
}

export type MovimientoStock = {
  id: number
  articulo_id: number
  tipo: string
  cantidad: number
  stock_anterior: number
  stock_nuevo: number
  referencia_tipo: string | null
  referencia_id: number | null
  detalle: string | null
  usuario_id: string | null
  created_at: string
}

export type MovimientoCuenta = {
  id: number
  cliente_id: number
  tipo: string
  monto: number
  saldo_anterior: number
  saldo_nuevo: number
  referencia_tipo: string | null
  referencia_id: number | null
  detalle: string | null
  usuario_id: string | null
  created_at: string
}

export type Pago = {
  id: number
  cliente_id: number
  monto: number
  metodo_pago: string
  detalle: string | null
  usuario_id: string | null
  created_at: string
}
