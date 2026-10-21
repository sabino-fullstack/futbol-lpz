import {
  BadgeCheck, Ban, Banknote, Clock, Gift, Hourglass, QrCode, User, UserCheck, UserX, X,
} from 'lucide-react'

const ESTADOS = {
  qr: { texto: 'Pagó por QR', corto: 'Pagó QR', Icono: QrCode, color: 'verde' },
  adelantado: { texto: 'Pagó antes del partido', corto: 'Pagó antes', Icono: BadgeCheck, color: 'verde' },
  cancha_cobrado: { texto: 'Cobrado en cancha', corto: 'Cobrado', Icono: BadgeCheck, color: 'verde' },
  bonificado: { texto: 'Cuota bonificada', corto: 'Bonificado', Icono: Gift, color: 'verde' },
  cancha_debe: { texto: 'Debe pagar en cancha', corto: 'Debe en cancha', Icono: Banknote, color: 'amarillo' },
  por_verificar: { texto: 'Pago por verificar', corto: 'Por verificar', Icono: Clock, color: 'amarillo' },
  reservado: { texto: 'Reservado, sin pago', corto: 'Sin pago', Icono: Hourglass, color: 'gris' },
  rechazado: { texto: 'Pago rechazado', corto: 'Rechazado', Icono: X, color: 'rojo' },
  vencido: { texto: 'Venció', corto: 'Venció', Icono: Ban, color: 'gris' },
  cancelado: { texto: 'Cancelado', corto: 'Cancelado', Icono: X, color: 'rojo' },
  asistio: { texto: 'Asistió', corto: 'Asistió', Icono: UserCheck, color: 'verde' },
  falto: { texto: 'Faltó', corto: 'Faltó', Icono: UserX, color: 'rojo' },
  sin_marcar: { texto: 'Sin marcar', corto: 'Sin marcar', Icono: User, color: 'gris' },
  confirmado: { texto: 'Cupo confirmado', corto: 'Confirmado', Icono: BadgeCheck, color: 'verde' },
  jug_cancha: { texto: 'Pagas en cancha', corto: 'Pagas en cancha', Icono: Banknote, color: 'amarillo' },
}

const COLORES = {
  verde: 'border-verde/40 bg-verde/10 text-verde',
  amarillo: 'border-amarillo/50 bg-amarillo/10 text-amarillo-texto',
  rojo: 'border-rojo/40 bg-rojo/10 text-rojo',
  gris: 'border-borde bg-borde/40 text-suave',
}

const TEXTO = {
  verde: 'text-verde',
  amarillo: 'text-amarillo-texto',
  rojo: 'text-rojo',
  gris: 'text-suave',
}

// Borde de color a la izquierda de las tarjetas
export const BORDE_IZQ = {
  verde: 'border-l-verde',
  amarillo: 'border-l-amarillo',
  rojo: 'border-l-rojo',
  gris: 'border-l-borde',
}

export const colorDeEstado = (clave) => ESTADOS[clave]?.color ?? 'gris'

// Versión completa, con forma de etiqueta
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

// Versión corta, para filas delgadas: ícono y texto de una palabra o dos
export function EstadoCorto({ clave }) {
  const e = ESTADOS[clave]
  if (!e) return null
  const { Icono } = e
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${TEXTO[e.color]}`}>
      <Icono size={13} /> {e.corto}
    </span>
  )
}