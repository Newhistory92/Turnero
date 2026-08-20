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

// La exportacion es la puerta de atras clasica: si la pantalla filtra y el
// endpoint no, el filtro de la pantalla no vale nada. Sin sesion tampoco
// tiene que devolver el archivo.
test("la exportación rebota a quien no tiene sesión", async ({ page }) => {
  const respuesta = await page.goto("/tablero/exportar")
  expect(respuesta?.status()).toBe(401)
})
