'use client'

import { Toaster } from 'sonner'

export default function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'rounded-xl shadow-card-md border border-gray-200/80 font-sans',
        },
      }}
    />
  )
}
