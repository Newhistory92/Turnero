import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const LUNES_A_VIERNES = "12345"
const APERTURA = "07:00"
const CIERRE = "13:00"

async function main() {
  const sede = await prisma.sede.create({
    data: { nombre: "Sede Central" },
  })

  const norte = await prisma.ala.create({
    data: { sedeId: sede.id, nombre: "Norte", orden: 1 },
  })
  const sur = await prisma.ala.create({
    data: { sedeId: sede.id, nombre: "Sur", orden: 2 },
  })

  const baja = await prisma.piso.create({
    data: { sedeId: sede.id, nombre: "Planta Baja", nivel: 0 },
  })
  const alta = await prisma.piso.create({
    data: { sedeId: sede.id, nombre: "Planta Alta", nivel: 1 },
  })

  const horarioBox = {
    activo: true,
    horaApertura: APERTURA,
    horaCierre: CIERRE,
    diasSemana: LUNES_A_VIERNES,
  }

  // Boxes del Ala Sur: 1-4 Auditoria Medica, 5-7 Afiliaciones
  const boxesSur = await Promise.all(
    [1, 2, 3, 4, 5, 6, 7].map((numero) =>
      prisma.box.create({
        data: {
          alaId: sur.id,
          pisoId: baja.id,
          numero,
          nombre: `Box ${numero}`,
          ...horarioBox,
        },
      })
    )
  )

  // Boxes del Ala Norte: 1-3 Auditoria Medica General
  const boxesNorte = await Promise.all(
    [1, 2, 3].map((numero) =>
      prisma.box.create({
        data: {
          alaId: norte.id,
          pisoId: baja.id,
          numero,
          nombre: `Box ${numero}`,
          ...horarioBox,
        },
      })
    )
  )

  // Mesa unica de Servicio Social, Planta Alta Ala Norte
  const mesaSocial = await prisma.box.create({
    data: {
      alaId: norte.id,
      pisoId: alta.id,
      numero: 10,
      nombre: "Mesa de Servicio Social",
      ...horarioBox,
    },
  })

  const catAfiliaciones = await prisma.categoria.create({
    data: { nombre: "Afiliaciones", icono: "IdCard", orden: 1 },
  })
  const catAuditoria = await prisma.categoria.create({
    data: { nombre: "Auditoría Médica", icono: "Stethoscope", orden: 2 },
  })
  const catPracticas = await prisma.categoria.create({
    data: { nombre: "Prácticas y Estudios", icono: "Activity", orden: 3 },
  })
  const catSocial = await prisma.categoria.create({
    data: { nombre: "Servicio Social", icono: "HeartHandshake", orden: 4 },
  })

  const horarioTramite = {
    horaApertura: APERTURA,
    horaCierre: CIERRE,
    diasSemana: LUNES_A_VIERNES,
    activo: true,
  }

  const box = (lista: typeof boxesSur, numero: number) =>
    lista.find((b) => b.numero === numero)!

  const tramites: Array<{
    categoriaId: string
    nombre: string
    subtitulo: string
    icono: string
    prefijo: string
    destinoAlaId: string
    destinoPisoId: string
    duracionMinimaEsperada: number
    orden: number
    boxIds: string[]
  }> = [
    // Afiliaciones - Ala Sur
    {
      categoriaId: catAfiliaciones.id,
      nombre: "Aportes",
      subtitulo: "Verificación y consulta de aportes",
      icono: "Coins",
      prefijo: "AP",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 4,
      orden: 1,
      boxIds: [box(boxesSur, 5).id],
    },
    {
      categoriaId: catAfiliaciones.id,
      nombre: "Carnet",
      subtitulo: "Emisión y renovación",
      icono: "CreditCard",
      prefijo: "C",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 3,
      orden: 2,
      boxIds: [box(boxesSur, 6).id],
    },
    {
      categoriaId: catAfiliaciones.id,
      nombre: "Recepción de Expedientes",
      subtitulo: "Presentación de documentación",
      icono: "FolderOpen",
      prefijo: "E",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 4,
      orden: 3,
      boxIds: [box(boxesSur, 7).id],
    },
    // Auditoria Medica - Ala Sur
    {
      categoriaId: catAuditoria.id,
      nombre: "Prótesis",
      subtitulo: "Autorización de prótesis",
      icono: "Bone",
      prefijo: "PR",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 7,
      orden: 1,
      boxIds: [box(boxesSur, 1).id],
    },
    {
      categoriaId: catAuditoria.id,
      nombre: "Planes Especiales",
      subtitulo: "Tratamientos de alto costo",
      icono: "Pill",
      prefijo: "P",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 7,
      orden: 2,
      boxIds: [box(boxesSur, 2).id, box(boxesSur, 3).id],
    },
    {
      categoriaId: catAuditoria.id,
      nombre: "Bioquímica",
      subtitulo: "Análisis y estudios bioquímicos",
      icono: "FlaskConical",
      prefijo: "B",
      destinoAlaId: sur.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 3,
      boxIds: [box(boxesSur, 4).id],
    },
    // Practicas y Estudios - Ala Norte, boxes 1-3 compartidos
    {
      categoriaId: catPracticas.id,
      nombre: "Prácticas Médicas",
      subtitulo: "Autorización de prácticas",
      icono: "ClipboardList",
      prefijo: "PM",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 1,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Resonancia (RMN)",
      subtitulo: "Autorización de resonancia magnética",
      icono: "Scan",
      prefijo: "RM",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 2,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Tomografía (TAC)",
      subtitulo: "Autorización de tomografía",
      icono: "ScanLine",
      prefijo: "TC",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 3,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Radiografía",
      subtitulo: "Autorización de radiografía",
      icono: "Radiation",
      prefijo: "RX",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 4,
      orden: 4,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Cirugías",
      subtitulo: "Autorización de intervenciones",
      icono: "Scissors",
      prefijo: "CX",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 8,
      orden: 5,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Programa Materno",
      subtitulo: "Cobertura de embarazo y parto",
      icono: "Baby",
      prefijo: "MA",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 6,
      orden: 6,
      boxIds: boxesNorte.map((b) => b.id),
    },
    {
      categoriaId: catPracticas.id,
      nombre: "Otros Procesos Médicos",
      subtitulo: "Trámites médicos no listados",
      icono: "FileQuestion",
      prefijo: "OM",
      destinoAlaId: norte.id,
      destinoPisoId: baja.id,
      duracionMinimaEsperada: 5,
      orden: 7,
      boxIds: boxesNorte.map((b) => b.id),
    },
    // Servicio Social - Planta Alta, Ala Norte, mesa unica
    {
      categoriaId: catSocial.id,
      nombre: "DAI",
      subtitulo: "Discapacidad y ayudas integrales",
      icono: "Accessibility",
      prefijo: "D",
      destinoAlaId: norte.id,
      destinoPisoId: alta.id,
      duracionMinimaEsperada: 8,
      orden: 1,
      boxIds: [mesaSocial.id],
    },
    {
      categoriaId: catSocial.id,
      nombre: "Otros Trámites",
      subtitulo: "Consultas de servicio social",
      icono: "MessageSquare",
      prefijo: "OS",
      destinoAlaId: norte.id,
      destinoPisoId: alta.id,
      duracionMinimaEsperada: 6,
      orden: 2,
      boxIds: [mesaSocial.id],
    },
  ]

  for (const t of tramites) {
    const { boxIds, ...datos } = t
    const creado = await prisma.tramite.create({
      data: { ...datos, ...horarioTramite },
    })
    await prisma.boxTramite.createMany({
      data: boxIds.map((boxId) => ({ boxId, tramiteId: creado.id })),
    })
  }

  console.log(`Seed listo: ${tramites.length} trámites, 11 boxes, 4 categorías`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
