import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { BadgeCheck, Banknote, ChevronLeft, Clock, Info, MessageCircle, RefreshCw } from 'lucide-react'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import Rueda from './Rueda'
import DescargarQR from './DescargarQR'
import { Acciones, Accion } from './Acciones'
import { useAutoRefrescar } from './useAutoRefrescar'
import { bs, fechaCorta, rangoHora } from './formato'
import { useVolver } from './navegacion'

const solo = (t) => String(t ?? '').replace(/\D/g, '')

// Mensaje al tocar "Ya pagué": avisa el pago y pide revisarlo
function enlaceAviso(enc, nombreJugador, partido, reservas, monto) {
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
  return `https://wa.me/${solo(enc.perfiles.whatsapp)}?text=${encodeURIComponent(mensaje)}`
}

// Mensaje para cualquier duda sobre el pago
function enlacePregunta(enc, nombreJugador, partido, monto) {
  const mensaje =
    `Hola, soy ${nombreJugador}. Tengo una consulta sobre mi pago de ${bs(monto)} Bs ` +
    `del partido en ${partido.cancha}, ${fechaCorta(partido.fecha)} a las ${partido.hora.slice(0, 5)}.`
  return `https://wa.me/${solo(enc.perfiles.whatsapp)}?text=${encodeURIComponent(mensaje)}`
}

export default function PantallaPago({ nombreJugador }) {
  const { grupoId } = useParams()
  const volver = useVolver('/reservas')

  const [partido, setPartido] = useState(null)
  const [encargados, setEncargados] = useState([])
  const [reservas, setReservas] = useState([])
  const [pago, setPago] = useState(null)
  const [cargado, setCargado] = useState(false)
  const [falloCarga, setFalloCarga] = useState(false)
  const [error, setError] = useState(null)
  const [avisando, setAvisando] = useState(null) // id del encargado al que se avisa
  const [ahora, setAhora] = useState(Date.now())

  // silencioso = true: actualización automática, no muestra errores ni parpadea
  async function cargar(silencioso) {
    const callado = silencioso === true
    const [r, p] = await Promise.all([
      supabase.from('reservas')
        .select('id, estado, vencimiento, posicion, precio, cobrado_en, partidos(*)')
        .eq('grupo_id', grupoId),
      supabase.from('pagos')
        .select('estado, metodo, monto, pagar_a')
        .eq('grupo_id', grupoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (r.error || p.error) {
      if (!callado) { setFalloCarga(true); setCargado(true) }
      return
    }
    setPartido(r.data[0]?.partidos ?? null)
    setReservas(r.data.filter((x) => x.estado !== 'cancelado'))
    setPago(p.data)
    setFalloCarga(false)
    setCargado(true)
  }

  useEffect(() => { cargar() }, [grupoId])

  // Los encargados con QR del partido (se piden una sola vez)
  useEffect(() => {
    if (!partido?.id) return
    supabase.from('encargados')
      .select('id, qr_url, perfiles(nombre, whatsapp)')
      .eq('partido_id', partido.id)
      .eq('tipo', 'encargado')
      .then(({ data }) => setEncargados(data ?? []))
  }, [partido?.id])

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Mientras estás en esta pantalla, se actualiza sola (y al volver de WhatsApp)
  useAutoRefrescar(() => cargar(true), 15000)

  if (!cargado) return <Cargando />
  if (!partido) {
    return (
      <div className="space-y-3">
        <p>{falloCarga ? 'No pudimos cargar esta reserva.' : 'No encontramos esta reserva. Puede que no sea tuya.'}</p>
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

  // El encargado al que avisaste (o el primero con WhatsApp)
  const encPago =
    encargados.find((e) => e.id === pago?.pagar_a && e.perfiles?.whatsapp) ??
    encargados.find((e) => e.perfiles?.whatsapp) ?? null

  async function avisar(enc) {
    setError(null)
    setAvisando(enc.id)
    const { error } = await supabase.rpc('avisar_pago', { p_grupo: grupoId, p_encargado: enc.id })
    if (error) {
      setAvisando(null)
      return setError(error.message)
    }
    const enlace = enlaceAviso(enc, nombreJugador, partido, reservas, monto)
    await cargar(true) // la pantalla ya muestra "El encargado está revisando" cuando vuelvas de WhatsApp
    setAvisando(null)
    window.location.href = enlace
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
          <div className="tarjeta space-y-2 border-l-4 border-l-amarillo">
            <p className="flex items-center gap-3 text-lg font-semibold">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amarillo/15 text-amarillo-texto">
                <Clock size={22} />
              </span>
              Avisaste tu pago
            </p>
            <p>El encargado lo está revisando. Esta pantalla se actualiza sola cuando lo confirme.</p>
            <p className="text-sm text-suave">
              {bs(monto)} Bs · {cantidad} cupo(s){nArq > 0 && ` · ${nArq} de arquero`}
            </p>
          </div>

          <Acciones columnas={2}>
            {encPago && (
              <Accion
                href={enlacePregunta(encPago, nombreJugador, partido, monto)}
                Icono={MessageCircle}
                tono="activo"
                texto="Escribir al encargado"
              />
            )}
            <Accion Icono={RefreshCw} texto="Actualizar estado" onClick={() => cargar()} />
          </Acciones>
          <p className="text-xs text-suave">
            Si todavía no enviaste la captura de tu pago por WhatsApp, hazlo con el botón verde.
          </p>
        </div>
      )}

      {cantidad > 0 && porPagar && (
        <div className="space-y-4">
          {pago?.estado === 'rechazado' && (
            <div className="aviso aviso-alerta space-y-2 text-sm">
              <p className="flex gap-2">
                <Info size={18} className="mt-0.5 shrink-0" />
                <span>
                  El encargado no pudo verificar tu pago. Revisa que el monto y el comprobante sean
                  correctos y vuelve a avisar, o escríbele por WhatsApp.
                </span>
              </p>
              {encPago && (
                <a
                  className="btn w-full"
                  target="_blank"
                  rel="noreferrer"
                  href={enlacePregunta(encPago, nombreJugador, partido, monto)}
                >
                  <MessageCircle size={16} /> Escribir al encargado
                </a>
              )}
            </div>
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
              <div className="aviso aviso-error mt-2 space-y-2">
                <p>La reserva venció. Si ya pagaste, escríbele al encargado.</p>
                {encPago && (
                  <a
                    className="btn w-full"
                    target="_blank"
                    rel="noreferrer"
                    href={enlacePregunta(encPago, nombreJugador, partido, monto)}
                  >
                    <MessageCircle size={16} /> Escribir al encargado
                  </a>
                )}
              </div>
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
              <h4 className="text-xl">{enc.perfiles?.nombre}</h4>
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
                {avisando === enc.id
                  ? <><Rueda /> Un momento...</>
                  : <>Ya pagué, avisar a {enc.perfiles?.nombre}</>}
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