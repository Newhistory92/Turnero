"use client"

import { useSocket } from "@/lib/turno-context"

export function SupabaseStatus() {
  const { supabaseConnected, isConnected } = useSocket()

  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border rounded-full px-3 py-1.5 shadow text-xs font-medium">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-gray-700 dark:text-gray-300">
          {isConnected ? "Servidor conectado" : "Servidor desconectado"}
        </span>
      </div>
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border rounded-full px-3 py-1.5 shadow text-xs font-medium">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            supabaseConnected ? "bg-green-500" : "bg-red-500"
          }`}
        />
        <span className="text-gray-700 dark:text-gray-300">
          {supabaseConnected ? "Supabase conectado" : "Supabase desconectado"}
        </span>
      </div>
    </div>
  )
}
