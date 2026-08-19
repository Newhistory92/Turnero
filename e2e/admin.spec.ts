import { test, expect } from "@playwright/test"

// Sin sesion, /admin no existe para el visitante: el guard redirige antes de
// renderizar nada. Es la unica parte del panel que se puede probar sin
// credenciales institucionales reales.
test("el panel rebota a quien no tiene sesión", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/operador\/login/)
})

test("las rutas internas del panel también rebotan", async ({ page }) => {
  await page.goto("/admin/catalogo/tramites")
  await expect(page).toHaveURL(/\/operador\/login/)
})

test("el login ofrece usuario y contraseña antes que cualquier destino", async ({ page }) => {
  await page.goto("/operador/login")
  await expect(page.getByLabel("Usuario")).toBeVisible()
  await expect(page.getByLabel("Contraseña")).toBeVisible()
  // El selector de destino aparece recien despues de validar credenciales.
  await expect(page.getByLabel("Dónde entrar")).toHaveCount(0)
})
