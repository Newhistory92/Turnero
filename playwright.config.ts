import { defineConfig, devices } from "@playwright/test"

// El totem corre en el 3000, pero en la maquina de desarrollo ese puerto suele
// estar ocupado por otra cosa. PUERTO_E2E permite correr la suite al lado sin
// pelearse por el puerto ni matar el server de nadie.
const puerto = Number(process.env.PUERTO_E2E ?? 3100)
const base = `http://localhost:${puerto}`

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: base,
    // La resolucion real del totem. No es un detalle: el layout depende de ella.
    viewport: { width: 1920, height: 1080 },
  },
  projects: [{ name: "kiosco", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev`,
    env: { PORT: String(puerto) },
    url: `${base}/kiosco`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
