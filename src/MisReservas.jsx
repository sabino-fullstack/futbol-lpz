import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from './supabaseClient'
import { bs, rangoHora, inicioPartido, finPartido, fechaCorta } from './formato'

function esTardia(p) {
  const limite = inicioPartido(p).getTime() - p.horas_cancelacion * 3600 * 1000
  return Date.now() > limite
}

export default function MisReservas({ perfilId }) {
  const [grupos, setGrupos] = useState([])
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [cuenta, setCuenta] = useState({ faltas: 0, revision: false })  

  async function cargar() {
    const [r, p] = await Promise.all([
      supabase.from('reservas')
        .select('id, grupo_id, estado, vencimiento, nombre_invitado, posicion, precio, partidos(id, cancha, fecha, hora, hora_fin, cuota, horas_cancelacion, canchas(enlace_maps))')
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
    setCargado(true)
  }

  useEffect(() => { cargar() }, [])
  useEffect(() => {
  Promise.all([
    supabase.rpc('mis_faltas'),
    supabase.from('perfiles').select('en_revision').eq('id', perfilId).single(),
  ]).then(([f, p]) => setCuenta({ faltas: f.data ?? 0, revision: p.data?.en_revision === true }))
}, [perfilId])

  function estadoDe(g) {
    if (g.pago?.estado === 'verificado') return { texto: '✅ Cupo confirmado', clase: 'text-verde', puedePagar: false }
    if (g.pago?.estado === 'por_verificar') return { texto: '⏳ Pago por verificar', clase: 'text-amarillo', puedePagar: true }
    const vigente = new Date(g.filas[0].vencimiento) > new Date()
    return vigente
      ? { texto: 'Reservado, falta pagar', clase: 'text-amarillo', puedePagar: true }
      : { texto: 'Venció (el cupo se liberó)', clase: 'text-suave', puedePagar: false }
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
        `de ${bs(fila.precio)} Bs. ¿Cancelar?`
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
      setAviso(`Cupo cancelado. El encargado coordinará contigo la devolución de ${bs(data.monto)} Bs.`)
    } else {
      setAviso('Cupo cancelado.')
    }
    cargar()
  }

  if (!cargado && !error) return <p className="text-suave">Cargando...</p>

  const ahora = Date.now()
  const proximas = grupos
    .filter((g) => finPartido(g.partido).getTime() >= ahora)
    .sort((a, b) => inicioPartido(a.partido) - inicioPartido(b.partido))
  const pasadas = grupos
    .filter((g) => finPartido(g.partido).getTime() < ahora)
    .sort((a, b) => inicioPartido(b.partido) - inicioPartido(a.partido))

  function tarjeta(g) {
    const est = estadoDe(g)
    const yaEmpezo = inicioPartido(g.partido) <= new Date()
    return (
      <div key={g.grupoId} className="tarjeta space-y-2">
        <div>
          <h3 className="text-lg font-bold">{g.partido.cancha}</h3>
          <p className="text-suave first-letter:uppercase">
            {fechaCorta(g.partido.fecha)} · {rangoHora(g.partido)}
          </p>
        </div>
        <p className={`text-lg font-semibold ${est.clase}`}>{est.texto}</p>

        <ul className="space-y-2">
          {g.filas.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2">
              <span>
                {f.nombre_invitado ?? 'Yo'}{f.posicion === 'arquero' && ' 🧤'}
              </span>
              {!yaEmpezo && <button onClick={() => cancelar(f, g)}>Cancelar</button>}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 pt-1">
          {est.puedePagar && <Link to={`/pago/${g.grupoId}`} className="btn btn-activo">Ver pago</Link>}
          {g.partido.canchas?.enlace_maps && (
            <a href={g.partido.canchas.enlace_maps} target="_blank" rel="noreferrer" className="btn">
              📍 Cómo llegar
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Mis reservas</h2>
      {cuenta.revision && (
  <p className="aviso aviso-error">
    🔎 Tu cuenta está en revisión por inasistencias. No puedes reservar hasta que un encargado
    la apruebe: escríbele por WhatsApp.
  </p>
)}
{!cuenta.revision && cuenta.faltas === 1 && (
  <p className="aviso aviso-alerta">
    Tienes 1 inasistencia en los últimos 90 días. Con la segunda, tu cuenta quedará en revisión.
    Si no puedes ir, cancela tu cupo a tiempo.
  </p>
)}
      {error && <p className="aviso aviso-error">{error}</p>}
      {aviso && <p className="aviso aviso-ok">{aviso}</p>}

      {cargado && grupos.length === 0 && (
        <p className="text-suave">Aún no tienes reservas. Mira los partidos y reserva tu cupo.</p>
      )}
      {cargado && grupos.length > 0 && proximas.length === 0 && (
        <p className="text-suave">No tienes reservas para próximos partidos.</p>
      )}

      {proximas.map(tarjeta)}

      {pasadas.length > 0 && (
        <details>
          <summary className="cursor-pointer py-2 font-semibold">Partidos pasados ({pasadas.length})</summary>
          <div className="space-y-3 pt-2">{pasadas.map(tarjeta)}</div>
        </details>
      )}
    </div>
  )
}