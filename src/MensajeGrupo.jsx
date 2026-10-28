import { useEffect, useState } from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'
import { supabase } from './supabaseClient'
import { bs, fechaCorta, hhmm, hoyBolivia, inicioPartido } from './formato'

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

function limiteSemana() {
  const d = new Date(hoyBolivia() + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  return d.toLocaleDateString('en-CA')
}

export default function MensajeGrupo({ partidos }) {
  const [libres, setLibres] = useState({})
  const [conCupos, setConCupos] = useState(true)
  const [editado, setEditado] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const limite = limiteSemana()
  const semana = partidos
    .filter((p) => p.estado === 'abierto' && p.fecha <= limite && inicioPartido(p).getTime() > Date.now())
    .sort((a, b) => inicioPartido(a) - inicioPartido(b))

  const ids = semana.map((p) => p.id).join(',')
  useEffect(() => {
    if (semana.length === 0) return
    supabase.rpc('libres_partidos', { p_ids: semana.map((p) => p.id) }).then(({ data }) => {
      const m = {}
      ;(data ?? []).forEach((x) => { m[x.id_partido] = x.libres_jugador })
      setLibres(m)
    })
  }, [ids])

  if (semana.length === 0) {
    return <p className="aviso">No hay partidos abiertos en los próximos 7 días.</p>
  }

  const lineas = semana.map((p) => {
    const base =
      `• ${cap(fechaCorta(p.fecha))} · ${hhmm(p.hora)} · ${p.cancha}` +
      `${p.modalidad ? ` (${p.modalidad})` : ''} · ${bs(p.cuota)} Bs`
    const l = libres[p.id]
    if (!conCupos || l == null) return base
    return l <= 0 ? `${base} · completo` : `${base} · quedan ${l}`
  })
  const armado =
    `⚽ Ya están habilitados los partidos de esta semana. Consulta horarios y reserva tu cupo aquí 👇\n` +
    `${window.location.origin}/partidos\n\n${lineas.join('\n')}`
  const texto = editado ?? armado

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado('ok')
    } catch {
      setCopiado('error')
    }
    setTimeout(() => setCopiado(null), 2500)
  }

  return (
    <div className="tarjeta space-y-3">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={conCupos} onChange={(e) => { setConCupos(e.target.checked); setEditado(null) }} />
        Incluir cuántos cupos quedan
      </label>
      <textarea rows={10} value={texto} onChange={(e) => setEditado(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button onClick={copiar} className="btn btn-activo">
          {copiado === 'ok' ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
        </button>
        <a
          className="btn"
          target="_blank"
          rel="noreferrer"
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
        >
          <MessageCircle size={16} /> Abrir en WhatsApp
        </a>
        {editado !== null && <button onClick={() => setEditado(null)}>Restaurar texto</button>}
      </div>
      {copiado === 'error' && (
        <p className="text-sm text-suave">No se pudo copiar solo: selecciona el texto y cópialo a mano.</p>
      )}
    </div>
  )
}