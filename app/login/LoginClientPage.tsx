'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pill } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function LoginClientPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        setError(error.message || 'Email o contraseña incorrectos.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('No se pudo iniciar sesión. Verificá la configuración de Supabase.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-brand-50 to-brand-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 shadow-lg shadow-brand-900/25">
            <Pill className="h-8 w-8 text-white" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">DMED</h1>
          <p className="mt-1 text-sm font-medium text-gray-600">Gestión farmacéutica</p>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-8 shadow-card-md">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-gray-700">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={`input-base ${error ? 'input-error' : ''}`}
                placeholder="usuario@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-gray-700">
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className={`input-base ${error ? 'input-error' : ''}`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
