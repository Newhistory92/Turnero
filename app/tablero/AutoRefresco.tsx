"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const SEGUNDOS = 45

/**
 * La vista Hoy se mira para decidir en el momento, asi que no puede quedar
 * congelada. router.refresh() vuelve a correr el Server Component y React
 * reconcilia: no hace falta emitir nada por el socket para un caso que
 * tolera 45 segundos de retraso.
 */
export function AutoRefresco() {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), SEGUNDOS * 1000)
    return () => clearInterval(id)
  }, [router])

  return null
}
