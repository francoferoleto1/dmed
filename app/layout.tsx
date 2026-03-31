import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DMED — Gestión',
  description: 'Sistema de gestión de distribuidora médica',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
