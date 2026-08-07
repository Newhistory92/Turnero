export const SEGUNDOS_AVISO = 45
export const SEGUNDOS_GRACIA = 15

interface Opciones {
  onAviso: () => void
  onExpirar: () => void
}

export function crearTemporizadorInactividad({ onAviso, onExpirar }: Opciones) {
  let aviso: ReturnType<typeof setTimeout> | null = null
  let expiracion: ReturnType<typeof setTimeout> | null = null

  function detener() {
    if (aviso) clearTimeout(aviso)
    if (expiracion) clearTimeout(expiracion)
    aviso = null
    expiracion = null
  }

  function iniciar() {
    detener()
    aviso = setTimeout(onAviso, SEGUNDOS_AVISO * 1000)
    expiracion = setTimeout(onExpirar, (SEGUNDOS_AVISO + SEGUNDOS_GRACIA) * 1000)
  }

  return { iniciar, detener, registrarActividad: iniciar }
}
