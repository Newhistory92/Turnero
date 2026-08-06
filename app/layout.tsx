import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { SocketProvider } from "@/lib/turno-context"
import { SupabaseStatus } from "@/components/supabase-status"

const inter = Inter({ subsets: ["latin"] })

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
      <body className={inter.className}>
        <SocketProvider>
          {children}
          <SupabaseStatus />
        </SocketProvider>
      </body>
    </html>
  )
}

