import { createHmac, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/db"
import { leerConfig } from "@/lib/config"

export type ResultadoApertura =
  | { ok: true; sesionId: string }
  | {
      ok: false
      codigo: "BOX_OCUPADO" | "BOX_NO_ASIGNADO" | "ERROR_BASE"
      mensaje: string
      detalle?: string
    }

function vencimiento(): Date {
  return new Date(Date.now() - leerConfig().minutosSesionVencida * 60 * 1000)
}

export async function abrirSesion(
  empleadoId: string,
  boxId: string | null
): Promise<ResultadoApertura> {
  try {
    // Sin box no hay recurso fisico que ocupar: ni asignacion que verificar
    // ni exclusividad que imponer. Es la sesion del panel de administracion.
    if (boxId === null) {
      const sesion = await prisma.sesionOperador.create({
        data: { empleadoId, boxId: null },
      })
      return { ok: true, sesionId: sesion.id }
    }

    const asignado = await prisma.empleadoBox.findUnique({
      where: { empleadoId_boxId: { empleadoId, boxId } },
    })
    if (!asignado) {
      return {
        ok: false,
        codigo: "BOX_NO_ASIGNADO",
        mensaje: "No tenés ese box asignado",
      }
    }

    const abierta = await prisma.sesionOperador.findFirst({
      where: { boxId, fin: null },
      include: { empleado: true },
      orderBy: { inicio: "desc" },
    })

    if (abierta) {
      if (abierta.ultimoLatido > vencimiento()) {
        return {
          ok: false,
          codigo: "BOX_OCUPADO",
          mensaje: `Ese box tiene sesión abierta por ${abierta.empleado.nombre}`,
        }
      }
      // Latido vencido: alguien cerró el navegador sin desloguearse.
      // Se cierra sola, sin necesidad de que un supervisor intervenga.
      await prisma.sesionOperador.update({
        where: { id: abierta.id },
        data: { fin: new Date() },
      })
    }

    const sesion = await prisma.sesionOperador.create({ data: { empleadoId, boxId } })
    return { ok: true, sesionId: sesion.id }
  } catch (e) {
    return {
      ok: false,
      codigo: "ERROR_BASE",
      mensaje: "No se pudo abrir la sesión",
      detalle: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function cerrarSesion(sesionId: string): Promise<void> {
  await prisma.sesionOperador.updateMany({
    where: { id: sesionId, fin: null },
    data: { fin: new Date() },
  })
}

export async function sesionActiva(
  sesionId: string
): Promise<{ id: string; empleadoId: string; boxId: string | null } | null> {
  const s = await prisma.sesionOperador.findFirst({
    where: { id: sesionId, fin: null },
  })
  return s ? { id: s.id, empleadoId: s.empleadoId, boxId: s.boxId } : null
}

export async function renovarLatido(sesionId: string): Promise<void> {
  await prisma.sesionOperador.updateMany({
    where: { id: sesionId, fin: null },
    data: { ultimoLatido: new Date() },
  })
}

export const NOMBRE_COOKIE = "turnero_sesion"

function firma(valor: string): string {
  return createHmac("sha256", leerConfig().sesionSecreto()).update(valor).digest("hex")
}

export function firmarCookie(sesionId: string): string {
  return `${sesionId}.${firma(sesionId)}`
}

export function leerCookie(valor: string | undefined): string | null {
  if (!valor) return null
  const corte = valor.lastIndexOf(".")
  if (corte <= 0) return null

  const sesionId = valor.slice(0, corte)
  const recibida = Buffer.from(valor.slice(corte + 1))
  const esperada = Buffer.from(firma(sesionId))

  // Comparación de tiempo constante: un === filtraría el secreto por timing.
  if (recibida.length !== esperada.length) return null
  return timingSafeEqual(recibida, esperada) ? sesionId : null
}
