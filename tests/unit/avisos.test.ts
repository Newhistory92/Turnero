import { describe, it, expect } from "vitest"
import { avisoDestino } from "@/lib/admin/avisos"

describe("avisoDestino", () => {
  it("no avisa si todos los boxes están en el ala del destino", () => {
    expect(avisoDestino("Norte", ["Norte", "Norte"])).toBeNull()
  })

  // La redundancia entre destinoAla y el ala de los boxes es deliberada: el
  // ticket tiene que decir adonde ir aunque el tramite se quede sin boxes.
  // Por eso es aviso y no error, y por eso sin boxes no se avisa nada.
  it("no avisa si el trámite no tiene boxes", () => {
    expect(avisoDestino("Norte", [])).toBeNull()
  })

  it("avisa si algún box está en otra ala", () => {
    const a = avisoDestino("Norte", ["Norte", "Sur"])
    expect(a).not.toBeNull()
    expect(a).toContain("Sur")
  })

  it("avisa si todos los boxes están en otra ala", () => {
    expect(avisoDestino("Norte", ["Sur"])).not.toBeNull()
  })

  it("no repite el ala en el mensaje", () => {
    const a = avisoDestino("Norte", ["Sur", "Sur", "Sur"])
    expect(a?.match(/Sur/g)?.length).toBe(1)
  })
})
