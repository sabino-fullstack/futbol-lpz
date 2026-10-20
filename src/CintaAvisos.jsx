import { AVISOS } from './avisos'

export default function CintaAvisos() {
  if (AVISOS.length === 0) return null
  const fila = AVISOS.map((t, i) => (
    <span key={i} className="flex items-center gap-6 pr-6">
      <span>{t}</span>
      <span aria-hidden="true">•</span>
    </span>
  ))
  return (
    <div
      className="cinta overflow-hidden bg-verde py-1.5 text-xs font-semibold uppercase tracking-wider text-sobre-verde"
      aria-label="Avisos"
    >
      <div className="cinta-pista">
        <div className="flex">{fila}</div>
        <div className="cinta-copia flex" aria-hidden="true">{fila}</div>
      </div>
    </div>
  )
}