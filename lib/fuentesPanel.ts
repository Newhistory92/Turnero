import { Plus_Jakarta_Sans, Inter } from "next/font/google"

/**
 * Tipografia propia del panel interno (admin y tablero), separada de
 * font-titulo/font-cuerpo que usan el kiosco y la pantalla de sala. Ahi el
 * publico ve numeros grandes desde lejos y conviene el trazo mas grueso de
 * Figtree/Noto Sans; aca el personal lee tablas y formularios de cerca, y
 * un trazo mas fino (Plus Jakarta Sans + Inter) se lee mejor en textos
 * chicos y se siente menos pesado en pantalla durante horas.
 */
export const panelTitulo = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-panel-titulo",
  display: "swap",
})

export const panelCuerpo = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--fuente-panel-cuerpo",
  display: "swap",
})
