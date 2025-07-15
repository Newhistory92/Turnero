"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"

export default function ClockDisplay() {
  const [time, setTime] = useState<string>("")

  useEffect(() => {
    // Solo se ejecuta en el cliente
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString("es-ES"))
    }
    
    // Actualizar inmediatamente y luego cada segundo
    updateTime()
    const timer = setInterval(updateTime, 1000)
    
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-2 text-lg">
      <Clock className="w-5 h-5" />
      {time || <span className="w-20 inline-block">--:--:--</span>}
    </div>
  )
}