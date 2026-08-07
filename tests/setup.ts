import { config } from "dotenv"

// Los tests leen .env.test.local, nunca .env.local.
config({ path: ".env.test.local", override: true })

const url = process.env.DATABASE_URL ?? ""
const base = /database=([^;]+)/i.exec(url)?.[1] ?? ""

if (url && !base.endsWith("_Test")) {
  throw new Error(
    `Los tests borran datos y solo pueden correr contra una base terminada en "_Test".\n` +
      `DATABASE_URL apunta a: "${base || "(sin database= en la cadena)"}"\n` +
      `Revisá .env.test.local antes de volver a correr.`
  )
}
