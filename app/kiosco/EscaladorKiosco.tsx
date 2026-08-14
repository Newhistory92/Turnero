"use client"

import { useEffect, useState, type ReactNode } from "react"

const ANCHO_DISENO = 1920
const ALTO_DISENO = 1080

/**
 * El diseño del kiosco está calibrado en píxeles fijos para 1920x1080 (el
 * tótem físico, spec §7.2). Para que se vea proporcionalmente igual en
 * cualquier pantalla (monitores de desarrollo, otras resoluciones), se
 * renderiza el layout completo en un lienzo fijo de 1920x1080 y se escala
 * como una unidad con transform: scale. Ningún componente hijo cambia:
 * siguen viendo un canvas de 1920x1080 y "nunca hace scroll" (regla 3) se
 * sigue cumpliendo igual, ahora también fuera del tótem.
 */
export function EscaladorKiosco({ children }: { children: ReactNode }) {
  const [escala, setEscala] = useState(1)

  useEffect(() => {
    const calcular = () => {
      const escalaAncho = window.innerWidth / ANCHO_DISENO
      const escalaAlto = window.innerHeight / ALTO_DISENO
      setEscala(Math.min(escalaAncho, escalaAlto))
    }
    calcular()
    window.addEventListener("resize", calcular)
    return () => window.removeEventListener("resize", calcular)
  }, [])

  // El lienzo se posiciona en absoluto y se centra con translate: `scale` reduce
  // lo que se ve pero el elemento sigue ocupando 1920x1080 en el layout, asi que
  // un flex con items-center lo centraria sobre la caja sin escalar y la franja
  // sobrante quedaria toda de un lado.
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        style={{
          width: ANCHO_DISENO,
          height: ALTO_DISENO,
          transform: `translate(-50%, -50%) scale(${escala})`,
        }}
        className="absolute left-1/2 top-1/2 origin-center overflow-hidden bg-gris-20"
      >
        {children}
      </div>
    </div>
  )
}
