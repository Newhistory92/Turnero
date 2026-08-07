import type React from "react"
import type { Metadata } from "next"
import { Figtree, Noto_Sans } from "next/font/google"
import "./globals.css"
import { SocketProvider } from "@/lib/turno-context"
import { SupabaseStatus } from "@/components/supabase-status"

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-titulo",
  display: "swap",
})

const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--fuente-cuerpo",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Sistema de Gestión de Turnos",
  description: "Sistema completo para gestión de turnos en oficinas",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${figtree.variable} ${notoSans.variable}`}>
        <SocketProvider>
          {children}
          <SupabaseStatus />
        </SocketProvider>
      </body>
    </html>
  )
}

