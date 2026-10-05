export default function MiEstado({ estado }) {
  if (!estado) return null
  const { confirmados, por_verificar, reservados } = estado
  const plural = (n, uno, varios) => (n === 1 ? uno : varios)
  return (
    <div className="flex flex-wrap gap-2 text-sm font-semibold">
      {confirmados > 0 && (
        <span className="rounded-full border border-verde px-2.5 py-0.5 text-verde">
          ✅ {confirmados} {plural(confirmados, 'cupo confirmado', 'cupos confirmados')}
        </span>
      )}
      {por_verificar > 0 && (
        <span className="rounded-full border border-amarillo px-2.5 py-0.5 text-amarillo">
          ⏳ {por_verificar} por verificar
        </span>
      )}
      {reservados > 0 && (
        <span className="rounded-full border border-borde px-2.5 py-0.5 text-suave">
          Reservado: falta pagar ({reservados})
        </span>
      )}
    </div>
  )
}