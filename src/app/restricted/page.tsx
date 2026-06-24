'use client'

import Image from 'next/image'
import { ShieldWarning } from '@phosphor-icons/react'
import { BackgroundFX } from '@/components/excel-flow/background-fx'
import { LogoutButton } from '@/components/excel-flow/logout-button'

// Pantalla para usuarios autenticados cuyo rol no es 'admin'. No expone nada de
// la app. Por ahora todas las cuentas 'user' caen acá (acceso deshabilitado).
export default function RestrictedPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 text-center">
      <BackgroundFX />
      <div className="relative z-10 w-full max-w-md">
        <Image
          src="/logo-icon.png"
          alt="ReportFlow IA"
          width={44}
          height={44}
          className="mx-auto size-11 rounded-xl border border-slate-800/60 shadow-[0_0_28px_rgba(59,130,246,.30)]"
        />

        <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
          <ShieldWarning weight="fill" className="size-7" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-50">
          Acceso restringido
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
          Tu cuenta está activa, pero todavía no tiene permisos para usar ReportFlow IA. El acceso
          está habilitado solo para administradores por ahora.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Si crees que es un error, contacta al administrador.
        </p>

        <div className="mt-8 flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}
