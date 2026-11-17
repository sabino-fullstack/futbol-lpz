import { useState } from 'react'
import { Check, ChevronDown, Copy, MessageCircle, RotateCcw, Share2 } from 'lucide-react'
import { claveCupo } from './estados'
import { bs, hhmm } from './formato'
import Interruptor from './Interruptor'
import { Acciones, Accion } from './Acciones'

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// "Miércoles 28 de Octubre"
function diaLargo(fecha) {
  const d = new Date(`${fecha}T12:00:00-04:00`)
  const o = { timeZone: 'America/La_Paz' }
  const dia = d.toLocaleDateString('es-BO', { ...o, weekday: 'long' })
  const n = d.toLocaleDateString('es-BO', { ...o, day: 'numeric' })
  const mes = d.toLocaleDateString('es-BO', { ...o, month: 'long' })
  return `${cap(dia)} ${n} de ${cap(mes)}`
}

// 1️⃣ 2️⃣ ... 🔟 1️⃣1️⃣
const emojiNum = (n) =>
  n === 10 ? '🔟' : String(n).split('').map((d) => `${d}\uFE0F\u20E3`).join('')

// Apodo, o nombre con la inicial del apellido (igual que la lista pública)
function corto(p) {
  if (!p) return ''
  const apodo = p.apodo?.trim()
  if (apodo) return apodo
  const ap = p.apellido?.trim()
  return `${p.nombre ?? ''}${ap ? ` ${ap[0].toUpperCase()}.` : ''}`.trim()
}

const nombreDe = (r) => r.nombre_invitado?.trim() || corto(r.perfil) || 'Jugador'
const CONFIRMADOS = ['qr', 'adelantado', 'cancha_cobrado', 'cancha_debe', 'bonificado']

function armar({ partido, jugadores, arqueros, opc, enlace }) {
  const L = []
  L.push(`*${diaLargo(partido.fecha)}*`)
  L.push(`🏟️ ${partido.modalidad ? `${partido.modalidad} - ` : ''}"${partido.cancha}"`)
  L.push(`🕐 ${hhmm(partido.hora)}${partido.hora_fin ? ` - ${hhmm(partido.hora_fin)}` : ''}`)
  L.push(`💰 Cuota: ${bs(partido.cuota)} Bs${partido.cupos_arco > 0 ? ` (arqueros ${bs(partido.cuota_arquero)} Bs)` : ''}`)
  L.push('')
  L.push('👇 ⚽⚽ LISTA ⚽⚽')

  for (let i = 0; i < partido.cupos_arco; i++) {
    const a = arqueros[i]
    if (a) L.push(`🧤 Arco: ${a.texto}`)
    else if (opc.libres) L.push('🧤 Arco:')
  }

  const total = partido.cupos
  const nEq = opc.equipos && partido.equipos > 0 ? partido.equipos : 0
  // Reparte los cupos en bloques parejos (25 cupos y 3 equipos = 9, 8 y 8)
  const tamanos = nEq
    ? Array.from({ length: nEq }, (_, t) => Math.floor(total / nEq) + (t < total % nEq ? 1 : 0))
    : [total]
  let idx = 0
  tamanos.forEach((tam, t) => {
    const lineas = []
    for (let k = 1; k <= tam; k++) {
      const j = jugadores[idx++]
      if (j) lineas.push(`${emojiNum(k)} ${j.texto}`)
      else if (opc.libres) lineas.push(emojiNum(k))
    }
    if (lineas.length === 0) return
    if (nEq) L.push(`*Equipo ${t + 1}*`)
    L.push(...lineas)
  })
  // Por si hubiera más anotados que cupos
  jugadores.slice(idx).forEach((j) => L.push(`➕ ${j.texto}`))

  L.push('')
  L.push('✅ Confirmado · ⏳ Falta pagar')
  const libresJ = Math.max(0, total - jugadores.length)
  const libresA = Math.max(0, partido.cupos_arco - arqueros.length)
  if (libresJ + libresA > 0) {
    L.push(
      `🔔 Quedan ${libresJ} cupo${libresJ === 1 ? '' : 's'}` +
      `${partido.cupos_arco > 0 ? ` de jugador y ${libresA} de arco` : ''}`
    )
  }
  L.push('📩 No olviden realizar su pago para confirmar su asistencia')
  L.push(`📲 También pueden reservar y pagar desde la app: ${enlace}`)
  return L.join('\n')
}

export default function ListaWhatsApp({ partido, reservas, pagoDe }) {
  const [opc, setOpc] = useState({ equipos: true, libres: true, cancha: false })
  const [editado, setEditado] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const ahora = Date.now()
  const anotados = reservas
    .map((r) => ({ r, clave: claveCupo(r, pagoDe[r.grupo_id], ahora) }))
    .filter((x) => x.clave !== 'vencido' && x.clave !== 'cancelado')
    .map(({ r, clave }) => ({
      posicion: r.posicion,
      texto:
        `${nombreDe(r)} ${CONFIRMADOS.includes(clave) ? '✅' : '⏳'}` +
        `${opc.cancha && clave === 'cancha_debe' ? ' (cancha)' : ''}`,
    }))
  const arqueros = anotados.filter((x) => x.posicion === 'arquero')
  const jugadores = anotados.filter((x) => x.posicion !== 'arquero')

  const armado = armar({
    partido,
    jugadores,
    arqueros,
    opc,
    enlace: `${window.location.origin}/partidos/${partido.id}`,
  })
  const texto = editado ?? armado

  function cambiarOpc(clave, valor) {
    setOpc({ ...opc, [clave]: valor })
    setEditado(null)
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado('ok')
    } catch {
      setCopiado('error')
    }
    setTimeout(() => setCopiado(null), 2500)
  }

  async function compartir() {
    if (navigator.share) {
      try {
        await navigator.share({ text: texto })
      } catch (e) {
        if (e.name !== 'AbortError') copiar()
      }
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }

  return (
    <details className="tarjeta group p-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-verde/15 text-verde">
          <MessageCircle size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block">Lista para WhatsApp</span>
          <span className="block text-xs font-normal text-suave">
            {anotados.length} anotado{anotados.length === 1 ? '' : 's'} · en el formato del grupo
          </span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-suave transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-3 border-t border-borde p-3">
        <div className="space-y-2">
          {partido.equipos > 0 && (
            <Interruptor activo={opc.equipos} onCambio={(v) => cambiarOpc('equipos', v)} etiqueta="Dividir por equipos" />
          )}
          <Interruptor activo={opc.libres} onCambio={(v) => cambiarOpc('libres', v)} etiqueta="Mostrar cupos libres" />
          <Interruptor activo={opc.cancha} onCambio={(v) => cambiarOpc('cancha', v)} etiqueta='Marcar quién paga en cancha' />
        </div>

        <textarea rows={16} value={texto} onChange={(e) => setEditado(e.target.value)} />

        <Acciones columnas={2}>
          <Accion
            Icono={copiado === 'ok' ? Check : Copy}
            tono="activo"
            texto={copiado === 'ok' ? 'Copiado' : 'Copiar'}
            onClick={copiar}
          />
          <Accion Icono={Share2} texto="Compartir" onClick={compartir} />
        </Acciones>
        {editado !== null && (
          <button className="w-full" onClick={() => setEditado(null)}>
            <RotateCcw size={14} /> Restaurar texto
          </button>
        )}
        {copiado === 'error' && (
          <p className="text-sm text-suave">No se pudo copiar solo: selecciona el texto y cópialo a mano.</p>
        )}
        <p className="text-xs text-suave">
          Puedes editar el texto antes de copiarlo. Los equipos son solo bloques para ordenar la lista: los
          equipos reales los armas en la cancha.
        </p>
      </div>
    </details>
  )
}