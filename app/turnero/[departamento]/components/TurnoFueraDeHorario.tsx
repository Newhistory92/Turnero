import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Props = {
  nombreDepartamento: string
  horaApertura?: string
  horaCierre?: string
}

export default function TurnoFueraDeHorario({ nombreDepartamento, horaApertura, horaCierre }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center p-8">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <CardTitle className="text-2xl text-red-700">Atención finalizada</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            El horario de atención del departamento <strong>{nombreDepartamento}</strong> ha finalizado.
          </p>
          <p className="text-yellow-700">
            Por favor, vuelva en el próximo horario habilitado:
            <br />
            <strong>de {horaApertura} a {horaCierre}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}