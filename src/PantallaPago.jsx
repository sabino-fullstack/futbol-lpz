import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { BadgeCheck, Banknote, ChevronLeft, Clock, Info, RefreshCw } from 'lucide-react'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import Rueda from './Rueda'
import DescargarQR from './DescargarQR'
import { bs, fechaCorta, rangoHora } from './formato'
import { useVolver } from './navegacion'

function enlaceWhatsApp(enc, nombreJugador, partido, reservas, monto) {
  const nJug = reservas.filter((r) => r.posicion === 'jugador').length
  const nArq = reservas.filter((r) => r.posicion === 'arquero').length
  const detalle = [
    nJug > 0 && `${nJug} de jugador`,
    nArq > 0 && `${nArq} de ARQUERO`,
  ].filter(Boolean).join(' y ')

  const mensaje =
    `Hola, soy ${nombreJugador}. ` +
    `Pagué ${bs(monto)} Bs por ${reservas.length} cupo(s) (${detalle}) ` +
    `para el partido en ${partido.cancha}, ${fechaCorta(partido.fecha)} a las ${partido.hora.slice(0, 5)}.`
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
  const [avisando, setAvisando] = useState(null) // id del encargado al que se avisa
  const [ahora, setAhora] = useState(Date.now())

  async function cargar() {
    const [r, p] = await Promise.all([
      supabase.from('reservas')
        .select('id, estado, vencimiento, posicion, precio, cobrado_en, partidos(*)')
        .eq('grupo_id', grupoId),
      supabase.from('pagos')
        .select('estado, metodo, monto')
        .eq('grupo_id', grupoId)
        .order('created_at', { ascending: false })
        .limit(1)
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

  if (!cargado) return <Cargando />
  if (!partido) {
    return (
      <div className="space-y-3">
        <p>{error ?? 'No encontramos esta reserva. Puede que no sea tuya.'}</p>
        <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>
      </div>
    )
  }

  const cantidad = reservas.length
  const monto = reservas.reduce((suma, r) => suma + Number(r.precio), 0)
  const nArq = reservas.filter((r) => r.posicion === 'arquero').length
  const alCancha = pago?.metodo === 'cancha'
  const confirmado = !alCancha && (pago?.metodo === 'bonificado' || pago?.estado === 'verificado'
    || reservas.some((r) => r.estado === 'confirmado'))
  const esperando = !alCancha && !confirmado && pago?.estado === 'por_verificar'
  const porPagar = !alCancha && !confirmado && !esperando
  const debeCancha = reservas.filter((r) => !r.cobrado_en).reduce((s, r) => s + Number(r.precio), 0)

  async function avisar(enc) {
    setError(null)
    setAvisando(enc.id)
    const { error } = await supabase.rpc('avisar_pago', {
      p_grupo: grupoId,
      p_encargado: enc.id,
    })
    if (error) {
      setAvisando(null)
      return setError(error.message)
    }
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
      <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>

      <div className="space-y-1">
        <h2>{partido.cancha}</h2>
        <p className="flex items-center gap-1.5 text-suave">
          <Clock size={15} />
          <span className="first-letter:uppercase">{fechaCorta(partido.fecha)}</span> · {rangoHora(partido)}
        </p>
      </div>

      {error && <p className="aviso aviso-error">{error}</p>}
      {cantidad === 0 && <p className="aviso">Esta reserva ya no está activa.</p>}

      {cantidad > 0 && confirmado && (
        <div className="tarjeta flex items-center gap-3 border-l-4 border-l-verde">
          <BadgeCheck size={28} className="shrink-0 text-verde" />
          <p className="text-lg font-semibold">Tu cupo está confirmado.</p>
        </div>
      )}

      {cantidad > 0 && alCancha && (
        <div className="tarjeta space-y-1 border-l-4 border-l-amarillo">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Banknote size={22} className="shrink-0 text-amarillo-texto" /> Pagas en cancha
          </p>
          {debeCancha > 0 ? (
            <p>Tu cupo está confirmado. Lleva <strong>{bs(debeCancha)} Bs</strong> para pagar el día del partido.</p>
          ) : (
            <p>Tu cupo está confirmado y ya está cobrado. ¡Nos vemos en la cancha!</p>
          )}
        </div>
      )}

      {cantidad > 0 && esperando && (
        <div className="space-y-3">
          <div className="tarjeta flex items-center gap-3 border-l-4 border-l-amarillo">
            <Clock size={26} className="shrink-0 text-amarillo-texto" />
            <p className="text-lg font-semibold">Avisaste tu pago. El encargado lo está revisando.</p>
          </div>
          <button onClick={cargar} className="btn"><RefreshCw size={16} /> Actualizar estado</button>
        </div>
      )}

      {cantidad > 0 && porPagar && (
        <div className="space-y-4">
          {pago?.estado === 'rechazado' && (
            <p className="aviso aviso-alerta flex gap-2 text-sm">
              <Info size={18} className="mt-0.5 shrink-0" />
              <span>
                El encargado no pudo verificar tu pago. Revisa que el monto y el comprobante sean
                correctos y vuelve a avisar, o escríbele por WhatsApp.
              </span>
            </p>
          )}

          <div className="tarjeta space-y-1 text-center">
            <p className="text-suave">Total a pagar</p>
            <p className="font-display text-5xl font-bold tabular-nums text-verde">{bs(monto)} Bs</p>
            <p className="text-suave">
              {cantidad} cupo(s){nArq > 0 && ` · ${nArq} de arquero`}
            </p>
            {segundos > 0 ? (
              <p className={`pt-1 text-xl font-bold tabular-nums ${segundos <= 120 ? 'text-rojo' : 'text-amarillo-texto'}`}>
                <Clock size={18} className="mr-1 inline align-[-3px]" /> {mm}:{ss}
              </p>
            ) : (
              <p className="aviso aviso-error mt-2">
                La reserva venció. Si ya pagaste, escríbele al encargado.
              </p>
            )}
          </div>

          <ol className="space-y-2">
            {[
              'Paga con el QR de un encargado (escanéalo o descárgalo).',
              'Toca "Ya pagué".',
              'En WhatsApp, adjunta la captura de tu pago y envía.',
            ].map((texto, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-verde text-sm font-bold text-sobre-verde">
                  {i + 1}
                </span>
                <span>{texto}</span>
              </li>
            ))}
          </ol>

          {encargados.length === 0 && <p className="aviso">Este partido aún no tiene encargado.</p>}

          {encargados.map((enc) => (
            <div key={enc.id} className="tarjeta space-y-3">
              <h3 className="text-xl">{enc.perfiles?.nombre}</h3>
              {enc.qr_url ? (
  <div className="space-y-2">
    <img
      src={enc.qr_url}
      alt={`QR de ${enc.perfiles?.nombre}`}
      className="mx-auto w-64 max-w-full rounded-lg bg-white p-2"
    />
    <DescargarQR url={enc.qr_url} nombre={enc.perfiles?.nombre ?? 'encargado'} />
  </div>
) : (

  <p className="aviso aviso-alerta">Este encargado aún no subió su QR.</p>
)} 

              <button
                onClick={() => avisar(enc)}
                disabled={segundos <= 0 || avisando !== null}
                className="btn btn-primario"
              >
                {avisando === enc.id ? <><Rueda /> Un momento...</> : <>Ya pagué, avisar a {enc.perfiles?.nombre}</>}
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