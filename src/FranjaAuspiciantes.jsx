import { AUSPICIANTES } from './auspiciantes'

export default function FranjaAuspiciantes() {
  const lista = AUSPICIANTES.filter((a) => a.logo && a.enlace?.startsWith('https://'))
  if (lista.length === 0) return null
  return (
    <section aria-label="Auspiciantes" className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-suave">Auspiciado por</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {lista.map((a) => (
          <a
            key={a.nombre}
            href={a.enlace}
            target="_blank"
            rel="noreferrer sponsored"
            className="flex h-12 shrink-0 items-center rounded-lg bg-white px-3"
          >
            <img src={a.logo} alt={a.nombre} loading="lazy" className="max-h-8 w-auto object-contain" />
          </a>
        ))}
      </div>
    </section>
  )
}