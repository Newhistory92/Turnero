import type { ReactNode } from "react"

export default function LayoutKiosco({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-gris-20 font-cuerpo text-gris-principal select-none">
      {children}
    </div>
  )
}
