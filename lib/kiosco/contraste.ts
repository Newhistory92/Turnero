export const TOKENS = {
  gris20: "#f5f5f5",
  grisPrincipal: "#413e43",
  gris70: "#c7c7c7",
  gris80: "#6f7b7e",
  gainsboro: "#d9d9d9",
  blanco: "#ffffff",
  negro: "#000000",
  osp: "#d31d16",
} as const

/**
 * Paleta del panel interno (admin y tablero). Va aparte de la institucional
 * porque son pantallas distintas: el kiosco es la cara publica y estas las
 * mira el personal durante horas.
 */
export const PANEL = {
  fondo: "#f8fafc",
  superficie: "#ffffff",
  borde: "#e2e8f0",
  texto: "#0f172a",
  textoSuave: "#64748b",
  primario: "#0891b2",
  primarioFuerte: "#0e7490",
  primarioSuave: "#ecfeff",
  nav: "#0f172a",
  navSuave: "#1e293b",
  navTexto: "#94a3b8",
  navActivo: "#22d3ee",
} as const

function canal(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminancia(hex: string): number {
  const n = hex.replace("#", "")
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  const claro = Math.max(la, lb)
  const oscuro = Math.min(la, lb)
  return (claro + 0.05) / (oscuro + 0.05)
}

export const PARES_DE_TEXTO = [
  { nombre: "cuerpo sobre fondo", frente: TOKENS.grisPrincipal, fondo: TOKENS.gris20 },
  { nombre: "cuerpo sobre tarjeta", frente: TOKENS.grisPrincipal, fondo: TOKENS.blanco },
  { nombre: "numero de turno", frente: TOKENS.osp, fondo: TOKENS.gris20 },
  { nombre: "accion primaria", frente: TOKENS.blanco, fondo: TOKENS.grisPrincipal },
  { nombre: "banda de destino", frente: TOKENS.blanco, fondo: TOKENS.negro },
] as const

export const PARES_DE_TEXTO_PANEL = [
  { nombre: "cuerpo sobre fondo", frente: PANEL.texto, fondo: PANEL.fondo },
  { nombre: "cuerpo sobre tarjeta", frente: PANEL.texto, fondo: PANEL.superficie },
  { nombre: "texto secundario sobre tarjeta", frente: PANEL.textoSuave, fondo: PANEL.superficie },
  { nombre: "texto secundario sobre fondo", frente: PANEL.textoSuave, fondo: PANEL.fondo },
  { nombre: "enlace de la lateral", frente: PANEL.navTexto, fondo: PANEL.nav },
  { nombre: "enlace activo de la lateral", frente: PANEL.navActivo, fondo: PANEL.navSuave },
  { nombre: "enlace de la lateral al pasar el mouse", frente: TOKENS.blanco, fondo: PANEL.navSuave },
  { nombre: "aviso de solo lectura", frente: PANEL.primarioFuerte, fondo: PANEL.primarioSuave },
  { nombre: "icono de tarjeta", frente: PANEL.primarioFuerte, fondo: PANEL.primarioSuave },
  { nombre: "isotipo de la lateral", frente: TOKENS.blanco, fondo: PANEL.primarioFuerte },
  { nombre: "pestana activa del tablero", frente: PANEL.primarioFuerte, fondo: PANEL.superficie },
] as const
