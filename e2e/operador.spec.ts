import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { createHmac } from "crypto"

const prisma = new PrismaClient()

// Mismo puerto que playwright.config.ts, que lo toma de PUERTO_E2E.
const BASE = `http://localhost:${Number(process.env.PUERTO_E2E ?? 3100)}`

function cookieDeSesion(sesionId: string) {
  const firma = createHmac("sha256", process.env.SESION_SECRETO!).update(sesionId).digest("hex")
  return { name: "turnero_sesion", value: `${sesionId}.${firma}`, url: BASE }
}

// El login valida contra la obra social, que en E2E no se toca. Se usa un
// empleado sembrado y se entra por la cookie, saltando la pantalla de login.
test.beforeEach(async () => {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
  await prisma.sesionOperador.deleteMany()
  await prisma.empleadoBox.deleteMany()
  await prisma.empleado.deleteMany()
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

test("el operador llama, inicia y finaliza un turno", async ({ page, context }) => {
  const box = await prisma.box.findFirstOrThrow()
  const empleado = await prisma.empleado.create({
    data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
  })
  await prisma.empleadoBox.create({ data: { empleadoId: empleado.id, boxId: box.id } })

  const tramite = await prisma.tramite.findFirstOrThrow({
    where: { boxes: { some: { boxId: box.id } } },
  })
  const hoy = new Date()
  await prisma.turno.create({
    data: {
      numero: "X01",
      fecha: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())),
      tramiteId: tramite.id,
      estado: "esperando",
      requestId: `e2e-${Date.now()}`,
    },
  })

  const sesion = await prisma.sesionOperador.create({
    data: { empleadoId: empleado.id, boxId: box.id },
  })

  await context.addCookies([cookieDeSesion(sesion.id)])

  await page.goto("/operador")

  await expect(page.getByTestId("total-cola")).toContainText("1 esperando")

  await page.getByTestId("llamar-siguiente").click()
  await expect(page.getByTestId("numero-activo")).toHaveText("X01")

  await page.getByTestId("iniciar").click()
  await expect(page.getByTestId("finalizar")).toBeVisible()

  await page.getByTestId("finalizar").click()
  await expect(page.getByTestId("llamar-siguiente")).toBeVisible()

  const turno = await prisma.turno.findFirstOrThrow({ where: { numero: "X01" } })
  expect(turno.estado).toBe("finalizado")
})

test("el desglose separa por trámite, no por categoría", async ({ page, context }) => {
  const box = await prisma.box.findFirstOrThrow()
  const empleado = await prisma.empleado.create({
    data: { dniInstitucional: "25319010", nombre: "Flores, Silvia", rol: "operador" },
  })
  await prisma.empleadoBox.create({ data: { empleadoId: empleado.id, boxId: box.id } })

  const tramites = await prisma.tramite.findMany({
    where: { boxes: { some: { boxId: box.id } } },
    take: 2,
  })
  test.skip(tramites.length < 2, "el box necesita al menos dos trámites")

  const hoy = new Date()
  const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  for (const [i, t] of tramites.entries()) {
    await prisma.turno.create({
      data: {
        numero: `Y0${i}`,
        fecha,
        tramiteId: t.id,
        estado: "esperando",
        requestId: `e2e-desglose-${i}-${Date.now()}`,
      },
    })
  }

  const sesion = await prisma.sesionOperador.create({
    data: { empleadoId: empleado.id, boxId: box.id },
  })
  await context.addCookies([cookieDeSesion(sesion.id)])

  await page.goto("/operador")
  await expect(page.getByTestId("total-cola")).toContainText("2 esperando")

  const desglose = page.getByTestId("desglose")
  for (const t of tramites) {
    await expect(desglose).toContainText(t.nombre)
  }
})
