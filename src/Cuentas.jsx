import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { normalizarNumero } from './auth'
import { nombreCompleto } from './formato'

const COLUMNAS =
  'id, nombre, apellido, apodo, whatsapp, rol, nivel, activo, rechazos_seguidos, suspendido_motivo, en_revision, revision_motivo'

export default function Cuentas() {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [bloqueados, setBloqueados] = useState([])
  const [numeroNuevo, setNumeroNuevo] = useState('')
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

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

  const etiqueta = (p) =>
    p.rol === 'superadmin' ? 'Superadmin' : p.nivel === 'confiable' ? 'Confiable' : 'Cuenta nueva'

  return (
    <div className="space-y-3">
      {error && <p className="text-rojo">{error}</p>}
      {aviso && <p className="rounded-xl border border-verde p-3">{aviso}</p>}
      {trabajando && <p className="text-suave">Procesando...</p>}

      <div className="flex gap-2">
        <input
          className="flex-1"
          placeholder="Buscar por número, nombre o apodo"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
        />
        <button onClick={buscar}>Buscar</button>
      </div>
      {texto.trim().length > 0 && texto.trim().length < 3 && (
        <p className="text-sm text-suave">Escribe al menos 3 letras o dígitos para filtrar.</p>
      )}

      {resultados.length === 0 && <p className="text-suave">No se encontraron cuentas.</p>}
      {resultados.map((p) => (
        <div key={p.id} className="space-y-1 rounded-xl border border-borde bg-tarjeta p-3">
          <p className="font-semibold">{nombreCompleto(p)}</p>
          <p className="text-sm text-suave">
            {p.whatsapp && (
              <a href={`https://wa.me/${p.whatsapp}`} target="_blank" rel="noreferrer">{p.whatsapp}</a>
            )}
            {' · '}{etiqueta(p)}
            {p.rechazos_seguidos >= 2 && ' · ⚠️ pagos rechazados'}
          </p>
          {!p.activo && <p className="text-rojo">Suspendida: {p.suspendido_motivo}</p>}
          {p.activo && p.en_revision && (
  <p className="text-amarillo">🔎 En revisión: {p.revision_motivo}</p>
)}
          
          <div className="flex flex-wrap gap-2 pt-1">
            {p.activo && p.rol !== 'superadmin' && (
              <button disabled={trabajando} onClick={() => suspender(p)}>Suspender</button>
            )}
            {!p.activo && (
              <button disabled={trabajando} onClick={() => reactivar(p)}>Reactivar</button>
            )}
            {p.activo && p.rol !== 'superadmin' && p.nivel === 'nuevo' && (
              <button disabled={trabajando} onClick={() => aprobar(p, true)}>Marcar confiable</button>
            )}
            {p.activo && p.rechazos_seguidos >= 2 && (
              <button disabled={trabajando} onClick={() => aprobar(p, false)}>
                Permitir avisar pagos
              </button>
            )}
            {p.activo && p.en_revision && (
  <button disabled={trabajando} onClick={() => aprobar(p, false)}>Quitar revisión</button>
)}
          </div>
        </div>
      ))}

      <h4 className="pt-2 font-bold">Números bloqueados</h4>
      {bloqueados.length === 0 && <p className="text-suave">No hay números bloqueados.</p>}
      {bloqueados.map((b) => (
        <div key={b.numero} className="flex items-center justify-between gap-2 rounded-xl border border-borde p-3">
          <div>
            <p className="font-semibold">{b.numero}</p>
            <p className="text-sm text-suave">{b.motivo}</p>
          </div>
          <button disabled={trabajando} onClick={() => quitarBloqueo(b)}>Quitar bloqueo</button>
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <input
          className="flex-1"
          placeholder="Bloquear un número (sin cuenta aún)"
          inputMode="numeric"
          value={numeroNuevo}
          onChange={(e) => setNumeroNuevo(e.target.value)}
        />
        <button disabled={trabajando} onClick={bloquearNumero}>Bloquear</button>
      </div>
    </div>
  )
}