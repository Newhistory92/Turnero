import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

async function tipearDni(page: any, dni: string) {
  for (const d of dni) await page.getByRole("button", { name: d, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto("/kiosco")
})

test("camino feliz: DNI conocido hasta el número de turno", async ({ page }) => {
  await tipearDni(page, "20123456")
  await expect(page.getByTestId("dni-visible")).toHaveText("20.123.456")
  await expect(page.getByTestId("saludo")).toContainText("Juan Pérez")

  await page.getByRole("button", { name: "Confirmar DNI" }).click()
  await expect(page.getByTestId("wizard")).toHaveAttribute("data-paso", "categoria")

  await page.getByText("Prácticas y Estudios").click()
  await expect(page.getByTestId("wizard")).toHaveAttribute("data-paso", "tramite")

  await page.getByText("Resonancia (RMN)").click()
  await expect(page.getByTestId("wizard")).toHaveAttribute("data-paso", "resultado")
  await expect(page.getByTestId("numero-turno")).toHaveText(/^RM\d{2}$/)
  await expect(page.getByTestId("banda-destino")).toContainText("Ala Norte")
})

test("un DNI desconocido no bloquea el flujo", async ({ page }) => {
  await tipearDni(page, "99999999")
  await expect(page.getByTestId("saludo")).toHaveCount(0)
  await page.getByRole("button", { name: "Confirmar DNI" }).click()
  await expect(page.getByTestId("wizard")).toHaveAttribute("data-paso", "categoria")
})

test("no se puede continuar con menos de 7 dígitos", async ({ page }) => {
  await tipearDni(page, "201")
  await expect(page.getByRole("button", { name: "Confirmar DNI" })).toBeDisabled()
})

test("Volver retrocede un paso por vez", async ({ page }) => {
  await tipearDni(page, "20123456")
  await page.getByRole("button", { name: "Confirmar DNI" }).click()
  await page.getByText("Afiliaciones").click()
  await page.getByRole("button", { name: /Volver/ }).click()
  await expect(page.getByTestId("wizard")).toHaveAttribute("data-paso", "categoria")
})

test("Empezar de nuevo borra el DNI tipeado", async ({ page }) => {
  await tipearDni(page, "20123456")
  await page.getByRole("button", { name: "Confirmar DNI" }).click()
  await page.getByRole("button", { name: /Empezar de nuevo/ }).click()
  await expect(page.getByTestId("wizard")).toHaveAttribute("data-paso", "dni")
  await expect(page.getByTestId("dni-visible")).toHaveText("—")
})

test("ninguna pantalla hace scroll horizontal ni vertical", async ({ page }) => {
  const desborda = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth > window.innerWidth,
    y: document.documentElement.scrollHeight > window.innerHeight,
  }))
  expect(desborda).toEqual({ x: false, y: false })
})

test("las cuatro pantallas pasan axe sin violaciones serias", async ({ page }) => {
  const revisar = async () => {
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
    expect(r.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([])
  }

  await revisar()
  await tipearDni(page, "20123456")
  await page.getByRole("button", { name: "Confirmar DNI" }).click()
  await revisar()
  await page.getByText("Servicio Social").click()
  await revisar()
  await page.getByText("DAI").click()
  await revisar()
})
