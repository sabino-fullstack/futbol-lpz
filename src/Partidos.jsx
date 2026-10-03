import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import ReservarForm from './ReservarForm'
import PantallaPago from './PantallaPago'
import BarraCupos from './BarraCupos'
import { bs, rangoHora, textoEquipos, fechaCorta } from './formato'

export default function Partidos({ perfil }) {
  const [partidos, setPartidos] = useState([])
  const [libres, setLibres] = useState({})
  const [error, setError] = useState(null)
  const [reservando, setReservando] = useState(null)
  const [pagoActivo, setPagoActivo] = useState(null)

  async function cargar() {
    const hoy = new Date().toLocaleDateString('en-CA')
    const { data, error } = await supabase
      .from('partidos')
      .select('*, canchas(nombre, enlace_maps, foto_url)')
      .neq('estado', 'cancelado')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
    if (error) return setError(error.message)
    setPartidos(data)

    // Cupos libres de cada posición, calculados por la base de datos
    const conteos = await Promise.all(
      data.map(async (p) => {
        const j = await supabase.rpc('cupos_libres', { p_partido: p.id, p_posicion: 'jugador' })
        const a = p.cupos_arco > 0
          ? await supabase.rpc('cupos_libres', { p_partido: p.id, p_posicion: 'arquero' })
          : { data: 0 }
        return { jugador: j.data ?? 0, arquero: a.data ?? 0 }
      })
    )
    const mapa = {}
    data.forEach((p, i) => { mapa[p.id] = conteos[i] })
    setLibres(mapa)
  }

  useEffect(() => { cargar() }, [])

  if (error) return <p>Error: {error}</p>

  if (pagoActivo) {
    return (
      <PantallaPago
        partido={pagoActivo.partido}
        grupoId={pagoActivo.grupoId}
        nombreJugador={perfil?.nombre ?? ''}
        onCerrar={() => { setPagoActivo(null); cargar() }}
      />
    )
  }

  if (reservando) {
    return (
      <ReservarForm
        partido={reservando}
        onCancelar={() => setReservando(null)}
        onListo={(grupoId) => {
          setPagoActivo({ partido: reservando, grupoId })
          setReservando(null)
        }}
      />
    )
  }

 return (
  <div className="space-y-4">
    <h2 className="text-xl font-bold">Próximos partidos</h2>
    {partidos.length === 0 && (
      <p className="text-suave">No hay partidos disponibles por ahora.</p>
    )}

    {partidos.map((p) => {
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
              <h3 className="text-lg font-bold">{p.cancha}</h3>
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

            <BarraCupos titulo="Jugadores" libres={l.jugador} total={p.cupos} />
            {p.cupos_arco > 0 && (
              <BarraCupos
                titulo={`Arqueros · ${bs(p.cuota_arquero)} Bs`}
                libres={l.arquero}
                total={p.cupos_arco}
              />
            )}

            {hayLugar && p.estado === 'abierto' ? (
              <button
                onClick={() => setReservando({ ...p, libres: l.jugador, libresArco: l.arquero })}
                className="w-full rounded-xl border-0 bg-verde py-3 text-base font-bold text-white"
              >
                Reservar cupo
              </button>
            ) : (
              <p className="rounded-xl bg-borde py-3 text-center font-semibold text-suave">
                Partido lleno
              </p>
            )}
          </div>
        </article>
      )
    })}
  </div>
)
}