import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "@/lib/db"
import {
  abrirSesion, cerrarSesion, sesionActiva, renovarLatido,
  firmarCookie, leerCookie,
} from "@/lib/auth/sesion"

async function escenario() {
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()

  const box = await prisma.box.findFirstOrThrow()
  const otroBox = await prisma.box.findFirstOrThrow({ where: { id: { not: box.id } } })
  const ana = await prisma.empleado.create({
    data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
  })
  const beto = await prisma.empleado.create({
    data: { dniInstitucional: "32878228", nombre: "Tello, Gonzalo", rol: "operador" },
  })
  await prisma.empleadoBox.create({ data: { empleadoId: ana.id, boxId: box.id } })
  await prisma.empleadoBox.create({ data: { empleadoId: beto.id, boxId: box.id } })
  return { box, otroBox, ana, beto }
}

describe("sesión de operador", () => {
  let ctx: Awaited<ReturnType<typeof escenario>>
  beforeEach(async () => { ctx = await escenario() })

  it("abre la sesión y la deja activa", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.box.id)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const s = await sesionActiva(r.sesionId)
      expect(s?.boxId).toBe(ctx.box.id)
      expect(s?.empleadoId).toBe(ctx.ana.id)
    }
  })

  it("rechaza un box que no tiene asignado", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.otroBox.id)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.codigo).toBe("BOX_NO_ASIGNADO")
  })

  it("rechaza el box si otro lo tiene con latido fresco", async () => {
    await abrirSesion(ctx.ana.id, ctx.box.id)
    const r = await abrirSesion(ctx.beto.id, ctx.box.id)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.codigo).toBe("BOX_OCUPADO")
      expect(r.mensaje).toContain("Flores")
    }
  })

  it("toma el box si el latido está vencido, y cierra la sesión colgada", async () => {
    const vieja = await abrirSesion(ctx.ana.id, ctx.box.id)
    if (!vieja.ok) throw new Error("debería haber abierto")

    const hace30 = new Date(Date.now() - 30 * 60 * 1000)
    await prisma.sesionOperador.update({
      where: { id: vieja.sesionId },
      data: { ultimoLatido: hace30 },
    })

    const nueva = await abrirSesion(ctx.beto.id, ctx.box.id)
    expect(nueva.ok).toBe(true)
    expect(await sesionActiva(vieja.sesionId)).toBeNull()
  })

  it("la sesión cerrada deja de estar activa", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.box.id)
    if (!r.ok) throw new Error("debería haber abierto")
    await cerrarSesion(r.sesionId)
    expect(await sesionActiva(r.sesionId)).toBeNull()
  })

  it("el latido corre el vencimiento", async () => {
    const r = await abrirSesion(ctx.ana.id, ctx.box.id)
    if (!r.ok) throw new Error("debería haber abierto")
    const hace30 = new Date(Date.now() - 30 * 60 * 1000)
    await prisma.sesionOperador.update({ where: { id: r.sesionId }, data: { ultimoLatido: hace30 } })

    await renovarLatido(r.sesionId)

    const bloqueada = await abrirSesion(ctx.beto.id, ctx.box.id)
    expect(bloqueada.ok).toBe(false)
  })

  it("la cookie firmada se lee de vuelta", () => {
    expect(leerCookie(firmarCookie("abc-123"))).toBe("abc-123")
  })

  it("una cookie manipulada no se acepta", () => {
    const firmada = firmarCookie("abc-123")
    expect(leerCookie(firmada.replace("abc-123", "otro-id"))).toBeNull()
    expect(leerCookie("basura")).toBeNull()
    expect(leerCookie(undefined)).toBeNull()
  })
})
