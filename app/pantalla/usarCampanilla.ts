"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * `undefined` en anterior significa que todavia no llego ningun snapshot: es la
 * carga inicial y no tiene que sonar aunque haya llamados previos del dia.
 * `null` significa que si hubo snapshot y no habia nadie llamado, asi que el
 * primer llamado del dia si suena.
 */
export function debeSonar(
  anterior: string | null | undefined,
  actual: string | null
): boolean {
  if (anterior === undefined) return false
  if (actual === null) return false
  return anterior !== actual
}

/** Dos tonos descendentes. No hay archivo que se rompa en el deploy. */
function tocar(ctx: AudioContext): void {
  const ahora = ctx.currentTime
  const tonos = [880, 660]

  for (let i = 0; i < tonos.length; i++) {
    const osc = ctx.createOscillator()
    const vol = ctx.createGain()
    const t = ahora + i * 0.18

    osc.type = "sine"
    osc.frequency.value = tonos[i]
    vol.gain.setValueAtTime(0, t)
    vol.gain.linearRampToValueAtTime(0.35, t + 0.02)
    vol.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

    osc.connect(vol)
    vol.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  }
}

export function usarCampanilla(eventoIdActual: string | null | undefined) {
  const anterior = useRef<string | null | undefined>(undefined)
  const ctxRef = useRef<AudioContext | null>(null)
  const [bloqueado, setBloqueado] = useState(false)

  const contexto = useCallback((): AudioContext => {
    if (!ctxRef.current) ctxRef.current = new AudioContext()
    return ctxRef.current
  }, [])

  // Chrome deja el AudioContext suspendido hasta que haya un gesto, y en una TV
  // nadie hace clic nunca. Se resuelve al instalar, lanzando el navegador con
  // --autoplay-policy=no-user-gesture-required. Esto es la red de contencion:
  // si igual queda bloqueado, la pantalla lo dice en vez de quedar muda.
  const desbloquear = useCallback(() => {
    contexto()
      .resume()
      .then(() => setBloqueado(false))
      .catch(() => setBloqueado(true))
  }, [contexto])

  useEffect(() => {
    if (debeSonar(anterior.current, eventoIdActual ?? null)) {
      const ctx = contexto()
      if (ctx.state === "suspended") {
        ctx.resume().then(
          () => tocar(ctx),
          () => setBloqueado(true)
        )
      } else {
        tocar(ctx)
      }
    }
    anterior.current = eventoIdActual
  }, [eventoIdActual, contexto])

  return { bloqueado, desbloquear }
}
