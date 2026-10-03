export default function BarraCupos({ titulo, libres, total }) {
  if (total <= 0) return null
  const ocupados = Math.max(0, total - libres)
  const pct = Math.min(100, Math.round((ocupados / total) * 100))
  const lleno = libres <= 0
  const urgente = !lleno && pct >= 75

  const texto = lleno
    ? 'Completo'
    : urgente
      ? (libres === 1 ? '¡Último cupo!' : `¡Últimos ${libres}!`)
      : `Quedan ${libres}`

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{titulo}</span>
        <span className={lleno || urgente ? 'font-semibold text-rojo' : 'text-suave'}>
          {texto} <span className="font-normal text-suave">· {ocupados}/{total}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${titulo}: ${ocupados} de ${total} cupos ocupados`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={ocupados}
        className="h-3 w-full overflow-hidden rounded-full bg-borde"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct >= 75 ? 'bg-rojo' : 'bg-verde'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}