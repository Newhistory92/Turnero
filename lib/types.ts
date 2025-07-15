export interface Turno {
  id: string
  numero: string
  servicio:
    | "auditoria"
    | "planes"
    | "social"
    | "personalizada"
    | "emision_carnet"
    | "atencion_personalizada_afiliaciones"
    | "control_aportes"
    | "inicio_expediente"
  departamento: "auditoria_medica" | "afiliaciones"
  timestamp: Date
  estado: "esperando" | "llamado" | "atendido"| "finalizado"
  boxAsignado?: string
  tiempoLlamado?: Date
  tiempoAtencion?: number
}

export interface Box {
  id: string
  nombre: string
  servicio: string
  departamento: string
  empleado?: string
}

export interface RegistroAtencion {
  id: string
  numeroTurno: string
  servicio: string
  departamento: string
  boxAsignado: string
  empleado: string
  tiempoAtencion: number
  fecha: string
  
}

export const DEPARTAMENTOS = {
  auditoria_medica: {
    nombre: "Auditoría Médica",
    descripcion: "Servicios de revisión y validación médica",
    color: "bg-blue-500",
    horaApertura: "07:00",
    horaCierre: "12:55",
    servicios: {
      auditoria: {
        nombre: "Auditoría Médica",
        prefijo: "A",
        descripcion: "Revisión y validación de procedimientos médicos",
      },
      planes: {
        nombre: "Planes Especiales",
        prefijo: "P",
        descripcion: "Información sobre planes de salud especializados",
      },
      social: {
        nombre: "Área Social",
        prefijo: "S",
        descripcion: "Asistencia social y programas de bienestar",
      },
      personalizada: {
        nombre: "Atención Personalizada",
        prefijo: "T",
        descripcion: "Atención especializada y consultas específicas",
      },
    },
  },
  afiliaciones: {
    nombre: "Afiliaciones",
    descripcion: "Servicios de gestión de afiliados",
    color: "bg-green-500",
    horaApertura: "07:00",
    horaCierre: "12:55",
    servicios: {
      emision_carnet: {
        nombre: "Emisión de Carnet",
        prefijo: "C",
        descripcion: "Solicitud y renovación de carnets de afiliado",
      },
      atencion_personalizada_afiliaciones: {
        nombre: "Atención Personalizada",
        prefijo: "AP",
        descripcion: "Consultas personalizadas sobre afiliación",
      },
      control_aportes: {
        nombre: "Control de Aportes",
        prefijo: "CA",
        descripcion: "Verificación y consulta de aportes realizados",
      },
      inicio_expediente: {
        nombre: "Inicio de Expediente",
        prefijo: "E",
        descripcion: "Apertura de nuevos expedientes de afiliado",
      },
    },
  },
} as const

// Servicios combinados para compatibilidad
export const SERVICIOS = {
  ...DEPARTAMENTOS.auditoria_medica.servicios,
  ...DEPARTAMENTOS.afiliaciones.servicios,
} as const

export const BOXES: Box[] = [
  // Boxes Auditoría Médica
  { id: "box1", nombre: "Box 1", servicio: "Auditoría Médica", departamento: "Auditoría Médica" },
  { id: "box2", nombre: "Box 2", servicio: "Auditoría Médica", departamento: "Auditoría Médica" },
  { id: "box3", nombre: "Box 3", servicio: "Planes Especiales", departamento: "Auditoría Médica" },
  { id: "box4", nombre: "Box 4", servicio: "Área Social", departamento: "Auditoría Médica" },
  { id: "box5", nombre: "Box 5", servicio: "Atención Personalizada", departamento: "Auditoría Médica" },

  // Boxes Afiliaciones
  { id: "box6", nombre: "Box 6", servicio: "Emisión de Carnet", departamento: "Afiliaciones" },
  { id: "box7", nombre: "Box 7", servicio: "Emisión de Carnet", departamento: "Afiliaciones" },
  { id: "box8", nombre: "Box 8", servicio: "Atención Personalizada", departamento: "Afiliaciones" },
  { id: "box9", nombre: "Box 9", servicio: "Control de Aportes", departamento: "Afiliaciones" },
  { id: "box10", nombre: "Box 10", servicio: "Inicio de Expediente", departamento: "Afiliaciones" },
]