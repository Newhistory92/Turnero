import { describe, it, expect } from "vitest"
import {
  calcularDuraciones,
  clasificar,
  SEGUNDOS_ANOMALIA,
  type EventoDuracion,
} from "@/lib/estadisticas/duraciones"

function ev(tipo: EventoDuracion["tipo"], hhmmss: string): EventoDuracion {
  return { tipo, timestamp: new Date(`2026-08-19T${hhmmss}-03:00`) }
}

const UMBRAL = 5 // minutos -> 300 segundos

describe("clasificar", () => {
  it("bajo 30 segundos es anomalía", () => {
    expect(clasificar(0, UMBRAL)).toBe("anomalia")
    expect(clasificar(29, UMBRAL)).toBe("anomalia")
  })

  // El borde exacto de 30 s ya no es anomalia: el umbral de anomalia es
  // "menos de 30", no "hasta 30".
  it("30 segundos exactos ya es breve", () => {
    expect(clasificar(SEGUNDOS_ANOMALIA, UMBRAL)).toBe("breve")
  })

  it("bajo el umbral del trámite es breve", () => {
    expect(clasificar(299, UMBRAL)).toBe("breve")
  })

  // El umbral exacto cuenta como valida: duracionMinimaEsperada es el minimo
  // esperado, no el primero que se descarta.
  it("el umbral exacto ya es válida", () => {
    expect(clasificar(300, UMBRAL)).toBe("valida")
    expect(clasificar(1200, UMBRAL)).toBe("valida")
  })
})

describe("calcularDuraciones", () => {
  it("mide espera y atención de un turno completo", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("iniciado", "10:06:00"),
        ev("finalizado", "10:20:00"),
      ],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
    expect(r.esperaEnCurso).toBe(false)
    expect(r.atencionSegundos).toBe(840)
    expect(r.clasificacion).toBe("valida")
  })

  // La espera se mide contra el PRIMER llamado: si no respondio y lo
  // llamaron de nuevo, la espera real termino en el primero.
  it("usa el primer llamado, no el rellamado", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("ausente", "10:06:00"),
        ev("llamado", "10:30:00"),
        ev("iniciado", "10:31:00"),
        ev("finalizado", "10:45:00"),
      ],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
  })

  // La maquina de estados permite derivar desde "llamado" sin pasar por
  // "iniciado": ese turno es una derivacion, no una atencion.
  it("un turno derivado sin iniciar no aporta tiempo de atención", () => {
    const r = calcularDuraciones(
      [ev("generado", "10:00:00"), ev("llamado", "10:05:00"), ev("derivado", "10:07:00")],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
    expect(r.atencionSegundos).toBeNull()
    expect(r.clasificacion).toBeNull()
  })

  it("la derivación cierra la atención igual que finalizar", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("iniciado", "10:06:00"),
        ev("derivado", "10:16:00"),
      ],
      UMBRAL
    )
    expect(r.atencionSegundos).toBe(600)
    expect(r.clasificacion).toBe("valida")
  })

  it("marca la anomalía de una atención de segundos", () => {
    const r = calcularDuraciones(
      [
        ev("generado", "10:00:00"),
        ev("llamado", "10:05:00"),
        ev("iniciado", "10:06:00"),
        ev("finalizado", "10:06:20"),
      ],
      UMBRAL
    )
    expect(r.atencionSegundos).toBe(20)
    expect(r.clasificacion).toBe("anomalia")
  })

  it("un turno que sigue esperando tiene la espera abierta", () => {
    const ahora = new Date("2026-08-19T10:10:00-03:00")
    const r = calcularDuraciones([ev("generado", "10:00:00")], UMBRAL, ahora)
    expect(r.esperaSegundos).toBe(600)
    expect(r.esperaEnCurso).toBe(true)
    expect(r.atencionSegundos).toBeNull()
  })

  // Un abandonado nunca fue llamado, pero su espera SI termino: medirla
  // contra "ahora" la haria crecer para siempre.
  it("el abandonado cierra la espera en el abandono", () => {
    const ahora = new Date("2026-08-19T23:00:00-03:00")
    const r = calcularDuraciones(
      [ev("generado", "10:00:00"), ev("abandonado", "14:00:00")],
      UMBRAL,
      ahora
    )
    expect(r.esperaSegundos).toBe(4 * 3600)
    expect(r.esperaEnCurso).toBe(false)
  })

  it("tolera eventos desordenados", () => {
    const r = calcularDuraciones(
      [
        ev("finalizado", "10:20:00"),
        ev("generado", "10:00:00"),
        ev("iniciado", "10:06:00"),
        ev("llamado", "10:05:00"),
      ],
      UMBRAL
    )
    expect(r.esperaSegundos).toBe(300)
    expect(r.atencionSegundos).toBe(840)
  })

  // Sin evento generado no hay contra que medir. Devolver 0 mentiria.
  it("sin evento generado no inventa una espera", () => {
    const r = calcularDuraciones([ev("llamado", "10:05:00")], UMBRAL)
    expect(r.esperaSegundos).toBeNull()
    expect(r.esperaEnCurso).toBe(false)
  })

  it("una lista vacía no rompe", () => {
    const r = calcularDuraciones([], UMBRAL)
    expect(r).toEqual({
      esperaSegundos: null,
      esperaEnCurso: false,
      atencionSegundos: null,
      clasificacion: null,
    })
  })
})
