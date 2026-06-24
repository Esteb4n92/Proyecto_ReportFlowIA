'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignOut, SpinnerGap } from '@phosphor-icons/react'
import { createSupabaseBrowserClient } from '@/lib/excel-flow/supabase-browser'

// Botón de cerrar sesión. `compact` solo muestra el ícono (para barras apretadas).
export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-3.5 text-[13px] font-medium text-slate-400 transition-colors duration-200 hover:border-slate-700 hover:text-slate-200 disabled:opacity-60"
    >
      {loading ? (
        <SpinnerGap className="size-4 animate-spin" />
      ) : (
        <SignOut className="size-4" />
      )}
      {!compact && <span className="hidden sm:inline">Cerrar sesión</span>}
    </button>
  )
}
