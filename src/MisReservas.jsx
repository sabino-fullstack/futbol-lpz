import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import PantallaPago from './PantallaPago'

export default function MisReservas({ perfilId, nombreJugador }) {
  const [grupos, setGrupos] = useState([])
  const [error, setError] = useState(null)
  const [verPago, setVerPago] = useState(null)

  async function cargar() {
    const [r, p] = await Promise.all([
      supabase.from('reservas')
        .select('id, grupo_id, estado, vencimiento, nombre_invitado, partidos(id, cancha, fecha, hora, cuota)')
        .eq('creada_por', perfilId)
        .neq('estado', 'cancelado')
        .order('created_at', { ascending: false }),
      supabase.from('pagos')
        .select('grupo_id, estado')
        .in('estado', ['por_verificar', 'verificado']),
    ])
    const fallo = r.error || p.error
    if (fallo) return setError(fallo.message)

    // Junta los cupos que se reservaron juntos
    const porGrupo = {}
    r.data.forEach((fila) => {
      if (!porGrupo[fila.grupo_id]) {
        porGrupo[fila.grupo_id] = { grupoId: fila.grupo_id, partido: fila.partidos, filas: [] }
      }
      porGrupo[fila.grupo_id].filas.push(fila)
    })
    const pagos = {}
    p.data.forEach((x) => { pagos[x.grupo_id] = x.estado })

    setGrupos(Object.values(porGrupo).map((g) => ({ ...g, pago: pagos[g.grupoId] })))
  }

  useEffect(() => { cargar() }, [])

  function estadoDe(g) {
    if (g.pago === 'verificado') return { texto: '✅ Cupo confirmado', puedePagar: false }
    if (g.pago === 'por_verificar') return { texto: '⏳ Pago por verificar', puedePagar: true }
    const vigente = new Date(g.filas[0].vencimiento) > new Date()
    return vigente
      ? { texto: 'Reservado, falta pagar', puedePagar: true }
      : { texto: 'Venció (el cupo se liberó)', puedePagar: false }
  }

  if (verPago) {
    return (
      <PantallaPago
        partido={verPago.partido}
        grupoId={verPago.grupoId}
        nombreJugador={nombreJugador}
        onCerrar={() => { setVerPago(null); cargar() }}
      />
    )
  }

  return (
    <div>
      <h2>Mis reservas</h2>
      {error && <p>{error}</p>}
      {grupos.length === 0 && <p>Aún no tienes reservas.</p>}
      {grupos.map((g) => {
        const est = estadoDe(g)
        return (
          <div key={g.grupoId}>
            <h3>{g.partido.cancha} · {g.partido.fecha} · {g.partido.hora.slice(0, 5)}</h3>
            <p>{g.filas.length} cupo(s): {g.filas.map((f) => f.nombre_invitado ?? 'Yo').join(', ')}</p>
            <p>{est.texto}</p>
            {est.puedePagar && (
              <button onClick={() => setVerPago(g)}>Ver pago</button>
            )}
          </div>
        )
      })}
    </div>
  )
}