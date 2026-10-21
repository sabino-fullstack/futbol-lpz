import { AUSPICIANTES, TITULO_FRANJA } from './auspiciantes'

export default function FranjaAuspiciantes() {
  const lista = AUSPICIANTES.filter((a) => a.logo && a.enlace?.startsWith('https://'))
  if (lista.length === 0) return null
  const carrusel = lista.length > 3

  return (
    <section aria-label={TITULO_FRANJA} className="space-y-2 pt-3">
      <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-suave">
        {TITULO_FRANJA}
      </p>
      <ul
        className={
          carrusel
            ? 'flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none]'
            : 'flex justify-center gap-2'
        }
      >
        {lista.map((a) => (
          <li key={a.nombre} className="w-[calc((100%-1rem)/3)] shrink-0 snap-start">
            <a
  href={a.enlace}
  target="_blank"
  rel="noreferrer"
  aria-label={`${a.nombre} (se abre en una pestaña nueva)`}
  className="isolate flex h-16 items-center justify-center rounded-xl border border-borde bg-white p-2 transition-transform active:scale-95 dark:bg-fondo"
>
  <img
    src={a.logo}
    alt={a.nombre}
    loading="lazy"
    className="max-h-full max-w-full object-contain mix-blend-multiply dark:mix-blend-screen dark:invert"
  />
</a>
          </li>
        ))}
      </ul>
      {carrusel && <p className="text-center text-[11px] text-suave">Desliza para ver más</p>}
    </section>
  )
}