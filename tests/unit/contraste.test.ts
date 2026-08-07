import { describe, it, expect } from "vitest"
import { contraste, TOKENS, PARES_DE_TEXTO } from "@/lib/kiosco/contraste"

describe("contraste de la paleta institucional", () => {
  it("gris-principal sobre blanco supera AAA", () => {
    expect(contraste(TOKENS.grisPrincipal, TOKENS.blanco)).toBeGreaterThanOrEqual(7)
  })

  it("blanco sobre rojo OSP supera AA", () => {
    expect(contraste(TOKENS.blanco, TOKENS.osp)).toBeGreaterThanOrEqual(4.5)
  })

  it("rojo OSP sobre gris-20 supera AA", () => {
    expect(contraste(TOKENS.osp, TOKENS.gris20)).toBeGreaterThanOrEqual(4.5)
  })

  it("gris-80 NO alcanza AA: por eso está prohibido para texto", () => {
    expect(contraste(TOKENS.gris80, TOKENS.blanco)).toBeLessThan(4.5)
  })

  it("todos los pares declarados para texto cumplen AA", () => {
    for (const { nombre, frente, fondo } of PARES_DE_TEXTO) {
      expect(contraste(frente, fondo), nombre).toBeGreaterThanOrEqual(4.5)
    }
  })
})
