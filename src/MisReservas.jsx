import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import PantallaPago from './PantallaPago'

// Bolivia no cambia de horario: siempre es UTC-4
function inicioPartido(p) {
  return new Date(`${p.fecha}T${p.hora}-04:00`)
}
function esTardia(p) {
  const limite = inicioPartido(p).getTime() - p.horas_cancelacion * 3600 * 1000
  return Date.now() > limite
}

export default function MisReservas({ perfilId, nombreJugador }) {
  const [grupos, setGrupos] = useState([])
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [verPago, setVerPago] = useState(null)

  async function cargar() {
    const [r, p] = await Promise.all([
      supabase.from('reservas')
        .select('id, grupo_id, estado, vencimiento, nombre_invitado, partidos(id, cancha, fecha, hora, cuota, horas_cancelacion)')
        .eq('creada_por', perfilId)
        .neq('estado', 'cancelado')
        .order('created_at', { ascending: false }),
      supabase.from('pagos')
        .select('grupo_id, estado, metodo')
        .in('estado', ['por_verificar', 'verificado']),
    ])
    const fallo = r.error || p.error
    if (fallo) return setError(fallo.message)

    const porGrupo = {}
    r.data.forEach((fila) => {
      if (!porGrupo[fila.grupo_id]) {
        porGrupo[fila.grupo_id] = { grupoId: fila.grupo_id, partido: fila.partidos, filas: [] }
      }
      porGrupo[fila.grupo_id].filas.push(fila)
    })
    const pagos = {}
    p.data.forEach((x) => { pagos[x.grupo_id] = x })

    setGrupos(Object.values(porGrupo).map((g) => ({ ...g, pago: pagos[g.grupoId] })))
  }

  useEffect(() => { cargar() }, [])

  function estadoDe(g) {
    if (g.pago?.estado === 'verificado') return { texto: '✅ Cupo confirmado', puedePagar: false }
    if (g.pago?.estado === 'por_verificar') return { texto: '⏳ Pago por verificar', puedePagar: true }
    const vigente = new Date(g.filas[0].vencimiento) > new Date()
    return vigente
      ? { texto: 'Reservado, falta pagar', puedePagar: true }
      : { texto: 'Venció (el cupo se liberó)', puedePagar: false }
  }

  async function cancelar(fila, g) {
    setError(null)
    setAviso(null)
    const pagado = !!g.pago && g.pago.metodo !== 'bonificado'
    const tardia = esTardia(g.partido)
    const horas = g.partido.horas_cancelacion

    let texto = '¿Cancelar este cupo?'
    if (pagado && tardia) {
      texto =
        `Faltan menos de ${horas} horas para el partido. Si cancelas ahora, ` +
        `NO se te devolverá el dinero y tu cupo se liberará. ¿Cancelar de todas formas?`
    } else if (pagado) {
      texto =
        `Tu cupo se liberará y el encargado coordinará contigo la devolución ` +
        `de ${g.partido.cuota} Bs. ¿Cancelar?`
    }
    if (!window.confirm(texto)) return

    const { data, error } = await supabase.rpc('cancelar_cupo', {
      p_reserva: fila.id,
      p_confirmo_tardia: pagado && tardia,
    })
    if (error) {
      if (error.message.includes('CANCELACION_TARDIA')) {
        return setError('Mientras decidías pasó el plazo de devolución. Toca cancelar otra vez para ver el aviso actualizado.')
      }
      return setError(error.message)
    }

    if (data.pagado && data.tardia) {
      setAviso('Cupo cancelado. Por haber cancelado fuera de plazo, no corresponde devolución.')
    } else if (data.pagado) {
      setAviso(`Cupo cancelado. El encargado coordinará contigo la devolución de ${data.monto} Bs.`)
    } else {
      setAviso('Cupo cancelado.')
    }
    cargar()
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
      {aviso && <p>{aviso}</p>}
      {grupos.length === 0 && <p>Aún no tienes reservas.</p>}

      {grupos.map((g) => {
        const est = estadoDe(g)
        const yaEmpezo = inicioPartido(g.partido) <= new Date()
        return (
          <div key={g.grupoId}>
            <h3>{g.partido.cancha} · {g.partido.fecha} · {g.partido.hora.slice(0, 5)}</h3>
            <p>{est.texto}</p>

            {g.filas.map((f) => (
              <div key={f.id}>
                {f.nombre_invitado ?? 'Yo'}{' '}
                {!yaEmpezo && (
                  <button onClick={() => cancelar(f, g)}>Cancelar este cupo</button>
                )}
              </div>
            ))}

            {est.puedePagar && (
              <button onClick={() => setVerPago(g)}>Ver pago</button>
            )}
          </div>
        )
      })}
    </div>
  )
}