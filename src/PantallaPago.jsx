import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { bs } from './formato'

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

export default function PantallaPago({ partido, grupoId, nombreJugador, onCerrar }) {
  const [encargados, setEncargados] = useState([])
  const [reservas, setReservas] = useState([])
  const [pago, setPago] = useState(null)
  const [error, setError] = useState(null)
  const [ahora, setAhora] = useState(Date.now())

  async function cargar() {
    const [e, r, p] = await Promise.all([
      supabase.from('encargados')
        .select('id, qr_url, perfiles(nombre, whatsapp)')
        .eq('partido_id', partido.id),
      supabase.from('reservas')
        .select('id, estado, vencimiento, posicion, precio')
        .eq('grupo_id', grupoId)
        .neq('estado', 'cancelado'),
      supabase.from('pagos')
        .select('estado')
        .eq('grupo_id', grupoId)
        .in('estado', ['por_verificar', 'verificado'])
        .maybeSingle(),
    ])
    const fallo = e.error || r.error || p.error
    if (fallo) return setError(fallo.message)
    setEncargados(e.data)
    setReservas(r.data)
    setPago(p.data)
  }

  useEffect(() => { cargar() }, [])

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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
    <div>
      <button onClick={onCerrar}>← Volver</button>
      <h2>{partido.cancha}</h2>
      {error && <p>{error}</p>}

      {cantidad === 0 && <p>Esta reserva ya no está activa.</p>}

      {cantidad > 0 && pago?.estado === 'verificado' && (
        <p>✅ Tu cupo está confirmado.</p>
      )}

      {cantidad > 0 && pago?.estado === 'por_verificar' && (
        <p>⏳ Avisaste tu pago. El encargado lo está revisando.</p>
      )}

      {cantidad > 0 && !pago && (
        <div>
          <h3>Paga {bs(monto)} Bs ({cantidad} cupo(s))</h3>
          {nArq > 0 && <p>Incluye {nArq} cupo(s) de arquero.</p>}
          {segundos > 0 ? (
            <p>Tiempo para pagar: {mm}:{ss}</p>
          ) : (
            <p>La reserva venció. Si ya pagaste, escríbele al encargado.</p>
          )}
          <p>
            Paga con el QR de cualquiera de los encargados. Luego toca
            "Ya pagué" y, en WhatsApp, adjunta la captura de tu pago antes de enviar.
          </p>
          <p>
            Puedes cancelar hasta {partido.horas_cancelacion} horas antes del partido y
            coordinar tu devolución. Después de ese plazo no hay devolución.
          </p>

          {encargados.length === 0 && <p>Este partido aún no tiene encargado.</p>}

          {encargados.map((enc) => (
            <div key={enc.id}>
              <h4>{enc.perfiles?.nombre}</h4>
              {enc.qr_url
                ? <img src={enc.qr_url} alt="QR" width="220" />
                : <p>Este encargado aún no subió su QR.</p>}
              <button onClick={() => avisar(enc)} disabled={segundos <= 0}>
                Ya pagué, avisar a {enc.perfiles?.nombre}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}