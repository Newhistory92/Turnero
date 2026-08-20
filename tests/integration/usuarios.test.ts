import { describe, it, expect, beforeEach, afterAll } from "vitest"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/admin/acceso"
import { listarUsuarios, guardarUsuario } from "@/lib/admin/usuarios"

const DNI_PRUEBA = "99999811"
const DNI_ACTOR = "99999812"

const SUPERVISOR: Actor = { empleadoId: "y", nombre: "Super", rol: "supervisor" }

async function limpiar() {
  await prisma.empleadoBox.deleteMany({
    where: { empleado: { dniInstitucional: { in: [DNI_PRUEBA, DNI_ACTOR] } } },
  })
  await prisma.empleado.deleteMany({
    where: { dniInstitucional: { in: [DNI_PRUEBA, DNI_ACTOR] } },
  })
}

async function crearEmpleado(dni: string, rol = "operador") {
  return prisma.empleado.create({
    data: { dniInstitucional: dni, nombre: `Prueba ${dni}`, rol },
  })
}

/** Un Actor admin cuyo empleadoId es real, para probar el guard de la propia fila. */
async function crearActorAdmin(): Promise<Actor> {
  const e = await crearEmpleado(DNI_ACTOR, "admin")
  return { empleadoId: e.id, nombre: e.nombre, rol: "admin" }
}

describe("listarUsuarios", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("incluye a los inactivos, para que se los pueda reactivar", async () => {
    await prisma.empleado.create({
      data: { dniInstitucional: DNI_PRUEBA, nombre: "Baja", rol: "operador", activo: false },
    })

    const filas = await listarUsuarios()
    expect(filas.find((f) => f.dniInstitucional === DNI_PRUEBA)?.activo).toBe(false)
  })

  it("trae los boxes asignados de cada empleado", async () => {
    const emp = await crearEmpleado(DNI_PRUEBA)
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })
    await prisma.empleadoBox.create({ data: { empleadoId: emp.id, boxId: box.id } })

    const filas = await listarUsuarios()
    expect(filas.find((f) => f.id === emp.id)?.boxIds).toEqual([box.id])
  })
})

describe("guardarUsuario", () => {
  beforeEach(limpiar)
  afterAll(limpiar)

  it("el admin cambia el rol, el estado y los boxes", async () => {
    const actor = await crearActorAdmin()
    const emp = await crearEmpleado(DNI_PRUEBA)
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })

    const r = await guardarUsuario(actor, {
      empleadoId: emp.id,
      rol: "supervisor",
      activo: false,
      boxIds: [box.id],
    })
    expect(r.ok).toBe(true)

    const guardado = await prisma.empleado.findUniqueOrThrow({ where: { id: emp.id } })
    expect(guardado.rol).toBe("supervisor")
    expect(guardado.activo).toBe(false)

    const asignados = await prisma.empleadoBox.findMany({ where: { empleadoId: emp.id } })
    expect(asignados.map((a) => a.boxId)).toEqual([box.id])
  })

  it("una lista de boxes vacia deja al empleado sin ninguno", async () => {
    const actor = await crearActorAdmin()
    const emp = await crearEmpleado(DNI_PRUEBA)
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })
    await prisma.empleadoBox.create({ data: { empleadoId: emp.id, boxId: box.id } })

    const r = await guardarUsuario(actor, {
      empleadoId: emp.id,
      rol: "operador",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(true)

    const asignados = await prisma.empleadoBox.findMany({ where: { empleadoId: emp.id } })
    expect(asignados).toEqual([])
  })

  it("un supervisor no puede editar usuarios", async () => {
    const emp = await crearEmpleado(DNI_PRUEBA)

    const r = await guardarUsuario(SUPERVISOR, {
      empleadoId: emp.id,
      rol: "admin",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(false)

    const sinCambios = await prisma.empleado.findUniqueOrThrow({ where: { id: emp.id } })
    expect(sinCambios.rol).toBe("operador")
  })

  it("rechaza un rol que no esta en el vocabulario", async () => {
    const actor = await crearActorAdmin()
    const emp = await crearEmpleado(DNI_PRUEBA)

    const r = await guardarUsuario(actor, {
      empleadoId: emp.id,
      rol: "jefe",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(false)

    const sinCambios = await prisma.empleado.findUniqueOrThrow({ where: { id: emp.id } })
    expect(sinCambios.rol).toBe("operador")
  })

  it("rechaza a un empleado que ya no existe", async () => {
    const actor = await crearActorAdmin()

    const r = await guardarUsuario(actor, {
      empleadoId: "no-existe",
      rol: "operador",
      activo: true,
      boxIds: [],
    })
    expect(r.ok).toBe(false)
  })

  it("sobre la propia fila descarta el rol y el estado, pero guarda los boxes", async () => {
    const actor = await crearActorAdmin()
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })

    const r = await guardarUsuario(actor, {
      empleadoId: actor.empleadoId,
      rol: "operador",
      activo: false,
      boxIds: [box.id],
    })
    expect(r.ok).toBe(true)

    const yo = await prisma.empleado.findUniqueOrThrow({ where: { id: actor.empleadoId } })
    expect(yo.rol).toBe("admin")
    expect(yo.activo).toBe(true)

    const asignados = await prisma.empleadoBox.findMany({ where: { empleadoId: actor.empleadoId } })
    expect(asignados.map((a) => a.boxId)).toEqual([box.id])
  })

  it("sobre la propia fila un rol invalido no impide guardar los boxes", async () => {
    // El guard de la propia fila corre antes que la validacion de rol: si
    // corriera despues, un formulario manipulado bloquearia una edicion
    // legitima de boxes.
    const actor = await crearActorAdmin()
    const box = await prisma.box.findFirstOrThrow({ orderBy: { numero: "asc" } })

    const r = await guardarUsuario(actor, {
      empleadoId: actor.empleadoId,
      rol: "jefe",
      activo: true,
      boxIds: [box.id],
    })
    expect(r.ok).toBe(true)

    const yo = await prisma.empleado.findUniqueOrThrow({ where: { id: actor.empleadoId } })
    expect(yo.rol).toBe("admin")
  })
})
