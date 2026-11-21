'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks'
import AppLayout from '@/app/components/AppLayout'
import { obtenerRutinaEditable } from '@/lib/services/rutina-service'
import {
  crearSesion,
  obtenerSesionEnProgreso,
  obtenerSesionesRecientes,
} from '@/lib/services/sesion-service'
import { DiaConEjerciciosEditables } from '@/lib/types/database'
import { cuandoFue, entrenamientosEstaSemana, semanaActual, siguienteDia } from '@/lib/utils/hoy'
import { abrirChat } from '@/lib/utils/chat-evento'

type SesionReciente = {
  id: string
  dia_id: string | null
  finalizada_at: string
  dia_nombre: string
  series_completadas: number
}

function fechaDeHoy(ahora: Date): string {
  const texto = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function contarSeries(dia: DiaConEjerciciosEditables): number {
  return dia.ejercicios.reduce((total, ej) => total + ej.series, 0)
}

export default function HoyPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { loading: loadingAuth, authenticated, userId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [rutinaId, setRutinaId] = useState<string | null>(null)
  const [dias, setDias] = useState<DiaConEjerciciosEditables[]>([])
  const [sesiones, setSesiones] = useState<SesionReciente[]>([])
  const [enCurso, setEnCurso] = useState<{ sesionId: string; diaNombre: string } | null>(null)
  const [creando, setCreando] = useState<string | null>(null)
  const ahora = useMemo(() => new Date(), [])

  useEffect(() => {
    if (loadingAuth) return
    if (!authenticated || !userId) {
      router.replace('/')
      return
    }

    const cargar = async () => {
      const [rutina, enProgreso, recientes] = await Promise.all([
        obtenerRutinaEditable(supabase, userId),
        obtenerSesionEnProgreso(supabase, userId),
        obtenerSesionesRecientes(supabase, userId),
      ])

      // Sin rutina no hay nada que entrenar: el inicio la genera
      if (!rutina.success || !rutina.data) {
        router.replace('/')
        return
      }

      setRutinaId(rutina.data.rutina.id)
      setDias(rutina.data.dias)
      if (enProgreso.success) setEnCurso(enProgreso.data ?? null)
      if (recientes.success && recientes.data) setSesiones(recientes.data)
      setLoading(false)
    }

    cargar()
  }, [loadingAuth, authenticated, userId, supabase, router])

  const empezar = async (diaId: string) => {
    if (!userId || !rutinaId || enCurso || creando) return
    setCreando(diaId)
    const resultado = await crearSesion(supabase, { userId, rutinaId, diaId })
    if (resultado.success && resultado.data) {
      router.push(`/entrenar/${resultado.data.sesionId}`)
      return
    }
    toast.error('No se pudo empezar el entrenamiento. Intentá de nuevo.')
    setCreando(null)
  }

  if (loadingAuth || loading) {
    return (
      <AppLayout>
        <div className="min-h-screen app-page-bg flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    )
  }

  const ultima = sesiones[0] ?? null
  const toca = siguienteDia(dias, ultima?.dia_id ?? null)
  const otrosDias = [...dias].sort((a, b) => a.orden - b.orden).filter((d) => d.id !== toca?.id)
  const ultimaVezQueToca = toca ? sesiones.find((s) => s.dia_id === toca.id) : undefined
  const semana = semanaActual(sesiones, ahora)
  const hechasEstaSemana = entrenamientosEstaSemana(sesiones, ahora)

  return (
    <AppLayout>
      <div className="min-h-screen app-page-bg p-4 md:p-8">
        <div className="max-w-xl mx-auto flex flex-col gap-5">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-600">{fechaDeHoy(ahora)}</p>
              <h1 className="text-5xl font-display text-slate-900 tracking-widest uppercase leading-none">
                Hoy
              </h1>
            </div>
            <button
              type="button"
              onClick={abrirChat}
              aria-label="Abrir el chat con el coach"
              className="md:hidden w-11 h-11 flex-shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center text-neutral-900 hover:bg-slate-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
              </svg>
            </button>
          </header>

          {/* Lo principal: qué entrenar ahora */}
          {enCurso ? (
            <section aria-label="Entrenamiento en curso" className="bg-neutral-900 rounded-3xl p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-neutral-300">En curso</p>
                <h2 className="text-5xl font-display text-yellow-500 tracking-wider leading-none mt-1">
                  {enCurso.diaNombre || 'Tu entrenamiento'}
                </h2>
                <p className="text-neutral-200 mt-1">Lo dejaste a mitad de camino. Está todo guardado.</p>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/entrenar/${enCurso.sesionId}`)}
                className="h-14 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 active:bg-yellow-600 transition-colors"
              >
                Continuar entrenamiento
              </button>
            </section>
          ) : toca ? (
            <section aria-label="Entrenamiento de hoy" className="bg-neutral-900 rounded-3xl p-5 flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-neutral-300">Te toca</p>
                <h2 className="text-5xl font-display text-yellow-500 tracking-wider leading-none mt-1 break-words">
                  Día {toca.orden} · {toca.nombre_dia}
                </h2>
                <p className="text-neutral-200 mt-1">
                  {toca.ejercicios.length} ejercicios · {contarSeries(toca)} series
                  {ultimaVezQueToca ? ` · la última vez fue ${cuandoFue(ultimaVezQueToca.finalizada_at, ahora)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => empezar(toca.id)}
                disabled={!!creando}
                className="h-14 bg-yellow-500 text-black rounded-2xl font-bold text-lg hover:bg-yellow-400 active:bg-yellow-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 4.5v15l13-7.5z" />
                </svg>
                {creando === toca.id ? 'Empezando...' : 'Empezar entrenamiento'}
              </button>
            </section>
          ) : null}

          {!enCurso && otrosDias.length > 0 && (
            <section aria-labelledby="titulo-otro-dia" className="flex flex-col gap-2">
              <h2 id="titulo-otro-dia" className="text-sm font-semibold text-slate-600">¿Otro día?</h2>
              <div className="flex flex-wrap gap-2">
                {otrosDias.map((dia) => (
                  <button
                    key={dia.id}
                    type="button"
                    onClick={() => empezar(dia.id)}
                    disabled={!!creando}
                    className="flex-1 min-w-[96px] min-h-12 px-3 py-2 bg-white border border-slate-200 rounded-2xl font-semibold text-slate-900 hover:border-yellow-400 hover:bg-yellow-50 transition-colors disabled:opacity-60"
                  >
                    {creando === dia.id ? 'Empezando...' : dia.nombre_dia}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="titulo-semana" className="bg-white border border-slate-200 rounded-3xl p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="titulo-semana" className="font-bold text-slate-900">Esta semana</h2>
              <p className="text-sm font-semibold text-slate-600">
                {hechasEstaSemana} de {dias.length}
              </p>
            </div>
            <ol className="grid grid-cols-7 gap-1 text-center">
              {semana.map((d) => (
                <li key={d.nombre} className="flex flex-col items-center gap-1.5">
                  <span className={`text-xs font-semibold ${d.esHoy ? 'text-slate-900' : 'text-slate-600'}`} aria-hidden="true">
                    {d.inicial}
                  </span>
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      d.entrenado
                        ? 'bg-yellow-500 text-black'
                        : d.esHoy
                          ? 'border-2 border-neutral-900'
                          : 'bg-slate-100'
                    }`}
                  >
                    {d.entrenado && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="sr-only">
                      {d.nombre}{d.esHoy ? ' (hoy)' : ''}: {d.entrenado ? 'entrenaste' : 'sin entrenamiento'}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {ultima && (
            <Link
              href={`/entrenamiento/${ultima.id}`}
              className="bg-white border border-slate-200 rounded-3xl p-4 flex items-center gap-3 hover:border-slate-300 transition-colors"
            >
              <span className="w-11 h-11 rounded-xl bg-yellow-50 text-yellow-800 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-slate-900 break-words">
                  Última sesión{ultima.dia_nombre ? `: ${ultima.dia_nombre}` : ''}
                </span>
                <span className="block text-sm text-slate-600">
                  {(() => {
                    const cuando = cuandoFue(ultima.finalizada_at, ahora)
                    return cuando.charAt(0).toUpperCase() + cuando.slice(1)
                  })()} · {ultima.series_completadas} series
                </span>
              </span>
              <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
