import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Info, MapPin, QrCode } from 'lucide-react'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import Etiqueta, { BORDE_IZQ, colorDeEstado } from './EtiquetaEstado'
import { bs, rangoHora, inicioPartido, finPartido, fechaCorta } from './formato'

function esTardia(p) {
  const limite = inicioPartido(p).getTime() - p.horas_cancelacion * 3600 * 1000
  return Date.now() > limite
}

// Estado de una reserva desde el punto de vista del jugador
function claveGrupo(g) {
  if (g.filas.some((f) => f.estado === 'confirmado')) {
    if (g.pago?.metodo === 'cancha') {
      const pendientes = g.filas.some((f) => f.estado === 'confirmado' && !f.cobrado_en)
      return pendientes ? 'jug_cancha' : 'confirmado'
    }
    return 'confirmado'
  }
  if (g.pago?.estado === 'por_verificar') return 'por_verificar'
  if (new Date(g.filas[0].vencimiento).getTime() <= Date.now()) return 'vencido'
  return g.pago?.estado === 'rechazado' ? 'rechazado' : 'reservado'
}

export default function MisReservas({ perfilId }) {
  const [grupos, setGrupos] = useState([])
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [cuenta, setCuenta] = useState({ faltas: 0, revision: false })
const [canceladas, setCanceladas] = useState([])

async function cargar() {
  const hace30 = new Date(Date.now() - 30 * 86400000).toISOString()
  // 3 consultas y 3 variables, en el mismo orden
  const [r, p, c] = await Promise.all([
    supabase.from('reservas')
      .select('id, grupo_id, estado, vencimiento, nombre_invitado, posicion, precio, cobrado_en, partidos(id, cancha, fecha, hora, hora_fin, cuota, horas_cancelacion, canchas(enlace_maps))')
      .eq('creada_por', perfilId)
      .neq('estado', 'cancelado')
      .order('created_at', { ascending: false }),
    supabase.from('pagos')
      .select('grupo_id, estado, metodo, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('reservas')
      .select('id, nombre_invitado, posicion, monto_pagado, devolucion_estado, cancelada_en, partidos(id, cancha, fecha, hora, hora_fin, cancelado_motivo)')
      .eq('creada_por', perfilId)
      .eq('cancelacion_tipo', 'partido_cancelado')
      .gte('cancelada_en', hace30)
      .order('cancelada_en', { ascending: false }),
  ])
  const fallo = r.error || p.error || c.error
  if (fallo) return setError(fallo.message)

  const porGrupo = {}
  r.data.forEach((fila) => {
    if (!porGrupo[fila.grupo_id]) {
      porGrupo[fila.grupo_id] = { grupoId: fila.grupo_id, partido: fila.partidos, filas: [] }
    }
    porGrupo[fila.grupo_id].filas.push(fila)
  })
  const pagos = {}
  p.data.forEach((x) => { pagos[x.grupo_id] = x }) // el último pago de cada grupo es el que manda
  setGrupos(Object.values(porGrupo).map((g) => ({ ...g, pago: pagos[g.grupoId] })))

  // Partidos cancelados: una tarjeta por partido
  const porPartido = {}
  c.data.forEach((fila) => {
    const id = fila.partidos.id
    if (!porPartido[id]) porPartido[id] = { partido: fila.partidos, filas: [] }
    porPartido[id].filas.push(fila)
  })
  setCanceladas(Object.values(porPartido))
  setCargado(true)
}

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    Promise.all([
      supabase.rpc('mis_faltas'),
      supabase.from('perfiles').select('en_revision').eq('id', perfilId).single(),
    ]).then(([f, p]) => setCuenta({ faltas: f.data ?? 0, revision: p.data?.en_revision === true }))
  }, [perfilId])

  async function cancelar(fila, g) {
    setError(null)
    setAviso(null)
const pagado = g.pago?.metodo === 'cancha'
  ? !!fila.cobrado_en
  : !!g.pago && g.pago.metodo !== 'bonificado'
    && ['por_verificar', 'verificado'].includes(g.pago.estado)
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

  if (!cargado && !error) return <Cargando />

  const ahora = Date.now()
  const proximas = grupos
    .filter((g) => finPartido(g.partido).getTime() >= ahora)
    .sort((a, b) => inicioPartido(a.partido) - inicioPartido(b.partido))
  const pasadas = grupos
    .filter((g) => finPartido(g.partido).getTime() < ahora)
    .sort((a, b) => inicioPartido(b.partido) - inicioPartido(a.partido))

  function tarjeta(g) {
    const clave = claveGrupo(g)
    const yaEmpezo = inicioPartido(g.partido) <= new Date()
    const verPago = ['por_verificar', 'reservado', 'rechazado', 'jug_cancha'].includes(clave)
    return (
      <div key={g.grupoId} className={`tarjeta space-y-2.5 border-l-4 ${BORDE_IZQ[colorDeEstado(clave)]}`}>
        <div className="space-y-1">
          <h3 className="text-xl">{g.partido.cancha}</h3>
          <p className="text-sm text-suave first-letter:uppercase">
            {fechaCorta(g.partido.fecha)} · {rangoHora(g.partido)}
          </p>
          <Etiqueta clave={clave} />
        </div>

        <ul className="space-y-2">
          {g.filas.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 border-t border-borde pt-2">
              <span>
                {f.nombre_invitado ?? 'Yo'}{f.posicion === 'arquero' && ' (arquero)'}
              </span>
              {!yaEmpezo && <button onClick={() => cancelar(f, g)}>Cancelar</button>}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          {verPago && (
            <Link to={`/pago/${g.grupoId}`} className="btn btn-activo">
              <QrCode size={18} /> Ver pago
            </Link>
          )}
          {g.partido.canchas?.enlace_maps && (
            <a href={g.partido.canchas.enlace_maps} target="_blank" rel="noreferrer" className="btn">
              <MapPin size={18} /> Cómo llegar
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2>Mis reservas</h2>
      {cuenta.revision && (
        <p className="aviso aviso-error flex gap-2">
          <Info size={18} className="mt-0.5 shrink-0" />
          <span>
            Tu cuenta está en revisión por inasistencias. No puedes reservar hasta que un encargado
            la apruebe: escríbele por WhatsApp.
          </span>
        </p>
      )}
      {!cuenta.revision && cuenta.faltas === 1 && (
        <p className="aviso aviso-alerta flex gap-2">
          <Info size={18} className="mt-0.5 shrink-0" />
          <span>
            Tienes 1 inasistencia en los últimos 90 días. Con la segunda, tu cuenta quedará en revisión.
            Si no puedes ir, cancela tu cupo a tiempo.
          </span>
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