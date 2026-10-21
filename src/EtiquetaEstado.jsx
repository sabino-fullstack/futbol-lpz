import {
  BadgeCheck, Ban, Banknote, Clock, Gift, Hourglass, QrCode, User, UserCheck, UserX, X,
} from 'lucide-react'

const ESTADOS = {
  qr: { texto: 'Pagó por QR', Icono: QrCode, color: 'verde' },
  cancha_cobrado: { texto: 'Cobrado en cancha', Icono: BadgeCheck, color: 'verde' },
  bonificado: { texto: 'Cuota bonificada', Icono: Gift, color: 'verde' },
  cancha_debe: { texto: 'Debe pagar en cancha', Icono: Banknote, color: 'amarillo' },
  por_verificar: { texto: 'Pago por verificar', Icono: Clock, color: 'amarillo' },
  reservado: { texto: 'Reservado, sin pago', Icono: Hourglass, color: 'gris' },
  rechazado: { texto: 'Pago rechazado', Icono: X, color: 'rojo' },
  vencido: { texto: 'Venció', Icono: Ban, color: 'gris' },
  cancelado: { texto: 'Cancelado', Icono: X, color: 'rojo' },
  asistio: { texto: 'Asistió', Icono: UserCheck, color: 'verde' },
  falto: { texto: 'Faltó', Icono: UserX, color: 'rojo' },
  sin_marcar: { texto: 'Sin marcar', Icono: User, color: 'gris' },
}

const COLORES = {
  verde: 'border-verde/40 bg-verde/10 text-verde',
  amarillo: 'border-amarillo/50 bg-amarillo/10 text-amarillo-texto',
  rojo: 'border-rojo/40 bg-rojo/10 text-rojo',
  gris: 'border-borde bg-borde/40 text-suave',
}

// Borde de color a la izquierda de las tarjetas
export const BORDE_IZQ = {
  verde: 'border-l-verde',
  amarillo: 'border-l-amarillo',
  rojo: 'border-l-rojo',
  gris: 'border-l-borde',
}

export default function Etiqueta({ clave }) {
  const e = ESTADOS[clave]
  if (!e) return null
  const { Icono } = e
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${COLORES[e.color]}`}>
      <Icono size={13} /> {e.texto}
    </span>
  )
}