import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import { obtenerCatalogo, invalidarCatalogo } from "@/lib/catalogo"
import { guardarTramite, cambiarActivo, borrar } from "@/lib/admin/mutaciones"
import type { Actor } from "@/lib/admin/acceso"

const ADMIN: Actor = { empleadoId: "x", nombre: "Admin", rol: "admin" }
const SUPERVISOR: Actor = { empleadoId: "y", nombre: "Super", rol: "supervisor" }
const OPERADOR: Actor = { empleadoId: "z", nombre: "Opé", rol: "operador" }

async function datosBase() {
  const cat = await prisma.categoria.findFirstOrThrow()
  const ala = await prisma.ala.findFirstOrThrow()
  const piso = await prisma.piso.findFirstOrThrow()
  return {
    id: null as string | null,
    categoriaId: cat.id,
    nombre: "Trámite de prueba",
    subtitulo: "Sub",
    icono: "Activity",
    prefijo: "ZZZ",
    destinoAlaId: ala.id,
    destinoPisoId: piso.id,
    horaApertura: "08:00",
    horaCierre: "14:00",
    diasSemana: "12345",
    duracionMinimaEsperada: 5,
    orden: 90,
    boxIds: [] as string[],
  }
}

async function limpiar() {
  await prisma.boxTramite.deleteMany({ where: { tramite: { prefijo: "ZZZ" } } })
  await prisma.tramite.deleteMany({ where: { prefijo: "ZZZ" } })
}

describe("mutaciones del catálogo", () => {
  beforeEach(async () => {
    await limpiar()
    invalidarCatalogo()
  })
  afterAll(async () => {
    await limpiar()
    await prisma.$disconnect()
  })

  // ESTA ES LA PRUEBA QUE MAS IMPORTA. Un test que solo verifique que el
  // boton se ve deshabilitado pasaria igual con la autorizacion rota.
  it("un supervisor no puede escribir", async () => {
    const r = await guardarTramite(SUPERVISOR, await datosBase())
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores[0].campo).toBe("rol")
    expect(await prisma.tramite.count({ where: { prefijo: "ZZZ" } })).toBe(0)
  })

  it("un operador tampoco", async () => {
    const r = await guardarTramite(OPERADOR, await datosBase())
    expect(r.ok).toBe(false)
    expect(await prisma.tramite.count({ where: { prefijo: "ZZZ" } })).toBe(0)
  })

  it("un admin crea el trámite", async () => {
    const r = await guardarTramite(ADMIN, await datosBase())
    expect(r.ok).toBe(true)
    expect(await prisma.tramite.count({ where: { prefijo: "ZZZ" } })).toBe(1)
  })

  it("rechaza un prefijo ya tomado por otro trámite activo", async () => {
    const otro = await prisma.tramite.findFirstOrThrow({ where: { activo: true } })
    const datos = { ...(await datosBase()), prefijo: otro.prefijo }
    const r = await guardarTramite(ADMIN, datos)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores.some((e) => e.campo === "prefijo")).toBe(true)
  })

  it("rechaza una franja invertida", async () => {
    const datos = { ...(await datosBase()), horaApertura: "14:00", horaCierre: "08:00" }
    const r = await guardarTramite(ADMIN, datos)
    expect(r.ok).toBe(false)
  })

  it("guardar invalida el caché", async () => {
    const antes = await obtenerCatalogo()
    const cuantosAntes = antes.tramites.length

    const r = await guardarTramite(ADMIN, await datosBase())
    expect(r.ok).toBe(true)

    const despues = await obtenerCatalogo()
    expect(despues.tramites.length).toBe(cuantosAntes + 1)
  })

  it("la baja lógica saca el trámite del catálogo", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })

    const r = await cambiarActivo(ADMIN, "tramite", t.id, false)
    expect(r.ok).toBe(true)

    const cat = await obtenerCatalogo()
    expect(cat.tramites.some((x) => x.id === t.id)).toBe(false)
    // Pero la fila sigue: los turnos historicos resuelven su nombre.
    expect(await prisma.tramite.findUnique({ where: { id: t.id } })).not.toBeNull()
  })

  it("reactivar con el prefijo ya tomado se rechaza", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })
    await cambiarActivo(ADMIN, "tramite", t.id, false)

    // Otro tramite se queda con ZZZ mientras el primero esta de baja.
    const datos = { ...(await datosBase()), nombre: "Otro" }
    expect((await guardarTramite(ADMIN, datos)).ok).toBe(true)

    const r = await cambiarActivo(ADMIN, "tramite", t.id, true)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores.some((e) => e.campo === "prefijo")).toBe(true)
  })

  it("borra de verdad un trámite sin historia", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })

    const r = await borrar(ADMIN, "tramite", t.id)
    expect(r.ok).toBe(true)
    expect(await prisma.tramite.findUnique({ where: { id: t.id } })).toBeNull()
  })

  it("rechaza borrar un trámite con turnos", async () => {
    const conTurnos = await prisma.turno.findFirstOrThrow()
    const r = await borrar(ADMIN, "tramite", conTurnos.tramiteId)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error("no debía dejarlo")
    expect(r.errores[0].campo).toBe("referencias")
  })

  it("un supervisor no puede borrar", async () => {
    await guardarTramite(ADMIN, await datosBase())
    const t = await prisma.tramite.findFirstOrThrow({ where: { prefijo: "ZZZ" } })

    const r = await borrar(SUPERVISOR, "tramite", t.id)
    expect(r.ok).toBe(false)
    expect(await prisma.tramite.findUnique({ where: { id: t.id } })).not.toBeNull()
  })
})
