import { Link } from 'react-router'
import { ChevronRight, MapPin, MessageCircle, Trophy } from 'lucide-react'
import BarraCupos from './BarraCupos'
import MiEstado from './MiEstado'
import { bs, rangoHora, quienGanaPremio, enlaceConsulta } from './formato'

export default function TarjetaPartido({ p, libres, miEstado }) {
  const hayLugar = libres.jugador > 0 || libres.arquero > 0
  const abierto = hayLugar && p.estado === 'abierto'
  const encargado = (p.encargados ?? []).find((e) => e.perfiles?.whatsapp)
  const foto = p.canchas?.foto_url

  return (
    <article className="rounded-2xl border border-borde bg-tarjeta p-3 shadow-sm">
      <Link to={`/partidos/${p.id}`} className="flex items-center gap-3 text-texto no-underline">
        {foto ? (
          <img src={foto} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-borde text-suave">
            <MapPin size={22} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-display text-xl font-bold uppercase leading-none tracking-wide">
              {p.cancha}
            </h4>
            {p.modalidad && (
              <span className="shrink-0 rounded-full bg-verde/15 px-2 py-0.5 text-[11px] font-bold uppercase text-verde">
                {p.modalidad}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-suave">
            {rangoHora(p)} · <span className="font-bold text-texto">{bs(p.cuota)} Bs</span>
            {p.equipos ? ` · ${p.equipos} equipos` : ''}
          </p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-suave" />
      </Link>

      {p.premio && (
        <p className="mt-2 flex items-center gap-1.5 text-sm">
          <Trophy size={15} className="shrink-0 text-amarillo" />
          <span className="truncate">
            <strong>{p.premio}</strong> · {quienGanaPremio(p)}
          </span>
        </p>
      )}

      <div className="mt-3 space-y-2">
        <BarraCupos titulo="Jugadores" libres={libres.jugador} total={p.cupos} />
        {p.cupos_arco > 0 && (
          <BarraCupos
            titulo={`Arqueros · ${bs(p.cuota_arquero)} Bs`}
            libres={libres.arquero}
            total={p.cupos_arco}
          />
        )}
      </div>

      {miEstado && (
        <div className="mt-2.5">
          <MiEstado estado={miEstado} />
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {abierto ? (
          <Link to={`/partidos/${p.id}/reservar`} className="btn btn-primario flex-1">
            Reservar cupo
          </Link>
        ) : (
          <p className="flex-1 rounded-xl bg-borde py-2.5 text-center font-semibold text-suave">
            Partido lleno
          </p>
        )}
        {encargado && (
          <a
            href={enlaceConsulta(encargado.perfiles.whatsapp, p)}
            target="_blank"
            rel="noreferrer"
            className="btn shrink-0"
          >
            <MessageCircle size={18} /> <span>Consultar</span>
          </a>
        )}
      </div>
    </article>
  )
}