import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { crearTemporizadorInactividad, SEGUNDOS_AVISO, SEGUNDOS_GRACIA } from "@/lib/kiosco/inactividad"

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("temporizador de inactividad", () => {
  it("avisa a los 45 segundos", () => {
    const avisar = vi.fn()
    const t = crearTemporizadorInactividad({ onAviso: avisar, onExpirar: vi.fn() })
    t.iniciar()
    vi.advanceTimersByTime(SEGUNDOS_AVISO * 1000 - 100)
    expect(avisar).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(avisar).toHaveBeenCalledOnce()
  })

  it("expira 15 segundos después del aviso", () => {
    const expirar = vi.fn()
    const t = crearTemporizadorInactividad({ onAviso: vi.fn(), onExpirar: expirar })
    t.iniciar()
    vi.advanceTimersByTime((SEGUNDOS_AVISO + SEGUNDOS_GRACIA) * 1000 + 100)
    expect(expirar).toHaveBeenCalledOnce()
  })

  it("cualquier actividad reinicia la cuenta", () => {
    const avisar = vi.fn()
    const t = crearTemporizadorInactividad({ onAviso: avisar, onExpirar: vi.fn() })
    t.iniciar()
    vi.advanceTimersByTime(40_000)
    t.registrarActividad()
    vi.advanceTimersByTime(40_000)
    expect(avisar).not.toHaveBeenCalled()
  })

  it("detener cancela todo", () => {
    const avisar = vi.fn()
    const expirar = vi.fn()
    const t = crearTemporizadorInactividad({ onAviso: avisar, onExpirar: expirar })
    t.iniciar()
    t.detener()
    vi.advanceTimersByTime(120_000)
    expect(avisar).not.toHaveBeenCalled()
    expect(expirar).not.toHaveBeenCalled()
  })
})
