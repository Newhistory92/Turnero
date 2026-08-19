import type { Clasificacion } from "./tipos"

export interface FilaExportable {
  numero: string
  fecha: string
  tramiteNombre: string
  estado: string
  derivado: boolean
  esperaSegundos: number | null
  boxNombre: string | null
  empleadoNombre: string | null
  atencionSegundos: number | null
  clasificacion: Clasificacion | null
}

/**
 * Sin el BOM, Excel en Windows abre el archivo en la codificacion del
 * sistema y los acentos salen rotos.
 */
export const BOM = "﻿"

const COLUMNAS_BASE = ["numero", "fecha", "tramite", "estado", "derivado", "espera_segundos"]

const COLUMNAS_PRODUCTIVIDAD = ["box", "operador", "atencion_segundos", "clasificacion"]

function celda(v: string | number | null): string {
  if (v === null) return '""'
  return `"${String(v).replace(/"/g, '""')}"`
}

/**
 * verProductividad no es cosmetico: el CSV es la puerta de atras clasica
 * del control de acceso. Si la pantalla filtra y el archivo no, el filtro
 * de la pantalla no vale nada.
 */
export function aCsv(filas: FilaExportable[], verProductividad: boolean): string {
  const columnas = verProductividad
    ? [...COLUMNAS_BASE, ...COLUMNAS_PRODUCTIVIDAD]
    : COLUMNAS_BASE

  const lineas = [columnas.map(celda).join(",")]

  for (const f of filas) {
    const base = [
      celda(f.numero),
      celda(f.fecha),
      celda(f.tramiteNombre),
      celda(f.estado),
      celda(f.derivado ? "sí" : "no"),
      celda(f.esperaSegundos),
    ]

    const extra = verProductividad
      ? [
          celda(f.boxNombre),
          celda(f.empleadoNombre),
          celda(f.atencionSegundos),
          celda(f.clasificacion),
        ]
      : []

    lineas.push([...base, ...extra].join(","))
  }

  return BOM + lineas.join("\r\n")
}
