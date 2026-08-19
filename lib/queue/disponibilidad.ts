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

/**
 * Agrupa intersecciones contiguas o solapadas entre si, sin unir jamas dos
 * grupos separados por un hueco sin cobertura. Devuelve los grupos ordenados
 * por hora de inicio.
 */
function agrupar(intersecciones: Ventana[]): Ventana[] {
  const ordenadas = [...intersecciones].sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))
  const grupos: Ventana[] = []
  for (const v of ordenadas) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && aMinutos(v.desde) <= aMinutos(ultimo.hasta)) {
      grupos[grupos.length - 1] = unir(ultimo, v)
    } else {
      grupos.push(v)
    }
  }
  return grupos
}

/**
 * Devuelve el grupo relevante para "minutos": el que lo contiene o, si
 * ninguno lo contiene, el mas cercano en el tiempo. Es la unica funcion que
 * decide que ventana se le muestra al usuario, para que nunca "abarque" un
 * hueco entre boxes que individualmente no se solapan entre si.
 */
function ventanaEfectivaParaMostrar(grupos: Ventana[], minutos: number): Ventana | null {
  if (grupos.length === 0) return null

  const contiene = grupos.find((g) => minutos >= aMinutos(g.desde) && minutos < aMinutos(g.hasta))
  if (contiene) return contiene

  return grupos.reduce((cercano, g) => {
    const distancia = Math.min(
      Math.abs(aMinutos(g.desde) - minutos),
      Math.abs(aMinutos(g.hasta) - minutos)
    )
    const distanciaCercano = Math.min(
      Math.abs(aMinutos(cercano.desde) - minutos),
      Math.abs(aMinutos(cercano.hasta) - minutos)
    )
    return distancia < distanciaCercano ? g : cercano
  })
}

// Los calculos de dia/hora dependen de que el proceso de Node corra en hora
// local de America/Argentina/San_Juan (no hay horario de verano). Esto debe
// garantizarse al arrancar el proceso (p. ej. con la variable de entorno TZ);
// esta funcion no lo verifica ni lo corrige, solo asume que ya se cumple.
export function estaDisponible(
  tramite: TramiteDominio,
  boxes: BoxDominio[],
  ahora: Date
): Disponibilidad {
  if (!tramite.activo) {
    return {
      disponible: false,
      ventanaEfectiva: null,
      motivo: "tramite_inactivo",
      anticipado: false,
    }
  }

  const dia = String(diaIso(ahora))
  const boxesUtiles = boxes.filter((b) => b.activo)

  if (boxesUtiles.length === 0) {
    return { disponible: false, ventanaEfectiva: null, motivo: "sin_boxes", anticipado: false }
  }

  const ventanaTramite: Ventana = {
    desde: tramite.horaApertura,
    hasta: tramite.horaCierre,
  }

  // Chequeo estructural: existe al menos un box activo (de cualquier dia)
  // cuyo horario se solape con el del tramite. Si no, el tramite nunca
  // podria emitirse con la configuracion actual, sin importar el dia.
  const haySolapeEstructural = boxesUtiles.some((b) =>
    intersectar(ventanaTramite, { desde: b.horaApertura, hasta: b.horaCierre })
  )

  if (!haySolapeEstructural) {
    return { disponible: false, ventanaEfectiva: null, motivo: "sin_boxes", anticipado: false }
  }

  // Solo los boxes activos Y abiertos hoy pueden aportar horas reales: un
  // box que hoy no trabaja no debe sumar su franja a la ventana efectiva ni
  // habilitar el tramite, aunque otro box (que hoy no trabaja) tenga horas
  // que si se solapan.
  const boxesHoy = boxesUtiles.filter((b) => b.diasSemana.includes(dia))

  const intersecciones: Ventana[] = []
  for (const b of boxesHoy) {
    const cruce = intersectar(ventanaTramite, {
      desde: b.horaApertura,
      hasta: b.horaCierre,
    })
    if (cruce) intersecciones.push(cruce)
  }

  const habilitaHoy = tramite.diasSemana.includes(dia) && intersecciones.length > 0

  const minutos = ahoraEnMinutos(ahora)
  // La disponibilidad real sale de si "ahora" cae dentro de la franja de
  // ALGUN box individual, nunca de un envolvente unido (que podria mentir
  // sobre huecos sin cobertura).
  const dentro = intersecciones.some(
    (v) => minutos >= aMinutos(v.desde) && minutos < aMinutos(v.hasta)
  )

  const grupos = agrupar(intersecciones)
  // Ventana efectiva para mostrarle al usuario cuando esta cerrado. Nunca
  // "abarca" un hueco entre boxes que individualmente no se solapan entre si.
  const efectiva = ventanaEfectivaParaMostrar(grupos, minutos)

  if (!habilitaHoy) {
    return {
      disponible: false,
      ventanaEfectiva: efectiva,
      motivo: "fuera_de_horario",
      anticipado: false,
    }
  }

  if (dentro) {
    return { disponible: true, ventanaEfectiva: efectiva, motivo: null, anticipado: false }
  }

  // Hoy se atiende, pero ahora no. Los tres casos no son lo mismo para quien
  // esta parado frente al totem, y por eso no comparten respuesta.
  const primero = grupos[0]
  const ultimo = grupos[grupos.length - 1]

  // Llego antes de que abra: el turno se emite igual y hace la cola. El
  // kiosco le avisa el horario en la pantalla del resultado.
  if (minutos < aMinutos(primero.desde)) {
    return { disponible: true, ventanaEfectiva: efectiva, motivo: null, anticipado: true }
  }

  // Ya paso la ultima hora de cierre: por hoy no se atiende mas.
  if (minutos >= aMinutos(ultimo.hasta)) {
    return {
      disponible: false,
      ventanaEfectiva: efectiva,
      motivo: "cerrado_por_hoy",
      anticipado: false,
    }
  }

  // Hueco entre boxes no contiguos: hoy todavia se vuelve a atender, pero
  // ahora mismo no hay cobertura, asi que no se emite.
  return {
    disponible: false,
    ventanaEfectiva: efectiva,
    motivo: "fuera_de_horario",
    anticipado: false,
  }
}
