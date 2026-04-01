'use client'

import Breadcrumbs from '@/components/Breadcrumbs'

export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex-1 bg-gradient-to-b from-gray-50 to-gray-100/80 ml-56 sm:ml-64">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <Breadcrumbs />
        <div className="animate-page-in">{children}</div>
      </div>
    </div>
  )
}
