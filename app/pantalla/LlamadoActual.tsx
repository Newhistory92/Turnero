"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { LlamadoPantalla } from "@/server/snapshotPantalla"

/**
 * Sin nadie llamado. Es el estado en que la TV pasa la mayor parte del dia, asi
 * que el movimiento es minimo: tres puntos en secuencia alcanzan para que se
 * lea como "esperando" y no como "colgado", sin cansar a quien la mira.
 *
 * Los dos logos van sin placa, directo sobre el azul, en su version monocroma
 * blanca. Gobierno.png solo existe en su version a color, con el texto casi
 * negro: sobre el azul marino ese texto queda en 1.5:1, ilegible a varios
 * metros. El filtro lo lleva a blanco puro —11:1— y lo empareja con
 * osp-blanco.png, que ya viene monocromo. Es la variante de marca para fondo
 * oscuro, no un recoloreo arbitrario.
 */
function EnEspera({ reducirMovimiento }: { reducirMovimiento: boolean | null }) {
  return (
    <section className="flex flex-col items-center justify-center gap-[4vh] px-[3vw]">
      {/*
        Los dos logos latan como un solo bloque: el latido va en el contenedor,
        no en cada imagen, para que no se despeguen entre si ni respecto del
        divisor. Es lento a proposito —2.8s contra los 1.6s de los puntos— asi
        los dos movimientos se leen como capas y no compiten.
      */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={
          reducirMovimiento
            ? { opacity: 1, scale: 1 }
            : { opacity: 1, scale: [1, 1.045, 1] }
        }
        transition={{
          opacity: { duration: 0.6, ease: "easeOut" },
          scale: reducirMovimiento
            ? { duration: 0 }
            : { duration: 2.8, repeat: Infinity, ease: "easeInOut" },
        }}
        className="flex items-center gap-[2.5vw]"
      >
        <img
          src="/Gobierno.png"
          alt="San Juan Gobierno"
          className="h-[8vh] [filter:brightness(0)_invert(1)]"
        />
        <span aria-hidden className="h-[7vh] w-px bg-white/25" />
        <img src="/osp-blanco.png" alt="Obra Social Provincia" className="h-[5vh]" />
      </motion.div>

      <div className="flex flex-col items-center gap-[2vh]">
        <p className="text-[1.8vw] tracking-[0.12em] text-white/85">
          Aguarde su llamado
        </p>

        {/* Senal de vida propia: el reloj corre en el cliente y sigue andando
            aunque haga media hora que no llega nada. */}
        <div aria-hidden className="flex gap-[0.9vw]">
          {[0, 1, 2].map((i) => (
            <motion.span
              className="block h-[0.8vw] w-[0.8vw] rounded-full bg-white"
              key={i}
              animate={
                reducirMovimiento ? { opacity: 0.5 } : { opacity: [0.25, 1, 0.25] }
              }
              transition={
                reducirMovimiento
                  ? { duration: 0 }
                  : {
                      duration: 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: i * 0.22,
                    }
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export function LlamadoActual({ llamado }: { llamado: LlamadoPantalla | null }) {
  const reducirMovimiento = useReducedMotion()

  if (!llamado) return <EnEspera reducirMovimiento={reducirMovimiento} />

  return (
    <motion.section
      // key: remonta el bloque en cada llamado nuevo y reinicia la animacion.
      key={llamado.eventoId}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col justify-center px-[3vw]"
    >
      <p className="text-[1.6vw] font-semibold uppercase tracking-[0.25em] text-[#ffd24a]">
        Llamando
      </p>

      {/*
        El numero late mientras el turno sigue esperando. En cuanto el operador
        lo atiende, el snapshot deja de traerlo como actual y este bloque
        desmonta entero, asi que el latido no necesita condicion: existir aca ya
        significa "todavia no vino".
      */}
      <motion.p
        animate={reducirMovimiento ? { opacity: 1 } : { opacity: [1, 0.5, 1] }}
        transition={
          reducirMovimiento
            ? { duration: 0 }
            : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
        }
        className="text-[9vw] font-semibold leading-none text-white"
      >
        {llamado.numero}
      </motion.p>

      {llamado.identificacion && (
        <p className="mt-[1.2vh] text-[2.4vw] text-white">{llamado.identificacion}</p>
      )}

      <p className="mt-[2vh]">
        <span className="inline-block rounded-xl bg-[#f2564e] px-[2vw] py-[0.8vh] text-[3.2vw] font-semibold text-[#2a0806]">
          {llamado.boxNombre}
        </span>
      </p>
    </motion.section>
  )
}
