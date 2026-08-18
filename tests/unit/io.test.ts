import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Server as IoServer } from "socket.io"
import { registrarIo, emitirATodos, reiniciarIo } from "@/server/io"

describe("singleton de io", () => {
  beforeEach(reiniciarIo)

  it("emite a todos una vez registrado", () => {
    const emit = vi.fn()
    registrarIo({ emit } as unknown as IoServer)

    emitirATodos("CATALOGO_ACTUALIZADO", {})
    expect(emit).toHaveBeenCalledWith("CATALOGO_ACTUALIZADO", {})
  })

  // next build y los tests corren sin servidor de sockets. Si emitir
  // explotara ahi, una mutacion correcta fallaria por no poder avisar.
  it("sin io registrado no explota", () => {
    expect(() => emitirATodos("CATALOGO_ACTUALIZADO", {})).not.toThrow()
  })
})
