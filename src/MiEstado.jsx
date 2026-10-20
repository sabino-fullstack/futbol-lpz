import { Check, Clock } from 'lucide-react'

export default function MiEstado({ estado }) {
  if (!estado) return null
  const { confirmados, por_verificar, reservados } = estado
  const chip = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold'
  return (
    <div className="flex flex-wrap gap-1.5">
      {confirmados > 0 && (
        <span className={`${chip} border-verde text-verde`}>
          <Check size={13} /> {confirmados} {confirmados === 1 ? 'cupo confirmado' : 'cupos confirmados'}
        </span>
      )}
      {por_verificar > 0 && (
        <span className={`${chip} border-amarillo text-amarillo`}>
          <Clock size={13} /> {por_verificar} por verificar
        </span>
      )}
      {reservados > 0 && (
        <span className={`${chip} border-borde text-suave`}>
          Reservado: falta pagar ({reservados})
        </span>
      )}
    </div>
  )
}