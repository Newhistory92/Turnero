/**
 * Franja superior fija del kiosco. Es puramente institucional: no muestra
 * estado ni navegacion, para que el usuario mire siempre al centro.
 */
export function EncabezadoKiosco() {
  return (
    <header className="flex shrink-0 items-center gap-6 bg-white px-12 py-5">
      <img src="/OSP_Gobierno.webp" alt="Obra Social Provincia" className="h-24" />
    </header>
  )
}
