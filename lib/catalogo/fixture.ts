import type { Catalogo, CategoriaCatalogo, TramiteCatalogo } from "./index"
import type { BoxDominio } from "@/lib/queue/tipos"

/**
 * Objeto estático con el mismo catálogo de `prisma/seed.ts` (4 categorías, 15
 * trámites, 11 boxes del pliego), con ids fijos en vez de uuid(). Sirve para
 * desarrollar y correr los E2E de SP1 sin conexión a SQL Server, activado con
 * CATALOGO_FIXTURE=on. Nunca se usa en los tests de integración de SP0: esos
 * prueban comportamiento real de la base (MERGE, transiciones condicionadas).
 */

const LUNES_A_VIERNES = "12345"
const APERTURA = "07:00"
const CIERRE = "13:00"

const HORARIO = {
  horaApertura: APERTURA,
  horaCierre: CIERRE,
  diasSemana: LUNES_A_VIERNES,
  activo: true,
}

const boxSur1: BoxDominio = { id: "box-sur-1", ...HORARIO, tramiteIds: ["tramite-protesis"] }
const boxSur2: BoxDominio = { id: "box-sur-2", ...HORARIO, tramiteIds: ["tramite-planes-especiales"] }
const boxSur3: BoxDominio = { id: "box-sur-3", ...HORARIO, tramiteIds: ["tramite-planes-especiales"] }
const boxSur4: BoxDominio = { id: "box-sur-4", ...HORARIO, tramiteIds: ["tramite-bioquimica"] }
const boxSur5: BoxDominio = { id: "box-sur-5", ...HORARIO, tramiteIds: ["tramite-aportes"] }
const boxSur6: BoxDominio = { id: "box-sur-6", ...HORARIO, tramiteIds: ["tramite-carnet"] }
const boxSur7: BoxDominio = {
  id: "box-sur-7",
  ...HORARIO,
  tramiteIds: ["tramite-recepcion-expedientes"],
}

const TRAMITES_NORTE = [
  "tramite-practicas-medicas",
  "tramite-resonancia",
  "tramite-tomografia",
  "tramite-radiografia",
  "tramite-cirugias",
  "tramite-programa-materno",
  "tramite-otros-procesos-medicos",
]

const boxNorte1: BoxDominio = { id: "box-norte-1", ...HORARIO, tramiteIds: TRAMITES_NORTE }
const boxNorte2: BoxDominio = { id: "box-norte-2", ...HORARIO, tramiteIds: TRAMITES_NORTE }
const boxNorte3: BoxDominio = { id: "box-norte-3", ...HORARIO, tramiteIds: TRAMITES_NORTE }

const mesaSocial: BoxDominio = {
  id: "box-norte-mesa-social",
  ...HORARIO,
  tramiteIds: ["tramite-dai", "tramite-otros-tramites"],
}

const DESTINO_SUR = { ala: "Sur", piso: "Planta Baja" }
const DESTINO_NORTE_BAJA = { ala: "Norte", piso: "Planta Baja" }
const DESTINO_NORTE_ALTA = { ala: "Norte", piso: "Planta Alta" }

function tramite(
  datos: Omit<TramiteCatalogo, keyof typeof HORARIO | "boxes"> & { boxes: BoxDominio[] }
): TramiteCatalogo {
  return { ...HORARIO, ...datos }
}

const categoriaAfiliaciones: CategoriaCatalogo = {
  id: "categoria-afiliaciones",
  nombre: "Afiliaciones",
  icono: "IdCard",
  orden: 1,
  tramites: [
    tramite({
      id: "tramite-aportes",
      nombre: "Aportes",
      subtitulo: "Verificación y consulta de aportes",
      icono: "Coins",
      prefijo: "AP",
      orden: 1,
      categoriaId: "categoria-afiliaciones",
      duracionMinimaEsperada: 4,
      destino: DESTINO_SUR,
      boxes: [boxSur5],
    }),
    tramite({
      id: "tramite-carnet",
      nombre: "Carnet",
      subtitulo: "Emisión y renovación",
      icono: "CreditCard",
      prefijo: "C",
      orden: 2,
      categoriaId: "categoria-afiliaciones",
      duracionMinimaEsperada: 3,
      destino: DESTINO_SUR,
      boxes: [boxSur6],
    }),
    tramite({
      id: "tramite-recepcion-expedientes",
      nombre: "Recepción de Expedientes",
      subtitulo: "Presentación de documentación",
      icono: "FolderOpen",
      prefijo: "E",
      orden: 3,
      categoriaId: "categoria-afiliaciones",
      duracionMinimaEsperada: 4,
      destino: DESTINO_SUR,
      boxes: [boxSur7],
    }),
  ],
}

const categoriaAuditoria: CategoriaCatalogo = {
  id: "categoria-auditoria-medica",
  nombre: "Auditoría Médica",
  icono: "Stethoscope",
  orden: 2,
  tramites: [
    tramite({
      id: "tramite-protesis",
      nombre: "Prótesis",
      subtitulo: "Autorización de prótesis",
      icono: "Bone",
      prefijo: "PR",
      orden: 1,
      categoriaId: "categoria-auditoria-medica",
      duracionMinimaEsperada: 7,
      destino: DESTINO_SUR,
      boxes: [boxSur1],
    }),
    tramite({
      id: "tramite-planes-especiales",
      nombre: "Planes Especiales",
      subtitulo: "Tratamientos de alto costo",
      icono: "Pill",
      prefijo: "P",
      orden: 2,
      categoriaId: "categoria-auditoria-medica",
      duracionMinimaEsperada: 7,
      destino: DESTINO_SUR,
      boxes: [boxSur2, boxSur3],
    }),
    tramite({
      id: "tramite-bioquimica",
      nombre: "Bioquímica",
      subtitulo: "Análisis y estudios bioquímicos",
      icono: "FlaskConical",
      prefijo: "B",
      orden: 3,
      categoriaId: "categoria-auditoria-medica",
      duracionMinimaEsperada: 5,
      destino: DESTINO_SUR,
      boxes: [boxSur4],
    }),
  ],
}

const categoriaPracticas: CategoriaCatalogo = {
  id: "categoria-practicas-y-estudios",
  nombre: "Prácticas y Estudios",
  icono: "Activity",
  orden: 3,
  tramites: [
    tramite({
      id: "tramite-practicas-medicas",
      nombre: "Prácticas Médicas",
      subtitulo: "Autorización de prácticas",
      icono: "ClipboardList",
      prefijo: "PM",
      orden: 1,
      categoriaId: "categoria-practicas-y-estudios",
      duracionMinimaEsperada: 5,
      destino: DESTINO_NORTE_BAJA,
      boxes: [boxNorte1, boxNorte2, boxNorte3],
    }),
    tramite({
      id: "tramite-resonancia",
      nombre: "Resonancia (RMN)",
      subtitulo: "Autorización de resonancia magnética",
      icono: "Scan",
      prefijo: "RM",
      orden: 2,
      categoriaId: "categoria-practicas-y-estudios",
      duracionMinimaEsperada: 5,
      destino: DESTINO_NORTE_BAJA,
      boxes: [boxNorte1, boxNorte2, boxNorte3],
    }),
    tramite({
      id: "tramite-tomografia",
      nombre: "Tomografía (TAC)",
      subtitulo: "Autorización de tomografía",
      icono: "ScanLine",
      prefijo: "TC",
      orden: 3,
      categoriaId: "categoria-practicas-y-estudios",
      duracionMinimaEsperada: 5,
      destino: DESTINO_NORTE_BAJA,
      boxes: [boxNorte1, boxNorte2, boxNorte3],
    }),
    tramite({
      id: "tramite-radiografia",
      nombre: "Radiografía",
      subtitulo: "Autorización de radiografía",
      icono: "Radiation",
      prefijo: "RX",
      orden: 4,
      categoriaId: "categoria-practicas-y-estudios",
      duracionMinimaEsperada: 4,
      destino: DESTINO_NORTE_BAJA,
      boxes: [boxNorte1, boxNorte2, boxNorte3],
    }),
    tramite({
      id: "tramite-cirugias",
      nombre: "Cirugías",
      subtitulo: "Autorización de intervenciones",
      icono: "Scissors",
      prefijo: "CX",
      orden: 5,
      categoriaId: "categoria-practicas-y-estudios",
      duracionMinimaEsperada: 8,
      destino: DESTINO_NORTE_BAJA,
      boxes: [boxNorte1, boxNorte2, boxNorte3],
    }),
    tramite({
      id: "tramite-programa-materno",
      nombre: "Programa Materno",
      subtitulo: "Cobertura de embarazo y parto",
      icono: "Baby",
      prefijo: "MA",
      orden: 6,
      categoriaId: "categoria-practicas-y-estudios",
      duracionMinimaEsperada: 6,
      destino: DESTINO_NORTE_BAJA,
      boxes: [boxNorte1, boxNorte2, boxNorte3],
    }),
    tramite({
      id: "tramite-otros-procesos-medicos",
      nombre: "Otros Procesos Médicos",
      subtitulo: "Trámites médicos no listados",
      icono: "FileQuestion",
      prefijo: "OM",
      orden: 7,
      categoriaId: "categoria-practicas-y-estudios",
      duracionMinimaEsperada: 5,
      destino: DESTINO_NORTE_BAJA,
      boxes: [boxNorte1, boxNorte2, boxNorte3],
    }),
  ],
}

const categoriaSocial: CategoriaCatalogo = {
  id: "categoria-servicio-social",
  nombre: "Servicio Social",
  icono: "HeartHandshake",
  orden: 4,
  tramites: [
    tramite({
      id: "tramite-dai",
      nombre: "DAI",
      subtitulo: "Discapacidad y ayudas integrales",
      icono: "Accessibility",
      prefijo: "D",
      orden: 1,
      categoriaId: "categoria-servicio-social",
      duracionMinimaEsperada: 8,
      destino: DESTINO_NORTE_ALTA,
      boxes: [mesaSocial],
    }),
    tramite({
      id: "tramite-otros-tramites",
      nombre: "Otros Trámites",
      subtitulo: "Consultas de servicio social",
      icono: "MessageSquare",
      prefijo: "OS",
      orden: 2,
      categoriaId: "categoria-servicio-social",
      duracionMinimaEsperada: 6,
      destino: DESTINO_NORTE_ALTA,
      boxes: [mesaSocial],
    }),
  ],
}

const categorias = [categoriaAfiliaciones, categoriaAuditoria, categoriaPracticas, categoriaSocial]

export const CATALOGO_FIXTURE: Catalogo = {
  categorias,
  tramites: categorias.flatMap((c) => c.tramites),
  boxes: [
    boxSur1,
    boxSur2,
    boxSur3,
    boxSur4,
    boxSur5,
    boxSur6,
    boxSur7,
    boxNorte1,
    boxNorte2,
    boxNorte3,
    mesaSocial,
  ],
}
