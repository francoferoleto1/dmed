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
