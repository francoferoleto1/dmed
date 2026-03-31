import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Venta, VentaItem, Cliente } from './supabase'

export function generarRemitoPDF(
  venta: Venta,
  items: VentaItem[],
  cliente: Cliente,
  empresa: string = 'Distribuidora'
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ── Header ──────────────────────────────────────────
  doc.setFillColor(36, 120, 90)
  doc.rect(0, 0, 210, 32, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text(empresa.toUpperCase(), 14, 14)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('REMITO', 14, 22)

  // Número de remito
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`N° ${String(venta.control).padStart(6, '0')}`, 196, 14, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const fecha = new Date(venta.fecha + 'T00:00:00').toLocaleDateString('es-AR')
  doc.text(`Fecha: ${fecha}`, 196, 22, { align: 'right' })

  // ── Datos del cliente ───────────────────────────────
  doc.setTextColor(30, 30, 30)
  doc.setFillColor(240, 249, 244)
  doc.rect(14, 38, 182, 28, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(36, 120, 90)
  doc.text('DATOS DEL CLIENTE', 18, 45)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(10)
  doc.text(cliente.nombre, 18, 52)

  doc.setFontSize(9)
  const cuit = cliente.cuit?.trim() ? `CUIT: ${cliente.cuit}` : ''
  const cond = cliente.condicion_pago ? `Condición: ${cliente.condicion_pago}` : ''
  const dir = [cliente.direccion, cliente.localidad].filter(Boolean).join(' — ')
  if (dir) doc.text(dir, 18, 58)
  if (cuit) doc.text(cuit, 120, 52)
  if (cond) doc.text(cond, 120, 58)

  // ── Tabla de items ──────────────────────────────────
  const rows = items.map(item => [
    item.articulo_codigo,
    item.articulos?.nombre || item.articulo_codigo,
    item.articulos?.presentacion || '',
    item.cantidad.toString(),
    `$${item.precio.toFixed(2)}`,
    item.descuento > 0 ? `${item.descuento}%` : '-',
    `$${item.importe.toFixed(2)}`,
  ])

  autoTable(doc, {
    startY: 72,
    head: [['Código', 'Descripción', 'Present.', 'Cant.', 'Precio', 'Dto.', 'Importe']],
    body: rows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [36, 120, 90], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 249, 244] },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 70 },
      2: { cellWidth: 25 },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  // ── Total ────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 6
  doc.setFillColor(36, 120, 90)
  doc.rect(140, finalY, 56, 10, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', 144, finalY + 7)
  doc.text(`$${venta.total.toFixed(2)}`, 194, finalY + 7, { align: 'right' })

  // ── Footer ───────────────────────────────────────────
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Documento no válido como factura', 105, 285, { align: 'center' })

  doc.save(`remito-${String(venta.control).padStart(6, '0')}.pdf`)
}
