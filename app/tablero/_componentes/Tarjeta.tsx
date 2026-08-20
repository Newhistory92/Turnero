export function Tarjeta({
  etiqueta,
  valor,
  detalle,
}: {
  etiqueta: string
  valor: string
  detalle?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-white p-4">
      <span className="text-sm text-gris-80">{etiqueta}</span>
      <span className="font-titulo text-3xl font-semibold">{valor}</span>
      {detalle && <span className="text-sm text-gris-80">{detalle}</span>}
    </div>
  )
}
