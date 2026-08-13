import type { ReactNode } from "react"

export default function LayoutOperador({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-gris-20 font-cuerpo text-gris-principal">
      {children}
    </div>
  )
}
