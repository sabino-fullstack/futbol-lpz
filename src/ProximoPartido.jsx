import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CalendarCheck, ChevronRight, Navigation } from 'lucide-react'
import MiEstado from './MiEstado'
import { rangoHora, inicioPartido, etiquetaDia, faltanTexto } from './formato'

export default function ProximoPartido({ p, estado }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const dia = etiquetaDia(p.fecha)
  const falta = inicioPartido(p).getTime() - ahora

  return (
    <section aria-label="Tu próximo partido" className="tarjeta space-y-2.5 border-verde">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-verde">
        <CalendarCheck size={15} /> Tu próximo partido
      </p>
      <Link to={`/partidos/${p.id}`} className="flex items-center gap-2 text-texto no-underline">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-2xl">{p.cancha}</h3>
          <p className="text-suave">
            <span className="font-semibold text-texto">{dia.titulo}</span> · {rangoHora(p)}
          </p>
          <p className="text-sm font-semibold text-verde">{faltanTexto(falta)}</p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-suave" />
      </Link>
      <MiEstado estado={estado} />
      {p.canchas?.enlace_maps && (
        <a href={p.canchas.enlace_maps} target="_blank" rel="noreferrer" className="btn w-full">
          <Navigation size={18} /> Cómo llegar
        </a>
      )}
    </section>
  )
}