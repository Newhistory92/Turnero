"use client"
import { Turno,SERVICIOS  } from "@/lib/types"

export function printTicket(turno: Turno) {
  const fecha = new Date(turno.timestamp).toLocaleDateString()
  const hora = new Date(turno.timestamp).toLocaleTimeString()

  const html = `
    <html>
      <head>
        <style>
          body {
            font-family: monospace;
            padding: 10px;
            width: 200px;
          }
          .center {
            text-align: center;
          }
          .logo {
            max-width: 200px;
            margin: 0 auto 10px;
          }
          .turno {
            font-size: 32px;
            font-weight: bold;
            margin: 10px 0;
          }
          .info {
            margin-top: 10px;
            font-size: 10px;
          }
          .footer {
            margin-top: 20px;
            font-size: 8px;
          }
        </style>
      </head>
      <body onload="window.print(); setTimeout(() => window.close(), 100)">
        <div class="center">
          <img class="logo" src="/OSP_Gobierno.webp" alt="Logo" />
          <div class="turno">${turno.numero}</div>
          <div class="info">
            <div><strong>Servicio:</strong> ${SERVICIOS[turno.servicio].nombre}</div>
            <div><strong>Box:</strong> ${turno.boxAsignado || "Sin asignar"}</div>
            <div><strong>Fecha:</strong> ${fecha}</div>
            <div><strong>Hora:</strong> ${hora}</div>
          </div>
          <div class="footer">Gracias por su espera</div>
        </div>
      </body>
    </html>
  `

  const ventana = window.open("", "_blank", "width=300,height=600")
  if (ventana) {
    ventana.document.write(html)
    ventana.document.close()
  }
}
