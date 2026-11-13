import { useEffect, useState } from 'react'
import { Bell, Check, Megaphone, Send, Ticket, Users } from 'lucide-react'
import { supabase } from './supabaseClient'
import Rueda from './Rueda'
import { fechaCorta, haceCuanto, hhmm, hoyBolivia } from './formato'

const DESTINOS = [
  ['todos', 'Todos', Users],
  ['partido', 'Con cupo en un partido', Ticket],
  ['espera', 'En lista de espera', Bell],
]
const PLANTILLAS = [['nuevos', 'Partidos nuevos'], ['recordatorio', 'Recordatorio'], ['libre', 'Aviso libre']]
const NOMBRE_DESTINO = { todos: 'Todos', partido: 'Con cupo en un partido', espera: 'En lista de espera' }

const recordatorio = (p) =>
  `Te esperamos en ${p.cancha} el ${fechaCorta(p.fecha)} a las ${hhmm(p.hora)}. ¡No faltes!`

export default function EnviarAviso() {
  const [destino, setDestino] = useState('todos')
  const [partidoId, setPartidoId] = useState('')
  const [plantilla, setPlantilla] = useState('libre')
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [enlace, setEnlace] = useState('partidos')
  const [partidos, setPartidos] = useState([])
  const [historial, setHistorial] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [ok, setOk] = useState(null)

  async function cargar() {
    const [p, h] = await Promise.all([
      supabase.from('partidos').select('id, cancha, fecha, hora')
        .eq('estado', 'abierto').gte('fecha', hoyBolivia())
        .order('fecha', { ascending: true }).order('hora', { ascending: true }),
      supabase.from('avisos_enviados')
        .select('id, titulo, destino, destinatarios, created_at')
        .order('created_at', { ascending: false }).limit(8),
    ])
    if (p.error || h.error) return setError((p.error || h.error).message)
    setPartidos(p.data)
    setHistorial(h.data)
  }
  useEffect(() => { cargar() }, [])

  const partido = partidos.find((p) => p.id === partidoId)

  function elegirPlantilla(id) {
    setPlantilla(id)
    setError(null)
    setOk(null)
    if (id === 'nuevos') {
      setDestino('todos')
      setTitulo('Partidos nuevos')
      setCuerpo('Ya están habilitados los partidos de esta semana. Entra y reserva tu cupo.')
      setEnlace('partidos')
    } else if (id === 'recordatorio') {
      setDestino('partido')
      setTitulo('Recordatorio de tu partido')
      setCuerpo(partido ? recordatorio(partido) : 'Te esperamos en tu partido. ¡No faltes!')
      setEnlace(partidoId ? 'partido' : 'partidos')
    } else {
      setTitulo('')
      setCuerpo('')
    }
  }

  function elegirPartido(id) {
    setPartidoId(id)
    const p = partidos.find((x) => x.id === id)
    if (plantilla === 'recordatorio' && p) setCuerpo(recordatorio(p))
    if (id && destino !== 'todos') setEnlace('partido')
  }

  function elegirDestino(d) {
    setDestino(d)
    if (d === 'todos' && enlace === 'partido') setEnlace('partidos')
  }

  async function enviar() {
    setError(null)
    setOk(null)
    if (destino !== 'todos' && !partidoId) return setError('Elige el partido.')

    const url =
      enlace === 'partido' && partidoId ? `/partidos/${partidoId}`
      : enlace === 'avisos' ? '/avisos'
      : '/partidos'
    const args = {
      p_titulo: titulo,
      p_cuerpo: cuerpo,
      p_url: url,
      p_destino: destino,
      p_partido: destino === 'todos' ? null : partidoId,
      p_categoria: plantilla === 'nuevos' ? 'partidos_nuevos' : 'organizador',
    }

    setEnviando(true)
    // Primero solo se cuenta a cuántas personas llegaría
    const prueba = await supabase.rpc('enviar_aviso', { ...args, p_enviar: false })
    if (prueba.error) {
      setEnviando(false)
      return setError(prueba.error.message)
    }
    const n = prueba.data
    if (n === 0) {
      setEnviando(false)
      return setError('Con esos filtros no hay nadie que reciba el aviso.')
    }
    if (!window.confirm(
      `Se enviará a ${n} persona(s). Llegará como notificación a quienes la activaron y quedará en la campana de todos. ¿Enviar ahora?`
    )) {
      setEnviando(false)
      return
    }
    const r = await supabase.rpc('enviar_aviso', { ...args, p_enviar: true })
    setEnviando(false)
    if (r.error) return setError(r.error.message)
    setOk(`Aviso enviado a ${r.data} persona(s).`)
    setTitulo('')
    setCuerpo('')
    setPlantilla('libre')
    cargar()
  }

  const listo = titulo.trim().length >= 3 && cuerpo.trim().length >= 3

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-verde text-sobre-verde">
          <Megaphone size={26} />
        </span>
        <div>
          <h3 className="text-2xl">Enviar un aviso</h3>
          <p className="text-sm text-suave">Llega como notificación y queda en la campana.</p>
        </div>
      </header>

      <section className="tarjeta space-y-2.5">
        <p className="font-semibold">Plantilla</p>
        <div className="flex flex-wrap gap-2">
          {PLANTILLAS.map(([id, nombre]) => (
            <button
              key={id}
              type="button"
              aria-pressed={plantilla === id}
              onClick={() => elegirPlantilla(id)}
              className={plantilla === id ? 'border-transparent bg-verde text-sobre-verde' : ''}
            >
              {nombre}
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta space-y-3">
        <p className="font-semibold">¿A quién?</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Destinatarios">
          {DESTINOS.map(([id, nombre, Icono]) => {
            const activo = destino === id
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => elegirDestino(id)}
                className={`relative flex h-auto min-h-[4.5rem] flex-col items-center justify-center gap-1 px-1.5 py-2 text-center ${
                  activo ? 'border-verde bg-verde/10 text-verde' : ''
                }`}
              >
                <Icono size={22} />
                <span className="text-xs font-semibold leading-tight">{nombre}</span>
                {activo && <Check size={14} className="pop absolute right-1 top-1" />}
              </button>
            )
          })}
        </div>
        {destino !== 'todos' && (
          <select className="w-full" value={partidoId} onChange={(e) => elegirPartido(e.target.value)}>
            <option value="">Elegir partido...</option>
            {partidos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fecha.slice(8, 10)}/{p.fecha.slice(5, 7)} · {hhmm(p.hora)} · {p.cancha}
              </option>
            ))}
          </select>
        )}
      </section>

      <section className="tarjeta space-y-3">
        <label className="block space-y-1">
          <span className="flex justify-between text-sm font-semibold">
            Título <span className="font-normal text-suave">{titulo.length}/60</span>
          </span>
          <input className="w-full" maxLength={60} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="flex justify-between text-sm font-semibold">
            Mensaje <span className="font-normal text-suave">{cuerpo.length}/200</span>
          </span>
          <textarea rows={3} maxLength={200} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
        </label>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Al tocar el aviso se abre</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['partidos', 'La lista de partidos'],
              ...(destino !== 'todos' ? [['partido', 'Ese partido']] : []),
              ['avisos', 'Mis avisos'],
            ].map(([id, nombre]) => (
              <button
                key={id}
                type="button"
                aria-pressed={enlace === id}
                onClick={() => setEnlace(id)}
                className={enlace === id ? 'border-transparent bg-verde text-sobre-verde' : ''}
              >
                {nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-borde bg-borde/30 p-3">
          <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-bold">{titulo || 'Título del aviso'}</p>
            <p className="break-words text-sm text-suave">{cuerpo || 'Aquí se verá el mensaje.'}</p>
          </div>
        </div>
      </section>

      {error && <p className="aviso aviso-error">{error}</p>}
      {ok && <p className="aviso aviso-ok flex items-center gap-2"><Check size={18} className="pop" /> {ok}</p>}

      <button onClick={enviar} disabled={enviando || !listo} className="btn btn-primario">
        {enviando ? <><Rueda /> Un momento...</> : <><Send size={20} /> Enviar aviso</>}
      </button>
      <p className="text-xs text-suave">
        Máximo 5 avisos cada 24 horas. Demasiados avisos hacen que la gente los desactive.
      </p>

      {historial.length > 0 && (
        <section className="tarjeta space-y-2">
          <h3>Últimos avisos enviados</h3>
          <ul className="divide-y divide-borde">
            {historial.map((h) => (
              <li key={h.id} className="py-2">
                <p className="truncate font-semibold">{h.titulo}</p>
                <p className="text-xs text-suave">
                  {NOMBRE_DESTINO[h.destino] ?? h.destino} · {h.destinatarios} persona(s) · {haceCuanto(h.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}