import type { ErrorCampo } from "./validaciones"

/**
 * Vive fuera de acciones.ts porque un modulo con "use server" solo puede
 * exportar funciones asincronas: exportar esta constante desde ahi rompe el
 * build de Next.
 */
export interface EstadoFormulario {
  errores: ErrorCampo[]
  guardado: boolean
}

export const ESTADO_INICIAL: EstadoFormulario = { errores: [], guardado: false }
