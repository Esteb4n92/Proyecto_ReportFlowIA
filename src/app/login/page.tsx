'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import {
  EnvelopeSimple,
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  SpinnerGap,
  WarningCircle,
} from '@phosphor-icons/react'
import { createSupabaseBrowserClient } from '@/lib/excel-flow/supabase-browser'
import { BackgroundFX } from '@/components/excel-flow/background-fx'

const EASE = [0.22, 1, 0.36, 1] as const

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/excel-flow'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tilt 3D sutil según la posición del mouse (igual que el panel de carga).
  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const rotateX = useSpring(useTransform(tiltY, [-0.5, 0.5], [5, -5]), { stiffness: 150, damping: 16 })
  const rotateY = useSpring(useTransform(tiltX, [-0.5, 0.5], [-5, 5]), { stiffness: 150, damping: 16 })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || !email.trim() || !password) return
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(
        signInError.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos'
          : 'No se pudo iniciar sesión. Intenta de nuevo.'
      )
      setLoading(false)
      return
    }

    // El middleware decide si el rol tiene acceso (admin) o lo manda a /restricted.
    router.replace(redirectTo)
    router.refresh()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        tiltX.set((e.clientX - r.left) / r.width - 0.5)
        tiltY.set((e.clientY - r.top) / r.height - 0.5)
      }}
      onMouseLeave={() => {
        tiltX.set(0)
        tiltY.set(0)
      }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className="relative w-full max-w-sm"
    >
      <div className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-7 shadow-[0_24px_80px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo-icon.png"
            alt="ReportFlow IA"
            width={48}
            height={48}
            className="size-12 rounded-xl border border-slate-800/60 shadow-[0_0_28px_rgba(59,130,246,.30)]"
          />
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-50">
            Inicia sesión
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Accede a tu panel de{' '}
            <span className="bg-gradient-to-r from-sky-400 to-violet-400 bg-clip-text font-medium text-transparent">
              ReportFlow IA
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-slate-300">
              Correo electrónico
            </label>
            <div className="relative">
              <EnvelopeSimple className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-500" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-11 pr-4 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-slate-300">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-500" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-11 pr-11 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
              >
                {showPassword ? <EyeSlash className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[.08] px-3.5 py-2.5 text-xs text-red-400"
            >
              <WarningCircle weight="fill" className="size-4 shrink-0" />
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className={
              'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 ' +
              (loading || !email.trim() || !password
                ? 'cursor-not-allowed border border-slate-800 bg-slate-900/60 text-slate-600'
                : 'bg-blue-500 text-white hover:bg-blue-400 hover:shadow-[0_0_32px_rgba(59,130,246,.3)] active:scale-[.99]')
            }
          >
            {loading ? (
              <>
                <SpinnerGap className="size-4 animate-spin" />
                Verificando…
              </>
            ) : (
              <>
                Entrar
                <ArrowRight weight="bold" className="size-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-5 text-center text-xs text-slate-600">
        El acceso es solo por invitación. Las cuentas las crea el administrador.
      </p>
    </motion.div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
      <BackgroundFX />
      <div className="relative z-10 flex w-full flex-col items-center">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
