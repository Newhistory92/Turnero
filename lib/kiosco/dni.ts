export const MIN_DIGITOS_DNI = 7
export const MAX_DIGITOS_DNI = 9

export function formatearDni(digitos: string): string {
  if (digitos.length === 0) return ""
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

export function dniEsValido(digitos: string): boolean {
  return digitos.length >= MIN_DIGITOS_DNI && digitos.length <= MAX_DIGITOS_DNI
}
