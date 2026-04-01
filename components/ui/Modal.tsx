'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClass = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className = '',
}: ModalProps) {
  const prevOverflow = useRef('')

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    // Guardar y bloquear scroll
    prevOverflow.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      // SIEMPRE restaurar el overflow
      document.body.style.overflow = prevOverflow.current || ''
    }
  }, [open, onClose])

  // Seguridad: si no está abierto, asegurar que el body no quede bloqueado
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  // Usar portal para renderizar FUERA del layout/sidebar
  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: 99999 }}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        style={{ zIndex: 99999 }}
        onClick={onClose}
      />

      {/* Modal box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative flex max-h-[min(90vh,900px)] w-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl animate-modal-in ${sizeClass[size]} ${className}`}
        style={{ zIndex: 100000 }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-bold text-gray-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-gray-100 bg-gray-50/50 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  // Renderizar con portal en document.body (fuera del sidebar y layout)
  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}