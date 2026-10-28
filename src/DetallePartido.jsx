import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  Banknote, ChevronDown, ChevronLeft, Clock, Hand, ListChecks, MapPin, Navigation,
  RefreshCw, Share2, StickyNote, Trophy, Users,
} from 'lucide-react'
import { supabase } from './supabaseClient'
import BarraCupos from './BarraCupos'
import ConsultarEncargado from './ConsultarEncargado'
import MiEstado from './MiEstado'
import Cargando from './Cargando'
import PieApp from './PieApp'
import {
  bs, rangoHora, textoEquipos, fechaCorta, inicioPartido, finPartido,
  enlaceCompartir, quienGanaPremio,
} from './formato'
import { useVolver } from './navegacion'

const GRUPOS = [
  ['confirmado', 'Confirmados'],
  ['por_verificar', 'Pago por verificar'],
  ['reservado', 'Reservados, falta pagar'],
]

function Seccion({ icono: Icono, titulo, abierta = false, children }) {
  return (
    <details open={abierta} className="tarjeta group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        <Icono size={18} className="shrink-0 text-verde" />
        <span className="flex-1">{titulo}</span>
        <ChevronDown size={18} className="text-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  )
}

export default function DetallePartido() {
  const { partidoId } = useParams()
  const volver = useVolver('/partidos')
  const [datos, setDatos] = useState(null) // null = cargando
  const [error, setError] = useState(null)

  async function cargar() {
    setError(null)
    const [p, lj, la, li, me] = await Promise.all([
      supabase.from('partidos')
        .select('*, canchas(nombre, enlace_maps, foto_url, direccion, referencia, recomendaciones), encargados(id, perfiles(nombre, apellido, apodo, whatsapp))')
        .eq('id', partidoId).maybeSingle(),
      supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'jugador' }),
      supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'arquero' }),
      supabase.rpc('lista_partido', { p_partido: partidoId }),
      supabase.rpc('mis_estados'),
    ])
    if (p.error || !p.data || p.data.estado === 'cancelado') return setDatos({ fallo: true })
    if (lj.error || li.error) setError('No pudimos cargar toda la información. Toca actualizar.')
    setDatos({
      partido: p.data,
      libres: {
        jugador: lj.data ?? 0,
        arquero: p.data.cupos_arco > 0 ? (la.data ?? 0) : 0,
      },
      lista: li.data ?? [],
      mi: (me.data ?? []).find((x) => x.partido_id === partidoId) ?? null,
    })
  }

  useEffect(() => { cargar() }, [partidoId])

  if (!datos) return <Cargando />
  if (datos.fallo) {
    return (
      <div className="space-y-3">
        <p>Este partido no está disponible.</p>
        <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>
      </div>
    )
  }

  const { partido: p, libres, lista, mi } = datos
  const c = p.canchas
  const empezo = inicioPartido(p).getTime() <= Date.now()
  const terminado = finPartido(p).getTime() < Date.now()
  const hayLugar = libres.jugador > 0 || libres.arquero > 0
  const puedeReservar = p.estado === 'abierto' && !empezo && hayLugar
  const hayLlegar = c && (c.direccion || c.referencia || c.enlace_maps || c.recomendaciones)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>
        <button onClick={cargar} aria-label="Actualizar" className="btn btn-icono">
          <RefreshCw size={18} />
        </button>
      </div>
      {error && <p className="aviso aviso-error">{error}</p>}

      <article className="overflow-hidden rounded-2xl border border-borde bg-tarjeta shadow-sm">
        {c?.foto_url && (
          <img
            src={c.foto_url}
            alt={`Cancha ${p.cancha}`}
            className="h-44 w-full object-cover object-center"
          />
        )}
        <div className="space-y-3 p-4">
          <div className="space-y-1.5">
            {p.modalidad && (
              <span className="inline-block rounded-full bg-verde/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-verde">
                {p.modalidad}
              </span>
            )}
            <h2 className="font-display text-3xl font-bold uppercase leading-none">{p.cancha}</h2>
            <p className="text-suave first-letter:uppercase">{fechaCorta(p.fecha)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-lg font-bold tabular-nums">
            <span className="flex items-center gap-1.5">
              <Clock size={18} className="text-verde" /> {rangoHora(p)}
            </span>
            <span className="flex items-center gap-1.5">
              <Banknote size={18} className="text-verde" /> {bs(p.cuota)} Bs
            </span>
            {textoEquipos(p) && (
              <span className="flex items-center gap-1.5 text-base font-semibold text-suave">
                <Users size={17} /> {textoEquipos(p)}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            <BarraCupos titulo="Jugadores" libres={libres.jugador} total={p.cupos} />
            {p.cupos_arco > 0 && (
              <BarraCupos
                titulo={`Arqueros · ${bs(p.cuota_arquero)} Bs`}
                libres={libres.arquero}
                total={p.cupos_arco}
              />
            )}
          </div>

          <MiEstado estado={mi} />

          {puedeReservar ? (
            <Link to={`/partidos/${p.id}/reservar`} className="btn btn-primario">
              Reservar cupo
            </Link>
          ) : (
            <p className="rounded-xl bg-borde py-3 text-center font-semibold text-suave">
              {terminado ? 'Este partido ya terminó'
                : empezo ? 'El partido ya comenzó'
                : p.estado !== 'abierto' ? 'Este partido no acepta reservas'
                : 'Partido lleno'}
            </p>
          )}

          <div className="flex gap-2">
            {c?.enlace_maps && (
              <a href={c.enlace_maps} target="_blank" rel="noreferrer" className="btn flex-1">
                <Navigation size={18} /> Cómo llegar
              </a>
            )}
            <a href={enlaceCompartir(p)} target="_blank" rel="noreferrer" className="btn flex-1">
              <Share2 size={18} /> Compartir
            </a>
          </div>

          <ConsultarEncargado encargados={p.encargados} partido={p} />
        </div>
      </article>

      {(p.premio || p.formato_juego || hayLlegar || p.notas) && (
        <section className="space-y-2">
          {p.premio && (
            <Seccion icono={Trophy} titulo="Premio" abierta>
              <p className="break-words font-semibold">{p.premio}</p>
              <p className="text-sm text-suave">{quienGanaPremio(p)}</p>
            </Seccion>
          )}
          {p.formato_juego && (
            <Seccion icono={ListChecks} titulo="Cómo se juega">
              <p className="whitespace-pre-line break-words">{p.formato_juego}</p>
            </Seccion>
          )}
          {hayLlegar && (
            <Seccion icono={MapPin} titulo="Cómo llegar y recomendaciones">
              <div className="space-y-2">
                {c.direccion && <p className="break-words">{c.direccion}</p>}
                {c.referencia && <p className="break-words text-suave">{c.referencia}</p>}
                {c.recomendaciones && (
                  <p className="whitespace-pre-line break-words">{c.recomendaciones}</p>
                )}
              </div>
            </Seccion>
          )}
          {p.notas && (
            <Seccion icono={StickyNote} titulo="Notas de este partido" abierta>
              <p className="whitespace-pre-line break-words">{p.notas}</p>
            </Seccion>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-xl">
          <Users size={20} className="text-verde" /> Lista de jugadores ({lista.length})
        </h3>
        {lista.length === 0 && <p className="text-suave">Todavía nadie se anotó.</p>}

        {GRUPOS.map(([clave, titulo]) => {
          const items = lista.filter((x) => x.estado === clave)
          if (items.length === 0) return null
          return (
            <div key={clave} className="space-y-1.5">
              <h4 className="text-sm font-semibold text-suave">{titulo} ({items.length})</h4>
              <ol className="space-y-1.5">
                {items.map((x, i) => (
                  <li
                    key={x.orden}
                    className={`flex items-center gap-2 rounded-lg border bg-tarjeta px-3 py-2 ${
                      x.es_mio ? 'border-verde' : 'border-borde'
                    }`}
                  >
                    <span className="w-6 text-sm tabular-nums text-suave">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{x.nombre}</span>
                    {x.posicion === 'arquero' && (
                      <Hand size={16} className="shrink-0 text-suave" aria-label="Arquero" />
                    )}
                    {(x.es_mio || x.es_mi_grupo) && (
                      <span className="shrink-0 rounded-full bg-verde/15 px-2 py-0.5 text-xs font-bold text-verde">
                        {x.es_mio ? 'Tú' : 'Tu grupo'}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </section>

      <PieApp />
    </div>
  )
}