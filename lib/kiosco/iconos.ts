import {
  Accessibility, Activity, Baby, Bone, ClipboardList, Coins, CreditCard,
  FileQuestion, FlaskConical, FolderOpen, HeartHandshake, IdCard,
  MessageSquare, Pill, Radiation, Scan, ScanLine, Scissors, Stethoscope,
  type LucideIcon,
} from "lucide-react"

const MAPA: Record<string, LucideIcon> = {
  Accessibility, Activity, Baby, Bone, ClipboardList, Coins, CreditCard,
  FileQuestion, FlaskConical, FolderOpen, HeartHandshake, IdCard,
  MessageSquare, Pill, Radiation, Scan, ScanLine, Scissors, Stethoscope,
}

export function iconoPorNombre(nombre: string): LucideIcon {
  return MAPA[nombre] ?? FileQuestion
}

export const NOMBRES_DE_ICONO = Object.keys(MAPA)
