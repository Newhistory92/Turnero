"use client"

import { useEffect, useState } from "react"

const EVENTOS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const

// 5 minutos de inactividad
const MS_INACTIVIDAD = 5 * 60 * 1000

export function usarProtectorPantalla(ms = MS_INACTIVIDAD) {
  const [bloqueado, setBloqueado] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    const reiniciar = () => {
      setBloqueado(false)
      clearTimeout(timer)
      timer = setTimeout(() => setBloqueado(true), ms)
    }

    reiniciar()
    for (const e of EVENTOS) window.addEventListener(e, reiniciar, { passive: true })

    return () => {
      clearTimeout(timer)
      for (const e of EVENTOS) window.removeEventListener(e, reiniciar)
    }
  }, [ms])

  return bloqueado
}
