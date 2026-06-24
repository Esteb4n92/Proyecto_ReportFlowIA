'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'motion/react'
import {
  TrayArrowUp,
  FileXls,
  CheckCircle,
  X,
  ArrowRight,
  ChatCircleText,
  ChartBar,
  FileMagnifyingGlass,
  Table,
  Sparkle,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

const SUGGESTIONS = [
  'Analiza las ventas por región y detecta lo más relevante',
  'Identifica tendencias mensuales y proyecta el próximo trimestre',
  'Compara costos vs ingresos y encuentra dónde se pierde margen',
]

const ANALYZE_PHASES: { icon: Icon; label: string }[] = [
  { icon: FileMagnifyingGlass, label: 'Leyendo el archivo…' },
  { icon: Table, label: 'Detectando columnas y métricas…' },
  { icon: Sparkle, label: 'Generando análisis con IA…' },
  { icon: ChartBar, label: 'Creando gráficos…' },
]

const FLOW_STEPS: { icon: Icon; title: string; caption: string }[] = [
  { icon: TrayArrowUp, title: 'Sube tu archivo', caption: '.xlsx, .xls, .csv o .json' },
  { icon: ChatCircleText, title: 'Describe qué necesitas', caption: 'Instrucciones opcionales para la IA' },
  { icon: ChartBar, title: 'Recibe tu dashboard', caption: 'Gráficos, insights y análisis completo' },
]

const EASE = [0.22, 1, 0.36, 1] as const

function fadeUp(delayMs: number) {
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.65, ease: EASE, delay: delayMs / 1000 },
  }
}

// Reveal con máscara: el contenido sube desde abajo detrás de un recorte.
// Útil para texto con gradiente, que debe revelarse como un solo bloque.
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <span className={'inline-block overflow-hidden pb-[0.12em] align-bottom ' + (className ?? '')}>
      <motion.span
        className="inline-block"
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, ease: EASE, delay }}
      >
        {children}
      </motion.span>
    </span>
  )
}

// Palabras con stagger: cada palabra sube en secuencia tras su propia máscara.
function Words({
  text,
  delay = 0,
  step = 0.06,
  className,
}: {
  text: string
  delay?: number
  step?: number
  className?: string
}) {
  const words = text.split(' ')
  return (
    <>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className={'inline-block ' + (className ?? '')}
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: delay + i * step }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </>
  )
}

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return Math.max(1, Math.round(bytes / 1e3)) + ' KB'
}

// Detecta lg+ (≥1024px). Empieza en false para coincidir con el SSR y se
// actualiza en cliente; sirve para desactivar el tilt 3D y el efecto magnético
// en pantallas chicas (donde solo estorban y no hay cursor).
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

// Efecto "magnético": el contenido se desplaza suavemente hacia el cursor
// mientras el mouse está encima, y vuelve a su lugar con un spring al salir.
function Magnetic({
  children,
  enabled,
  strength = 0.3,
}: {
  children: React.ReactNode
  enabled: boolean
  strength?: number
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 14, mass: 0.4 })
  const sy = useSpring(y, { stiffness: 220, damping: 14, mass: 0.4 })

  return (
    <motion.div
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        if (!enabled) return
        const r = e.currentTarget.getBoundingClientRect()
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onMouseLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

// ---------- dropzone ----------

function DropZone({
  file,
  setFile,
  onError,
}: {
  file: File | null
  setFile: (f: File | null) => void
  onError: (msg: string | null) => void
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!/\.(xlsx|xls|csv|json)$/i.test(f.name)) {
      onError('Solo se aceptan archivos .xlsx, .xls, .csv o .json')
      return
    }
    onError(null)
    setFile(f)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !file && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files?.[0]
        if (f) handleFile(f)
      }}
      className={
        'group relative w-full cursor-pointer overflow-hidden rounded-xl border border-dashed p-5 text-center transition-all duration-300 sm:p-7 ' +
        (dragging
          ? 'border-blue-400/70 bg-blue-500/[.06] scale-[1.01]'
          : file
          ? 'cursor-default border-blue-500/30 bg-slate-900/60'
          : 'border-slate-700/80 bg-slate-950/40 hover:border-blue-500/40 hover:bg-slate-900/50')
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />
      <div
        className={
          'pointer-events-none absolute -top-16 left-1/2 h-32 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl transition-opacity duration-500 ' +
          (dragging || file ? 'opacity-100' : 'opacity-0 group-hover:opacity-60')
        }
      />

      {!file ? (
        <div className="relative flex flex-col items-center gap-1">
          <div
            className={
              'mb-3 flex size-12 items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900 text-slate-300 transition-all duration-300 group-hover:border-blue-500/30 group-hover:text-blue-400 ' +
              (dragging ? 'scale-110 border-blue-400/60 text-blue-300' : 'fx-float')
            }
          >
            <TrayArrowUp className="size-6" />
          </div>
          <p className="text-sm font-medium text-slate-200">
            {dragging ? 'Suelta el archivo' : 'Arrastra tus datos aquí'}
          </p>
          <p className="text-xs text-slate-500">o haz clic para seleccionar · .xlsx, .xls, .csv o .json</p>
        </div>
      ) : (
        <div className="relative flex items-center gap-3.5 text-left">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <FileXls weight="fill" className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{file.name}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle weight="bold" className="size-3.5 text-green-400" />
              Listo para analizar · {formatBytes(file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setFile(null)
            }}
            aria-label="Quitar archivo"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ---------- botón analizar con fases ----------

function AnalyzeButton({
  ready,
  analyzing,
  onStart,
}: {
  ready: boolean
  analyzing: boolean
  onStart: () => void
}) {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (!analyzing) {
      setPhase(0)
      return
    }
    if (phase >= ANALYZE_PHASES.length - 1) return
    const t = setTimeout(() => setPhase(phase + 1), 950)
    return () => clearTimeout(t)
  }, [analyzing, phase])

  if (analyzing) {
    const p = ANALYZE_PHASES[phase]
    const PhaseIcon = p.icon
    return (
      <div className="relative h-12 w-full overflow-hidden rounded-xl border border-blue-500/25 bg-blue-500/[.07]">
        <div className="fx-shimmer absolute inset-0" />
        <div
          className="absolute inset-y-0 left-0 bg-blue-500/15 transition-all duration-700 ease-out"
          style={{ width: ((phase + 1) / ANALYZE_PHASES.length) * 100 + '%' }}
        />
        <div className="relative flex h-full items-center justify-center gap-2.5 text-sm font-medium text-blue-300">
          <PhaseIcon className="size-[18px]" />
          <motion.span
            key={phase}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {p.label}
          </motion.span>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={onStart}
      className={
        'inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 ' +
        (ready
          ? 'bg-blue-500 text-white hover:bg-blue-400 hover:shadow-[0_0_32px_rgba(59,130,246,.3)] active:scale-[.99]'
          : 'cursor-not-allowed border border-slate-800 bg-slate-900/60 text-slate-600')
      }
    >
      Analizar con IA
      <ArrowRight weight="bold" className="size-4" />
    </button>
  )
}

// ---------- página ----------

export default function ExcelFlowPage() {
  const router = useRouter()
  const isDesktop = useIsDesktop()
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Tilt 3D sutil del panel de carga según la posición del mouse (solo desktop)
  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const rotateX = useSpring(useTransform(tiltY, [-0.5, 0.5], [5, -5]), { stiffness: 150, damping: 16 })
  const rotateY = useSpring(useTransform(tiltX, [-0.5, 0.5], [-5, 5]), { stiffness: 150, damping: 16 })

  const handleUpload = async () => {
    if (!file || analyzing) return
    setAnalyzing(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (prompt.trim()) formData.append('instructions', prompt.trim())

      const res = await fetch('/api/excel-flow/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al subir el archivo')
      }
      const { reportId } = await res.json()
      router.push(`/excel-flow/report/${reportId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setAnalyzing(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-4 sm:px-8 sm:gap-8 lg:grid lg:grid-cols-[1fr_minmax(0,29rem)] lg:items-center lg:gap-16 lg:py-0">
      {/* columna izquierda: hero + pasos */}
      <section>
        <h1 className="max-w-xl text-3xl font-semibold leading-[1.08] tracking-tight text-slate-50 sm:text-5xl">
          <Words text="Analiza tus datos" delay={0.08} />
          <br />
          <Reveal delay={0.34}>
            <span className="bg-gradient-to-r from-sky-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              con IA
            </span>
          </Reveal>
        </h1>
        <motion.p {...fadeUp(320)} className="mt-3 max-w-md text-sm leading-relaxed text-slate-400 sm:mt-4 sm:text-[15px]">
          Sube tus datos, describe qué quieres analizar y la IA genera el informe con gráficos e
          insights.
        </motion.p>

        <ol className="mt-10 hidden lg:block">
          {FLOW_STEPS.map((step, i) => {
            const StepIcon = step.icon
            return (
              <motion.li key={step.title} {...fadeUp(440 + i * 120)}>
                <div className="flex items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-blue-400">
                    <StepIcon className="size-[18px]" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{step.title}</p>
                    <p className="text-[13px] text-slate-500">{step.caption}</p>
                  </div>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="ml-5 h-6 w-px bg-gradient-to-b from-slate-800 to-slate-800/20" />
                )}
              </motion.li>
            )
          })}
        </ol>
      </section>

      {/* columna derecha: panel de carga (con tilt 3D según el mouse) */}
      <motion.section
        {...fadeUp(200)}
        onMouseMove={
          isDesktop
            ? (e) => {
                const r = e.currentTarget.getBoundingClientRect()
                tiltX.set((e.clientX - r.left) / r.width - 0.5)
                tiltY.set((e.clientY - r.top) / r.height - 0.5)
              }
            : undefined
        }
        onMouseLeave={
          isDesktop
            ? () => {
                tiltX.set(0)
                tiltY.set(0)
              }
            : undefined
        }
        style={isDesktop ? { rotateX, rotateY, transformPerspective: 1000 } : undefined}
        className="relative rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 shadow-[0_24px_80px_rgba(0,0,0,.5)] backdrop-blur-xl sm:p-6"
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

        <DropZone file={file} setFile={setFile} onError={setError} />

        <div className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <label htmlFor="prompt" className="text-[13px] font-medium text-slate-300">
              Instrucciones para la IA
            </label>
            <span className="text-xs text-slate-600">opcional</span>
          </div>
          <textarea
            id="prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ej: Analiza las ventas por región y resalta los meses atípicos…"
            className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 transition-colors duration-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPrompt(s)}
                className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-400 transition-all duration-200 hover:-translate-y-px hover:border-blue-500/30 hover:text-blue-300"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden rounded-xl border border-red-500/15 bg-red-500/[.08] px-4 py-3 text-xs text-red-400"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="mt-6">
          <Magnetic enabled={isDesktop && !!file && !analyzing}>
            <AnalyzeButton ready={!!file} analyzing={analyzing} onStart={handleUpload} />
          </Magnetic>
        </div>
      </motion.section>
    </div>
  )
}
