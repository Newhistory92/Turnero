import type { ReactNode } from "react"
import { EscaladorKiosco } from "./EscaladorKiosco"

export default function LayoutKiosco({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-gris-principal font-cuerpo text-gris-principal select-none">
      <EscaladorKiosco>{children}</EscaladorKiosco>
    </div>
  )
}
