import { leerConfig } from "@/lib/config"
import { marcarAbandonados } from "./abandonados"
import { borrarDniVencidos } from "./retencionDni"

function msHastaLaHora(hhmm: string, ahora: Date): number {
  const [h, m] = hhmm.split(":").map(Number)
  const objetivo = new Date(ahora)
  objetivo.setHours(h, m, 0, 0)
  if (objetivo <= ahora) objetivo.setDate(objetivo.getDate() + 1)
  return objetivo.getTime() - ahora.getTime()
}

async function correr(): Promise<void> {
  try {
    const a = await marcarAbandonados()
    const d = await borrarDniVencidos()
    console.log(
      `[jobs] abandonados=${a.abandonados} huérfanos=${a.huerfanos} dni-borrados=${d.borrados}`
    )
  } catch (e) {
    console.error("[jobs] fallaron:", e instanceof Error ? e.message : e)
  }
}

/** Devuelve la funcion para detenerlos. */
export function programarJobs(): () => void {
  const { horaCierreDiario } = leerConfig()
  let diario: ReturnType<typeof setInterval> | null = null

  const primero = setTimeout(() => {
    void correr()
    diario = setInterval(() => void correr(), 24 * 60 * 60 * 1000)
  }, msHastaLaHora(horaCierreDiario, new Date()))

  return () => {
    clearTimeout(primero)
    if (diario) clearInterval(diario)
  }
}
