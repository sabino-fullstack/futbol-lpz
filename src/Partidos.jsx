import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import ReservarForm from './ReservarForm'
import PantallaPago from './PantallaPago'

export default function Partidos({ perfil }) {
  const [partidos, setPartidos] = useState([])
  const [ocupados, setOcupados] = useState({})
  const [error, setError] = useState(null)
  const [reservando, setReservando] = useState(null)
  const [pagoActivo, setPagoActivo] = useState(null)

  async function cargar() {
    const hoy = new Date().toLocaleDateString('en-CA') // formato AAAA-MM-DD
    const { data, error } = await supabase
      .from('partidos')
      .select('*')
      .neq('estado', 'cancelado')
      .gte('fecha', hoy)
      .order('fecha', { ascending: true })
    if (error) return setError(error.message)
    setPartidos(data)

    // Pregunta a la base de datos cuántos cupos hay ocupados en cada partido
    const conteos = await Promise.all(
      data.map((p) => supabase.rpc('cupos_ocupados', { p_partido: p.id }))
    )
    const mapa = {}
    data.forEach((p, i) => { mapa[p.id] = conteos[i].data ?? 0 })
    setOcupados(mapa)
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
        const libres = p.cupos - (ocupados[p.id] ?? 0)
        return (
          <div key={p.id}>
            <h3>{p.cancha}</h3>
            <p>{p.fecha} · {p.hora.slice(0, 5)}</p>
            <p>Cuota: {p.cuota} Bs · Cupos disponibles: {libres} de {p.cupos}</p>
            {libres > 0 && p.estado === 'abierto'
              ? <button onClick={() => setReservando(p)}>Reservar cupo</button>
              : <p>Partido lleno</p>}
          </div>
        )
      })}
    </div>
  )
}