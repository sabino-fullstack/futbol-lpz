import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import ReservarForm from './ReservarForm'
import PantallaPago from './PantallaPago'
import { bs, rangoHora, textoEquipos } from './formato'

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
    <div>
      <h2>Próximos partidos</h2>
      {partidos.length === 0 && <p>No hay partidos disponibles por ahora.</p>}
      {partidos.map((p) => {
        const l = libres[p.id] ?? { jugador: 0, arquero: 0 }
        const hayLugar = l.jugador > 0 || l.arquero > 0
        return (
          <div key={p.id}>
            {p.canchas?.foto_url && (
              <img
                src={p.canchas.foto_url}
                alt={`Cancha ${p.cancha}`}
                loading="lazy"
                style={{ width: '100%', maxWidth: 360, borderRadius: 8 }}
              />
            )}
            <h3>{p.cancha}</h3>
            <p>{p.fecha} · {rangoHora(p)}</p>
            {p.canchas?.enlace_maps && (
              <p>
                <a href={p.canchas.enlace_maps} target="_blank" rel="noreferrer">
                  📍 Cómo llegar
                </a>
              </p>
            )}
            {textoEquipos(p) && <p>{textoEquipos(p)}</p>}
            <p>Cuota: {bs(p.cuota)} Bs · Jugadores: {l.jugador} libres de {p.cupos}</p>
            {p.cupos_arco > 0 && (
              <p>
                Arqueros: {l.arquero} libres de {p.cupos_arco} · Cuota arquero: {bs(p.cuota_arquero)} Bs
              </p>
            )}
            {hayLugar && p.estado === 'abierto'
              ? <button onClick={() => setReservando({ ...p, libres: l.jugador, libresArco: l.arquero })}>
                  Reservar cupo
                </button>
              : <p>Partido lleno</p>}
          </div>
        )
      })}
    </div>
  )
}