import { test, expect } from "@playwright/test"

// Igual que el resto de /admin, la pantalla de usuarios no existe para quien
// no tiene sesion. Es lo unico que se puede probar sin credenciales
// institucionales reales.
test("la pantalla de usuarios rebota a quien no tiene sesión", async ({ page }) => {
  await page.goto("/admin/usuarios")
  await expect(page).toHaveURL(/\/operador\/login/)
})
