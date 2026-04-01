import type { Metadata } from 'next'
import ToasterProvider from '@/components/ToasterProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'DMED — Gestión',
  description: 'Sistema de gestión de distribuidora médica',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        {children}
        <ToasterProvider />
      </body>
    </html>
  )
}
