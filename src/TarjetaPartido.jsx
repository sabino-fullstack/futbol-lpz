import { Link } from 'react-router'
import { Banknote, ChevronRight, Clock, MapPin, MessageCircle, Trophy, Users } from 'lucide-react'
import BarraCupos from './BarraCupos'
import MiEstado from './MiEstado'
import { bs, rangoHora, quienGanaPremio, enlaceConsulta } from './formato'

export default function TarjetaPartido({ p, libres, miEstado }) {
  const hayLugar = libres.jugador > 0 || libres.arquero > 0
  const abierto = hayLugar && p.estado === 'abierto'
  const encargado = (p.encargados ?? []).find((e) => e.perfiles?.whatsapp)
  const foto = p.canchas?.foto_url

  return (
    <article className="overflow-hidden rounded-2xl border border-borde bg-tarjeta shadow-sm">
      <Link
        to={`/partidos/${p.id}`}
        className="grid min-h-[8.5rem] grid-cols-[minmax(0,1fr)_9.5rem] text-texto no-underline min-[400px]:grid-cols-[minmax(0,1fr)_11rem]"
      >
        <div className="min-w-0 space-y-1.5 p-3">
          {p.modalidad && (
            <span className="inline-block rounded-full bg-verde/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-verde">
              {p.modalidad}
            </span>
          )}
          <h4 className="font-display text-2xl font-bold uppercase leading-none tracking-wide">
            {p.cancha}
          </h4>
          <p className="flex items-center gap-1.5 text-lg font-bold tabular-nums">
            <Clock size={17} className="shrink-0 text-verde" />
            {rangoHora(p)}
          </p>
          <p className="flex items-center gap-1.5 text-lg font-bold tabular-nums">
            <Banknote size={17} className="shrink-0 text-verde" />
            {bs(p.cuota)} Bs
          </p>
          {p.equipos ? (
            <p className="flex items-center gap-1.5 text-sm text-suave">
              <Users size={15} className="shrink-0" />
              {p.equipos} equipos
            </p>
          ) : null}
        </div>

        <div className="relative bg-borde">
          {foto ? (
            <img
              src={foto}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : (
            <div className="grid h-full place-items-center text-suave">
              <MapPin size={28} />
            </div>
          )}
          <span className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white">
            <ChevronRight size={16} />
          </span>
        </div>
      </Link>

      <div className="space-y-2.5 px-3 pb-3 pt-2.5">
        {p.premio && (
          <p className="flex items-center gap-1.5 text-sm">
            <Trophy size={16} className="shrink-0 text-amarillo" />
            <span className="min-w-0 truncate">
              <strong>{p.premio}</strong> · {quienGanaPremio(p)}
            </span>
          </p>
        )}

        <BarraCupos titulo="Jugadores" libres={libres.jugador} total={p.cupos} />
        {p.cupos_arco > 0 && (
          <BarraCupos
            titulo={`Arqueros · ${bs(p.cuota_arquero)} Bs`}
            libres={libres.arquero}
            total={p.cupos_arco}
          />
        )}

        {miEstado && <MiEstado estado={miEstado} />}

        <div className="flex items-center gap-2">
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
              <MessageCircle size={18} /> Consultar
            </a>
          )}
        </div>
      </div>
    </article>
  )
}