import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

test.beforeEach(async () => {
  await prisma.turnoEvento.deleteMany()
  await prisma.turno.deleteMany()
  await prisma.contador.deleteMany()
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

function hoyFecha(): Date {
  const a = new Date()
  return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()))
}

async function llamarEn(alaNombre: string, numero: string, nombreAfiliado: string) {
  const box = await prisma.box.findFirstOrThrow({
    where: { ala: { nombre: alaNombre } },
    include: { ala: true },
  })
  const bt = await prisma.boxTramite.findFirstOrThrow({ where: { boxId: box.id } })

  const turno = await prisma.turno.create({
    data: {
      numero,
      fecha: hoyFecha(),
      tramiteId: bt.tramiteId,
      estado: "llamado",
      boxId: box.id,
      nombreAfiliado,
      requestId: `e2e-pantalla-${numero}-${Date.now()}`,
    },
  })
  await prisma.turnoEvento.create({
    data: { turnoId: turno.id, tipo: "llamado", boxId: box.id },
  })
  return box
}

test("la pantalla del ala muestra el llamado con número, nombre y box", async ({ page }) => {
  const box = await llamarEn("Norte", "N01", "González, María")

  await page.goto("/pantalla/norte")

  await expect(page.getByText("N01")).toBeVisible()
  await expect(page.getByText("González, María")).toBeVisible()
  await expect(page.getByText(box.nombre, { exact: true })).toBeVisible()
})

// La asercion que importa es la negativa: la positiva sola pasaria igual si el
// servidor emitiera a todas las pantallas.
test("un llamado del Norte no aparece en la pantalla del Sur", async ({ page }) => {
  const hayDosAlas = await prisma.ala.count()
  test.skip(hayDosAlas < 2, "hacen falta dos alas")

  await llamarEn("Norte", "N02", "Pérez, Juan")

  await page.goto("/pantalla/sur")

  await expect(page.getByText("N02")).toHaveCount(0)
  await expect(page.getByText("Pérez, Juan")).toHaveCount(0)
})

test("la pantalla no expone el trámite", async ({ page }) => {
  const box = await llamarEn("Norte", "N03", "López, Ana")
  const bt = await prisma.boxTramite.findFirstOrThrow({
    where: { boxId: box.id },
    include: { tramite: true },
  })

  await page.goto("/pantalla/norte")
  await expect(page.getByText("N03")).toBeVisible()

  await expect(page.getByText(bt.tramite.nombre)).toHaveCount(0)
})

test("un ala inexistente devuelve 404", async ({ page }) => {
  const r = await page.goto("/pantalla/oeste")
  expect(r?.status()).toBe(404)
})
