import { Turno } from "@/lib/types"

export default function TurnoCard({ turno }: { turno: Turno }) {
  const estadoClases = {
    esperando: "bg-white/20 text-white",
    llamado: "bg-red-500 text-white animate-pulse border-2 border-red-300",
    atendido: "bg-green-500/30 text-green-200 border border-green-400/50"
  }
 console.log('Renderizando TurnoCard:', turno) 
  return (
    <div className={`p-2 text-center rounded font-bold ${estadoClases[turno.estado]}`}>
      {turno.numero}
      {turno.estado === "llamado" && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full animate-ping"></span>
      )}
    </div>
  )
}