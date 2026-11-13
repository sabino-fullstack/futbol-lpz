import { useEffect, useState } from 'react'
import {
  Ban, BadgeCheck, Check, Copy, KeyRound, MessageCircle, RotateCcw, Search, ShieldCheck,
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { normalizarNumero } from './auth'
import { nombreCompleto, enlaceClaveTemporal } from './formato'
import { Acciones, Accion } from './Acciones'
import Rueda from './Rueda'

const COLUMNAS =
  'id, nombre, apellido, apodo, whatsapp, rol, nivel, activo, rechazos_seguidos, suspendido_motivo, en_revision, revision_motivo, cambiar_clave'

async function mensajeDeError(error) {
  try {
    const j = await error.context.json()
    if (j?.error) return j.error
  } catch { /* sin detalle */ }
  return 'No se pudo restablecer la contraseña.'
}

const iniciales = (p) =>
  [p.nombre, p.apellido].filter(Boolean).map((t) => t[0]).join('').toUpperCase().slice(0, 2) || '?'

function Chip({ p }) {
  const [texto, clase] = !p.activo
    ? ['Suspendida', 'border-rojo/40 bg-rojo/10 text-rojo']
    : p.rol === 'superadmin'
      ? ['Superadmin', 'border-verde/40 bg-verde/10 text-verde']
      : p.nivel === 'confiable'
        ? ['Confiable', 'border-verde/40 bg-verde/10 text-verde']
        : ['Cuenta nueva', 'border-borde bg-borde/40 text-suave']
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${clase}`}>{texto}</span>
  )
}

export default function Cuentas() {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [bloqueados, setBloqueados] = useState([])
  const [numeroNuevo, setNumeroNuevo] = useState('')
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [temporal, setTemporal] = useState(null) // { perfil, clave }
  const [copiado, setCopiado] = useState(false)

  async function buscar() {
    // Se quitan los caracteres que rompen el filtro de la búsqueda
    const q = texto.trim().replace(/[,()%*\\]/g, '')
    let consulta = supabase.from('perfiles').select(COLUMNAS)
      .order('created_at', { ascending: false }).limit(20)
    if (q.length >= 3) {
      consulta = consulta.or(
        `whatsapp.ilike.%${q}%,nombre.ilike.%${q}%,apellido.ilike.%${q}%,apodo.ilike.%${q}%`
      )
    }
    const [r, b] = await Promise.all([
      consulta,
      supabase.from('numeros_bloqueados').select('numero, motivo')
        .order('created_at', { ascending: false }),
    ])
    const fallo = r.error || b.error
    if (fallo) return setError(fallo.message)
    setResultados(r.data)
    setBloqueados(b.data)
  }

  useEffect(() => { buscar() }, [])

  async function ejecutar(fn, params, pregunta) {
    if (pregunta && !window.confirm(pregunta)) return null
    setError(null)
    setAviso(null)
    setTrabajando(true)
    const { data, error } = await supabase.rpc(fn, params)
    setTrabajando(false)
    if (error) { setError(error.message); return null }
    await buscar()
    return data ?? true
  }

  async function suspender(p) {
    const motivo = window.prompt(`Motivo para suspender a ${nombreCompleto(p)}:`)
    if (motivo === null) return
    if (!motivo.trim()) return setError('Escribe el motivo de la suspensión')
    const r = await ejecutar('suspender_cuenta', { p_perfil: p.id, p_motivo: motivo })
    if (r && typeof r === 'object') {
      setAviso(
        `Cuenta suspendida. Reservas liberadas: ${r.canceladas}. ` +
        `Reservas con pago avisado por resolver en el panel del partido: ${r.en_revision}. ` +
        `Encargos retirados: ${r.encargos_retirados}. ` +
        `Si corresponde, recuerda sacarlo del grupo de WhatsApp.`
      )
    }
  }

  async function reactivar(p) {
    const ok = await ejecutar('reactivar_cuenta', { p_perfil: p.id },
      `¿Reactivar a ${nombreCompleto(p)}? Se quitará el bloqueo de su número. ` +
      `Si era encargado, tendrás que asignarlo de nuevo.`)
    if (ok) setAviso('Cuenta reactivada.')
  }

  async function aprobar(p, confiable) {
    const ok = await ejecutar('aprobar_cuenta', { p_perfil: p.id, p_confiable: confiable },
      confiable
        ? `¿Marcar a ${nombreCompleto(p)} como cuenta confiable? Tendrá límites más amplios.`
        : `¿Quitar las restricciones de ${nombreCompleto(p)} (pagos rechazados o revisión por faltas)?`)
    if (ok) setAviso('Listo.')
  }

  async function bloquearNumero() {
    const n = normalizarNumero(numeroNuevo)
    if (!n) return setError('Escribe un número de 8 dígitos')
    const motivo = window.prompt(`Motivo para bloquear el ${n}:`)
    if (motivo === null) return
    const ok = await ejecutar('bloquear_numero', { p_numero: n, p_motivo: motivo })
    if (ok) { setNumeroNuevo(''); setAviso(`Número ${n} bloqueado.`) }
  }

  async function quitarBloqueo(b) {
    const ok = await ejecutar('desbloquear_numero', { p_numero: b.numero },
      `¿Quitar el bloqueo de ${b.numero}? Si tenía una cuenta suspendida, se reactivará.`)
    if (ok) setAviso('Bloqueo quitado.')
  }

  async function restablecer(p) {
    if (!window.confirm(
      `¿Restablecer la contraseña de ${nombreCompleto(p)}?\n\n` +
      `Hazlo solo si la persona te escribió desde su propio número de WhatsApp. ` +
      `Se generará una contraseña temporal que verás una sola vez.`
    )) return
    setError(null)
    setAviso(null)
    setTemporal(null)
    setTrabajando(true)
    const { data, error } = await supabase.functions.invoke('restablecer-clave', {
      body: { perfil_id: p.id },
    })
    setTrabajando(false)
    if (error) return setError(await mensajeDeError(error))
    setTemporal({ perfil: p, clave: data.clave })
    buscar()
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(temporal.clave)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No se pudo copiar solo: selecciona la contraseña y cópiala a mano.')
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className="aviso aviso-error">{error}</p>}
      {aviso && <p className="aviso aviso-ok">{aviso}</p>}
      {trabajando && (
        <p className="flex items-center gap-2 text-sm text-suave"><Rueda size={16} /> Procesando...</p>
      )}

      {temporal && (
        <div className="tarjeta space-y-3 border-l-4 border-l-amarillo">
          <p className="font-semibold">Contraseña temporal de {nombreCompleto(temporal.perfil)}</p>
          <p className="select-all rounded-xl bg-borde/50 py-3 text-center font-display text-4xl font-bold tracking-widest">
            {temporal.clave}
          </p>
          <p className="text-sm text-suave">
            Se muestra una sola vez. Al entrar, la persona deberá crear una contraseña nueva.
          </p>
          <Acciones>
            {temporal.perfil.whatsapp && (
              <Accion
                Icono={MessageCircle}
                tono="activo"
                texto="Enviar por WhatsApp"
                href={enlaceClaveTemporal(temporal.perfil, temporal.clave)}
              />
            )}
            <Accion Icono={copiado ? Check : Copy} texto={copiado ? 'Copiado' : 'Copiar'} onClick={copiar} />
            <Accion Icono={Check} texto="Ya la envié" onClick={() => setTemporal(null)} />
          </Acciones>
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
          <input
            className="w-full pl-10"
            placeholder="Buscar por número, nombre o apodo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
        </div>
        <button onClick={buscar}>Buscar</button>
      </div>
      {texto.trim().length > 0 && texto.trim().length < 3 && (
        <p className="text-sm text-suave">Escribe al menos 3 letras o dígitos para filtrar.</p>
      )}

      {resultados.length === 0 && <p className="text-suave">No se encontraron cuentas.</p>}

      {resultados.map((p) => (
        <div
          key={p.id}
          className={`tarjeta space-y-3 border-l-4 ${
            !p.activo ? 'border-l-rojo' : p.en_revision || p.cambiar_clave ? 'border-l-amarillo' : 'border-l-borde'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-verde/15 font-display text-xl font-bold text-verde">
              {iniciales(p)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{nombreCompleto(p)}</p>
              {p.whatsapp && (
                <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noreferrer" className="text-sm">
                  {p.whatsapp}
                </a>
              )}
            </div>
            <Chip p={p} />
          </div>

          {!p.activo && <p className="text-sm text-rojo">Motivo: {p.suspendido_motivo}</p>}
          {p.activo && p.en_revision && (
            <p className="text-sm text-amarillo-texto">En revisión: {p.revision_motivo}</p>
          )}
          {p.activo && p.rechazos_seguidos >= 2 && (
            <p className="text-sm text-amarillo-texto">Tiene pagos rechazados seguidos</p>
          )}
          {p.activo && p.cambiar_clave && (
            <p className="text-sm text-amarillo-texto">Tiene una contraseña temporal pendiente de cambiar</p>
          )}

          <Acciones>
            {p.activo && p.rol !== 'superadmin' && (
              <Accion Icono={KeyRound} texto="Restablecer contraseña" disabled={trabajando} onClick={() => restablecer(p)} />
            )}
            {p.activo && p.rol !== 'superadmin' && p.nivel === 'nuevo' && (
              <Accion Icono={BadgeCheck} texto="Marcar confiable" disabled={trabajando} onClick={() => aprobar(p, true)} />
            )}
            {p.activo && (p.rechazos_seguidos >= 2 || p.en_revision) && (
              <Accion Icono={ShieldCheck} texto="Quitar restricciones" disabled={trabajando} onClick={() => aprobar(p, false)} />
            )}
            {!p.activo && (
              <Accion Icono={RotateCcw} texto="Reactivar" disabled={trabajando} onClick={() => reactivar(p)} />
            )}
            {p.activo && p.rol !== 'superadmin' && (
              <Accion Icono={Ban} tono="peligro" texto="Suspender" disabled={trabajando} onClick={() => suspender(p)} />
            )}
          </Acciones>
        </div>
      ))}

      <section className="space-y-3 pt-2">
        <h3>Números bloqueados</h3>
        {bloqueados.length === 0 && <p className="text-suave">No hay números bloqueados.</p>}
        {bloqueados.map((b) => (
          <div key={b.numero} className="tarjeta flex items-center gap-3 border-l-4 border-l-rojo">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{b.numero}</p>
              <p className="truncate text-sm text-suave">{b.motivo}</p>
            </div>
            <button disabled={trabajando} onClick={() => quitarBloqueo(b)}>
              <RotateCcw size={16} /> Quitar
            </button>
          </div>
        ))}

        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1"
            placeholder="Bloquear un número (sin cuenta aún)"
            inputMode="numeric"
            value={numeroNuevo}
            onChange={(e) => setNumeroNuevo(e.target.value)}
          />
          <button className="btn-peligro" disabled={trabajando} onClick={bloquearNumero}>
            <Ban size={16} /> Bloquear
          </button>
        </div>
      </section>
    </div>
  )
}