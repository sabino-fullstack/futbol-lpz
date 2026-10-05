import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from './supabaseClient'
import BarraCupos from './BarraCupos'
import ConsultarEncargado from './ConsultarEncargado'
import MiEstado from './MiEstado'
import {
  bs, rangoHora, textoEquipos, fechaCorta, inicioPartido, finPartido, enlaceCompartir,
} from './formato'
import { useVolver } from './navegacion'

const GRUPOS = [
  ['confirmado', 'Confirmados'],
  ['por_verificar', 'Pago por verificar'],
  ['reservado', 'Reservados, falta pagar'],
]

export default function DetallePartido() {
  const { partidoId } = useParams()
  const volver = useVolver('/partidos')
  const [datos, setDatos] = useState(null) // null = cargando
  const [error, setError] = useState(null)

  async function cargar() {
    setError(null)
    const [p, lj, la, li, me] = await Promise.all([
      supabase.from('partidos')
        .select('*, canchas(nombre, enlace_maps, foto_url), encargados(id, perfiles(nombre, apellido, apodo, whatsapp))')
        .eq('id', partidoId).maybeSingle(),
      supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'jugador' }),
      supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'arquero' }),
      supabase.rpc('lista_partido', { p_partido: partidoId }),
      supabase.rpc('mis_estados'),
    ])
    if (p.error || !p.data || p.data.estado === 'cancelado') return setDatos({ fallo: true })
    if (lj.error || li.error) setError('No pudimos cargar toda la información. Toca Actualizar.')
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

  if (!datos) return <p className="text-suave">Cargando...</p>
  if (datos.fallo) {
    return (
      <div className="space-y-3">
        <p>Este partido no está disponible.</p>
        <button onClick={volver}>← Volver</button>
      </div>
    )
  }

  const { partido: p, libres, lista, mi } = datos
  const empezo = inicioPartido(p).getTime() <= Date.now()
  const terminado = finPartido(p).getTime() < Date.now()
  const hayLugar = libres.jugador > 0 || libres.arquero > 0
  const puedeReservar = p.estado === 'abierto' && !empezo && hayLugar

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={volver}>← Volver</button>
        <button onClick={cargar}>Actualizar</button>
      </div>
      {error && <p className="text-rojo">{error}</p>}

      <article className="overflow-hidden rounded-2xl border border-borde bg-tarjeta shadow-sm">
        {p.canchas?.foto_url && (
          <img src={p.canchas.foto_url} alt={`Cancha ${p.cancha}`} className="h-48 w-full object-cover" />
        )}
        <div className="space-y-3 p-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-xl font-bold">{p.cancha}</h2>
              {p.modalidad && (
                <span className="shrink-0 rounded-full bg-verde px-2.5 py-0.5 text-xs font-bold text-white">
                  {p.modalidad}
                </span>
              )}
            </div>
            <p className="text-suave first-letter:uppercase">
              {fechaCorta(p.fecha)} · {rangoHora(p)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-bold text-verde">{bs(p.cuota)} Bs</span>
            {textoEquipos(p) && <span className="text-suave">{textoEquipos(p)}</span>}
            {p.canchas?.enlace_maps && (
              <a href={p.canchas.enlace_maps} target="_blank" rel="noreferrer">📍 Cómo llegar</a>
            )}
          </div>

          <BarraCupos titulo="Jugadores" libres={libres.jugador} total={p.cupos} />
          {p.cupos_arco > 0 && (
            <BarraCupos
              titulo={`Arqueros · ${bs(p.cuota_arquero)} Bs`}
              libres={libres.arquero}
              total={p.cupos_arco}
            />
          )}

          <MiEstado estado={mi} />
          <ConsultarEncargado encargados={p.encargados} partido={p} />

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

          <a href={enlaceCompartir(p)} target="_blank" rel="noreferrer" className="btn w-full">
            Compartir por WhatsApp
          </a>
        </div>
      </article>

      <section className="space-y-3">
        <h3 className="text-lg font-bold">Lista de jugadores ({lista.length})</h3>
        {lista.length === 0 && <p className="text-suave">Todavía nadie se anotó.</p>}

        {GRUPOS.map(([clave, titulo]) => {
          const items = lista.filter((x) => x.estado === clave)
          if (items.length === 0) return null
          return (
            <div key={clave} className="space-y-1">
              <h4 className="font-semibold">{titulo} ({items.length})</h4>
              <ol className="space-y-1">
                {items.map((x, i) => (
                  <li
                    key={x.orden}
                    className={`flex items-center justify-between rounded-lg border bg-tarjeta px-3 py-2 ${
                      x.es_mio ? 'border-verde' : 'border-borde'
                    }`}
                  >
                    <span>{i + 1}. {x.nombre}{x.posicion === 'arquero' && ' 🧤'}</span>
                    <span className="text-sm text-suave">
                      {x.es_mio ? 'Tú' : x.es_mi_grupo ? 'Tu grupo' : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </section>
    </div>
  )
}