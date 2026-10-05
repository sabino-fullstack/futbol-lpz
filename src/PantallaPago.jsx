import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { supabase } from './supabaseClient'
import { bs, fechaCorta, rangoHora } from './formato'
import { useVolver } from './navegacion'


function enlaceWhatsApp(enc, nombreJugador, partido, reservas, monto) {
  const fecha = new Date(partido.fecha + 'T00:00:00').toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const nJug = reservas.filter((r) => r.posicion === 'jugador').length
  const nArq = reservas.filter((r) => r.posicion === 'arquero').length
  const detalle = [
    nJug > 0 && `${nJug} de jugador`,
    nArq > 0 && `${nArq} de ARQUERO`,
  ].filter(Boolean).join(' y ')

  const mensaje =
    `Hola, soy ${nombreJugador}. ` +
    `Pagué ${bs(monto)} Bs por ${reservas.length} cupo(s) (${detalle}) ` +
    `para el partido en ${partido.cancha}, ${fecha} a las ${partido.hora.slice(0, 5)}.`
  const numero = enc.perfiles.whatsapp.replace(/\D/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

export default function PantallaPago({ nombreJugador }) {
  const { grupoId } = useParams()
  const volver = useVolver('/reservas')

  const [partido, setPartido] = useState(null)
  const [encargados, setEncargados] = useState([])
  const [reservas, setReservas] = useState([])
  const [pago, setPago] = useState(null)
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)
  const [ahora, setAhora] = useState(Date.now())

  async function cargar() {
    const [r, p] = await Promise.all([
      supabase.from('reservas')
        .select('id, estado, vencimiento, posicion, precio, partidos(*)')
        .eq('grupo_id', grupoId),
      supabase.from('pagos')
        .select('estado')
        .eq('grupo_id', grupoId)
        .in('estado', ['por_verificar', 'verificado'])
        .maybeSingle(),
    ])
    if (r.error || p.error) {
      setError('No pudimos cargar esta reserva.')
      return setCargado(true)
    }
    const part = r.data[0]?.partidos ?? null
    let encs = []
    if (part) {
      const e = await supabase.from('encargados')
        .select('id, qr_url, perfiles(nombre, whatsapp)')
        .eq('partido_id', part.id)
      if (e.error) setError(e.error.message)
      else encs = e.data
    }
    setPartido(part)
    setReservas(r.data.filter((x) => x.estado !== 'cancelado'))
    setPago(p.data)
    setEncargados(encs)
    setCargado(true)
  }

  useEffect(() => { cargar() }, [grupoId])

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!cargado) return <p className="text-suave">Cargando...</p>
  if (!partido) {
    return (
      <div className="space-y-3">
        <p>{error ?? 'No encontramos esta reserva. Puede que no sea tuya.'}</p>
        <button onClick={volver}>← Volver</button>
      </div>
    )
  }

  const cantidad = reservas.length
  const monto = reservas.reduce((suma, r) => suma + Number(r.precio), 0)
  const nArq = reservas.filter((r) => r.posicion === 'arquero').length

  async function avisar(enc) {
    setError(null)
    const { error } = await supabase.rpc('avisar_pago', {
      p_grupo: grupoId,
      p_encargado: enc.id,
    })
    if (error) return setError(error.message)
    window.location.href = enlaceWhatsApp(enc, nombreJugador, partido, reservas, monto)
  }

  const vencimiento = reservas[0]?.vencimiento
  const segundos = vencimiento
    ? Math.floor((new Date(vencimiento).getTime() - ahora) / 1000)
    : 0
  const mm = String(Math.max(0, Math.floor(segundos / 60))).padStart(2, '0')
  const ss = String(Math.max(0, segundos % 60)).padStart(2, '0')

 return (
  <div className="space-y-4">
    <button onClick={volver}>← Volver</button>

    <div>
      <h2 className="text-xl font-bold">{partido.cancha}</h2>
      <p className="text-suave first-letter:uppercase">
        {fechaCorta(partido.fecha)} · {rangoHora(partido)}
      </p>
    </div>

    {error && <p className="aviso aviso-error">{error}</p>}
    {cantidad === 0 && <p className="aviso">Esta reserva ya no está activa.</p>}

    {cantidad > 0 && pago?.estado === 'verificado' && (
      <p className="aviso aviso-ok text-lg font-semibold">✅ Tu cupo está confirmado.</p>
    )}

    {cantidad > 0 && pago?.estado === 'por_verificar' && (
      <div className="space-y-3">
        <p className="aviso aviso-alerta text-lg font-semibold">
          ⏳ Avisaste tu pago. El encargado lo está revisando.
        </p>
        <button onClick={cargar}>Actualizar estado</button>
      </div>
    )}

    {cantidad > 0 && !pago && (
      <div className="space-y-4">
        <div className="tarjeta text-center">
          <p className="text-suave">Total a pagar</p>
          <p className="text-4xl font-bold text-verde">{bs(monto)} Bs</p>
          <p className="text-suave">
            {cantidad} cupo(s){nArq > 0 && ` · ${nArq} de arquero`}
          </p>
          {segundos > 0 ? (
            <p className={`mt-2 text-xl font-bold ${segundos <= 120 ? 'text-rojo' : 'text-amarillo'}`}>
              ⏱ {mm}:{ss}
            </p>
          ) : (
            <p className="aviso aviso-error mt-2">
              La reserva venció. Si ya pagaste, escríbele al encargado.
            </p>
          )}
        </div>

        <ol className="list-decimal space-y-1 pl-6 text-lg">
          <li>Paga con el QR de un encargado.</li>
          <li>Toca "Ya pagué".</li>
          <li>En WhatsApp, adjunta la captura de tu pago y envía.</li>
        </ol>

        {encargados.length === 0 && <p className="aviso">Este partido aún no tiene encargado.</p>}

        {encargados.map((enc) => (
          <div key={enc.id} className="tarjeta space-y-3">
            <h4 className="text-lg font-bold">{enc.perfiles?.nombre}</h4>
            {enc.qr_url ? (
              <img
                src={enc.qr_url}
                alt={`QR de ${enc.perfiles?.nombre}`}
                className="mx-auto w-64 max-w-full rounded-lg bg-white p-2"
              />
            ) : (
              <p className="aviso aviso-alerta">Este encargado aún no subió su QR.</p>
            )}
            <button
              onClick={() => avisar(enc)}
              disabled={segundos <= 0}
              className="btn btn-primario"
            >
              Ya pagué, avisar a {enc.perfiles?.nombre}
            </button>
          </div>
        ))}

        <p className="text-sm text-suave">
          Puedes cancelar hasta {partido.horas_cancelacion} horas antes del partido y coordinar
          tu devolución. Después de ese plazo no hay devolución.
        </p>
      </div>
    )}
  </div>
)
}