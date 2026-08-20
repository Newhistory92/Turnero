import { test, expect } from "@playwright/test"

// Igual que /admin, el tablero no existe para quien no tiene sesion: el
// guard del layout redirige antes de renderizar nada. Es lo unico que se
// puede probar sin credenciales institucionales reales.
test("el tablero rebota a quien no tiene sesión", async ({ page }) => {
  await page.goto("/tablero")
  await expect(page).toHaveURL(/\/operador\/login/)
})

test("el histórico también rebota", async ({ page }) => {
  await page.goto("/tablero/historico")
  await expect(page).toHaveURL(/\/operador\/login/)
})
