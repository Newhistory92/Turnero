import type {
  BoxDominio,
  Disponibilidad,
  TramiteDominio,
  Ventana,
} from "./tipos"

function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

function aTexto(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Dia ISO: lunes = 1, domingo = 7. */
function diaIso(fecha: Date): number {
  const d = fecha.getDay()
  return d === 0 ? 7 : d
}

function ahoraEnMinutos(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes()
}

/** Interseccion de dos ventanas; null si no se solapan. */
function intersectar(a: Ventana, b: Ventana): Ventana | null {
  const desde = Math.max(aMinutos(a.desde), aMinutos(b.desde))
  const hasta = Math.min(aMinutos(a.hasta), aMinutos(b.hasta))
  if (desde >= hasta) return null
  return { desde: aTexto(desde), hasta: aTexto(hasta) }
}

function unir(a: Ventana, b: Ventana): Ventana {
  return {
    desde: aTexto(Math.min(aMinutos(a.desde), aMinutos(b.desde))),
    hasta: aTexto(Math.max(aMinutos(a.hasta), aMinutos(b.hasta))),
  }
}

export function estaDisponible(
  tramite: TramiteDominio,
  boxes: BoxDominio[],
  ahora: Date
): Disponibilidad {
  if (!tramite.activo) {
    return { disponible: false, ventanaEfectiva: null, motivo: "tramite_inactivo" }
  }

  const dia = String(diaIso(ahora))
  const boxesUtiles = boxes.filter((b) => b.activo)

  if (boxesUtiles.length === 0) {
    return { disponible: false, ventanaEfectiva: null, motivo: "sin_boxes" }
  }

  const ventanaTramite: Ventana = {
    desde: tramite.horaApertura,
    hasta: tramite.horaCierre,
  }

  // Ventana efectiva = union de las intersecciones tramite x cada box.
  let efectiva: Ventana | null = null
  for (const b of boxesUtiles) {
    const cruce = intersectar(ventanaTramite, {
      desde: b.horaApertura,
      hasta: b.horaCierre,
    })
    if (!cruce) continue
    efectiva = efectiva ? unir(efectiva, cruce) : cruce
  }

  if (!efectiva) {
    return { disponible: false, ventanaEfectiva: null, motivo: "sin_boxes" }
  }

  const habilitaHoy =
    tramite.diasSemana.includes(dia) &&
    boxesUtiles.some((b) => b.diasSemana.includes(dia))

  const minutos = ahoraEnMinutos(ahora)
  const dentro =
    minutos >= aMinutos(efectiva.desde) && minutos < aMinutos(efectiva.hasta)

  if (!habilitaHoy || !dentro) {
    return { disponible: false, ventanaEfectiva: efectiva, motivo: "fuera_de_horario" }
  }

  return { disponible: true, ventanaEfectiva: efectiva, motivo: null }
}
