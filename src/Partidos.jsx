import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from './supabaseClient'
import BarraCupos from './BarraCupos'
import ConsultarEncargado from './ConsultarEncargado'
import MiEstado from './MiEstado'
import { bs, rangoHora, textoEquipos, hoyBolivia, etiquetaDia, inicioPartido } from './formato'

export default function Partidos() {
  const [partidos, setPartidos] = useState([])
  const [libres, setLibres] = useState({})
  const [misEstados, setMisEstados] = useState({})
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)

  async function cargar() {
    const { data: todos, error } = await supabase
      .from('partidos')
      .select('*, canchas(nombre, enlace_maps, foto_url), encargados(id, perfiles(nombre, apellido, apodo, whatsapp))')
      .neq('estado', 'cancelado')
      .gte('fecha', hoyBolivia())
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })
    if (error) return setError(error.message)

    // Los partidos de hoy que ya empezaron dejan de aparecer
    const data = todos.filter((p) => inicioPartido(p).getTime() > Date.now())
    setPartidos(data)

    const [conteos, me] = await Promise.all([
      Promise.all(
        data.map(async (p) => {
          const j = await supabase.rpc('cupos_libres', { p_partido: p.id, p_posicion: 'jugador' })
          const a = p.cupos_arco > 0
            ? await supabase.rpc('cupos_libres', { p_partido: p.id, p_posicion: 'arquero' })
            : { data: 0 }
          return { jugador: j.data ?? 0, arquero: a.data ?? 0 }
        })
      ),
      supabase.rpc('mis_estados'),
    ])
    const mapa = {}
    data.forEach((p, i) => { mapa[p.id] = conteos[i] })
    setLibres(mapa)

    const estados = {}
    ;(me.data ?? []).forEach((x) => { estados[x.partido_id] = x })
    setMisEstados(estados)
    setCargado(true)
  }

  useEffect(() => { cargar() }, [])

  if (error) return <p className="text-rojo">Error: {error}</p>
  if (!cargado) return <p className="text-suave">Cargando partidos...</p>

  const dias = []
  partidos.forEach((p) => {
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.fecha === p.fecha) ultimo.items.push(p)
    else dias.push({ fecha: p.fecha, items: [p] })
  })

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Próximos partidos</h2>
      {partidos.length === 0 && (
        <p className="text-suave">No hay partidos disponibles por ahora.</p>
      )}

      {dias.map((dia) => {
        const et = etiquetaDia(dia.fecha)
        return (
          <section key={dia.fecha} className="space-y-3">
            <div className="flex items-baseline gap-2 border-b border-borde pb-1">
              <h3 className={`text-lg font-bold ${et.titulo === 'Hoy' ? 'text-verde' : ''}`}>
                {et.titulo}
              </h3>
              <span className="text-sm text-suave">{et.detalle}</span>
            </div>

            {dia.items.map((p) => {
              const l = libres[p.id] ?? { jugador: 0, arquero: 0 }
              const hayLugar = l.jugador > 0 || l.arquero > 0
              return (
                <article key={p.id} className="overflow-hidden rounded-2xl border border-borde bg-tarjeta shadow-sm">
                  {p.canchas?.foto_url && (
                    <img
                      src={p.canchas.foto_url}
                      alt={`Cancha ${p.cancha}`}
                      loading="lazy"
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <div className="space-y-3 p-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-lg font-bold">{p.cancha}</h4>
                        {p.modalidad && (
                          <span className="shrink-0 rounded-full bg-verde px-2.5 py-0.5 text-xs font-bold text-white">
                            {p.modalidad}
                          </span>
                        )}
                      </div>
                      <p className="text-suave">{rangoHora(p)}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-bold text-verde">{bs(p.cuota)} Bs</span>
                      {textoEquipos(p) && <span className="text-suave">{textoEquipos(p)}</span>}
                      {p.canchas?.enlace_maps && (
                        <a href={p.canchas.enlace_maps} target="_blank" rel="noreferrer">📍 Cómo llegar</a>
                      )}
                    </div>

                    <BarraCupos titulo="Jugadores" libres={l.jugador} total={p.cupos} />
                    {p.cupos_arco > 0 && (
                      <BarraCupos
                        titulo={`Arqueros · ${bs(p.cuota_arquero)} Bs`}
                        libres={l.arquero}
                        total={p.cupos_arco}
                      />
                    )}

                    <MiEstado estado={misEstados[p.id]} />
                    <ConsultarEncargado encargados={p.encargados} partido={p} />

                    {hayLugar && p.estado === 'abierto' ? (
                      <Link to={`/partidos/${p.id}/reservar`} className="btn btn-primario">
                        Reservar cupo
                      </Link>
                    ) : (
                      <p className="rounded-xl bg-borde py-3 text-center font-semibold text-suave">
                        Partido lleno
                      </p>
                    )}

                    <Link to={`/partidos/${p.id}`} className="block text-center text-sm">
                      Ver detalle y lista de jugadores
                    </Link>
                  </div>
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}