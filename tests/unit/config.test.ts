import { describe, it, expect, afterEach } from "vitest"
import { leerConfig } from "@/lib/config"

const originales = { ...process.env }
afterEach(() => {
  process.env = { ...originales }
})

describe("configuración de SP2", () => {
  it("usa los valores por defecto cuando no hay variables", () => {
    delete process.env.MINUTOS_SESION_VENCIDA
    delete process.env.HORA_CIERRE_DIARIO
    delete process.env.RETENCION_DNI_DIAS
    const c = leerConfig()
    expect(c.minutosSesionVencida).toBe(15)
    expect(c.horaCierreDiario).toBe("23:00")
    expect(c.retencionDniDias).toBe(90)
  })

  it("respeta los valores del entorno", () => {
    process.env.MINUTOS_SESION_VENCIDA = "5"
    process.env.RETENCION_DNI_DIAS = "30"
    const c = leerConfig()
    expect(c.minutosSesionVencida).toBe(5)
    expect(c.retencionDniDias).toBe(30)
  })

  it("ignora valores no numéricos y cae al default", () => {
    process.env.MINUTOS_SESION_VENCIDA = "quince"
    expect(leerConfig().minutosSesionVencida).toBe(15)
  })

  it("sesionSecreto explota si falta la variable, en vez de firmar con un default", () => {
    delete process.env.SESION_SECRETO
    expect(() => leerConfig().sesionSecreto()).toThrow(/SESION_SECRETO/)
  })
})
