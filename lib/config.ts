function entero(valor: string | undefined, porDefecto: number): number {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : porDefecto
}

export interface Config {
  minutosSesionVencida: number
  horaCierreDiario: string
  retencionDniDias: number
  sesionSecreto: () => string
}

export function leerConfig(): Config {
  return {
    minutosSesionVencida: entero(process.env.MINUTOS_SESION_VENCIDA, 15),
    horaCierreDiario: process.env.HORA_CIERRE_DIARIO ?? "23:00",
    retencionDniDias: entero(process.env.RETENCION_DNI_DIAS, 90),
    // Se lee tarde y explota: firmar cookies con un secreto por defecto es
    // peor que no arrancar, porque nadie se entera hasta que es tarde.
    sesionSecreto: () => {
      const s = process.env.SESION_SECRETO
      if (!s) throw new Error("Falta SESION_SECRETO: la cookie de sesión no se puede firmar")
      return s
    },
  }
}
