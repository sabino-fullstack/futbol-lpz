import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Contador from './Contador'

const MODALIDADES = ['Fútbol 11', 'Fútbol 9', 'Fútbol 8', 'Fútbol 7', 'Fútbol 6', 'Fútbol 5', 'Futsal']
const hh = (t) => (t ? t.slice(0, 5) : '')
const nn = (s) => (s.trim() === '' ? null : s.trim())

function valoresIniciales(p) {
  if (!p) {
    return {
      cancha_id: '', modalidad: 'Fútbol 11', modalidad_otra: '',
      fecha: '', hora: '', hora_fin: '', cuota: '',
      cupos: 18, cupos_arco: 0, cuota_arquero: '', equipos: 0,
      formato_juego: '', premio: '', premio_para: '', notas: '',
    }
  }
  const enLista = MODALIDADES.includes(p.modalidad)
  return {
    cancha_id: p.cancha_id ?? '',
    modalidad: p.modalidad ? (enLista ? p.modalidad : '__otra') : 'Fútbol 11',
    modalidad_otra: p.modalidad && !enLista ? p.modalidad : '',
    fecha: p.fecha, hora: hh(p.hora), hora_fin: hh(p.hora_fin),
    cuota: String(p.cuota), cupos: p.cupos, cupos_arco: p.cupos_arco,
    cuota_arquero: String(p.cuota_arquero), equipos: p.equipos ?? 0,
    formato_juego: p.formato_juego ?? '', premio: p.premio ?? '',
    premio_para: p.premio_para ?? '', notas: p.notas ?? '',
  }
}

export default function FormularioPartido({ canchas, partido, textoBoton, onGuardar, onCancelar }) {
  const [v, setV] = useState(() => valoresIniciales(partido))
  const [plantillas, setPlantillas] = useState({})
  const [formatoTocado, setFormatoTocado] = useState(!!partido?.formato_juego)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('formatos_plantilla').select('equipos, texto').then(({ data }) => {
      const m = {}
      ;(data ?? []).forEach((x) => { m[x.equipos] = x.texto })
      setPlantillas(m)
      setV((prev) =>
        !formatoTocado && prev.formato_juego === '' && m[prev.equipos]
          ? { ...prev, formato_juego: m[prev.equipos] }
          : prev
      )
    })
  }, [])

  const cambiar = (campo) => (e) => setV({ ...v, [campo]: e.target.value })

  function cambiarEquipos(n) {
    setV((prev) => {
      const sig = { ...prev, equipos: n }
      // Mientras no hayas escrito el formato a mano, sigue a la plantilla
      if (!formatoTocado) sig.formato_juego = plantillas[n] ?? ''
      return sig
    })
  }

  async function guardar() {
    setError(null)
    const cancha = canchas.find((c) => c.id === v.cancha_id)
    if (!cancha || !v.fecha || !v.hora || !v.cuota || !v.cupos) {
      return setError('Completa todos los campos')
    }
    if (v.hora_fin && v.hora_fin <= v.hora) {
      return setError('La hora de fin debe ser posterior a la de inicio')
    }
    const modalidad = v.modalidad === '__otra' ? v.modalidad_otra.trim() : v.modalidad
    if (!modalidad) return setError('Escribe la modalidad del partido')
    if (modalidad.length > 30) return setError('La modalidad es demasiado larga (máximo 30 letras)')
    const cuota = Number(v.cuota)
    if (Number.isNaN(cuota) || cuota <= 0) return setError('La cuota debe ser un número mayor que 0')
    if (v.cuota_arquero !== '' && (Number.isNaN(Number(v.cuota_arquero)) || Number(v.cuota_arquero) < 0)) {
      return setError('La cuota de arquero no es válida')
    }

    const premio = nn(v.premio)
    setGuardando(true)
    const mensaje = await onGuardar({
      cancha_id: cancha.id,
      cancha: cancha.nombre,
      modalidad,
      fecha: v.fecha,
      hora: v.hora,
      hora_fin: v.hora_fin || null,
      cuota,
      cupos: Number(v.cupos),
      cupos_arco: Number(v.cupos_arco),
      cuota_arquero: v.cuota_arquero === '' ? null : Number(v.cuota_arquero),
      equipos: v.equipos > 0 ? v.equipos : null,
      formato_juego: nn(v.formato_juego),
      premio,
      premio_para: premio ? nn(v.premio_para) : null,
      notas: nn(v.notas),
    })
    setGuardando(false)
    if (mensaje) setError(mensaje)
  }

  const porDefecto = v.equipos >= 3 ? 'Equipo con más victorias' : 'Equipo ganador'

  return (
    <div className="space-y-2">
      <h3 className="font-bold">{partido ? 'Editar partido' : 'Nuevo partido'}</h3>
      {partido && (
        <p className="aviso aviso-alerta text-sm">
          Si cambias la fecha, la hora o la cancha, la app no avisa a los jugadores: al guardar
          te ofrece un mensaje de WhatsApp. Los cambios de cuota solo afectan reservas nuevas.
        </p>
      )}
      {canchas.length === 0 && (
        <p className="text-suave">Primero crea una cancha en la pestaña "Canchas".</p>
      )}

      <select value={v.cancha_id} onChange={cambiar('cancha_id')}>
        <option value="">Elegir cancha...</option>
        {canchas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <select value={v.modalidad} onChange={cambiar('modalidad')}>
        {MODALIDADES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
        <option value="__otra">Otra…</option>
      </select>
      {v.modalidad === '__otra' && (
        <input
          placeholder="Ej. Fútbol 8 mixto"
          maxLength={30}
          value={v.modalidad_otra}
          onChange={cambiar('modalidad_otra')}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <input type="date" value={v.fecha} onChange={cambiar('fecha')} />
        <label>Inicio <input type="time" value={v.hora} onChange={cambiar('hora')} /></label>
        <label>Fin (opcional) <input type="time" value={v.hora_fin} onChange={cambiar('hora_fin')} /></label>
      </div>

      <input type="number" placeholder="Cuota (Bs)" value={v.cuota} onChange={cambiar('cuota')} />
      <Contador
        etiqueta="Cupos de jugador"
        valor={v.cupos}
        min={2}
        max={40}
        onCambio={(n) => setV({ ...v, cupos: n })}
      />
      <Contador
        etiqueta="Cupos de arco"
        valor={v.cupos_arco}
        min={0}
        max={6}
        onCambio={(n) => setV({ ...v, cupos_arco: n })}
      />
      {v.cupos_arco > 0 && (
        <input
          type="number"
          placeholder="Cuota arquero (vacío = la mitad)"
          value={v.cuota_arquero}
          onChange={cambiar('cuota_arquero')}
        />
      )}
      <Contador
        etiqueta="Equipos (0 = no indicar)"
        valor={v.equipos}
        min={0}
        max={8}
        onCambio={cambiarEquipos}
      />
      {v.equipos > 0 && v.cupos % v.equipos !== 0 && (
        <p className="text-amarillo">
          Ojo: {v.cupos} cupos no se dividen exactamente entre {v.equipos} equipos.
        </p>
      )}

      <div className="space-y-1">
        <p className="font-semibold">Cómo se juega (opcional)</p>
        <textarea
          rows={5}
          maxLength={1000}
          placeholder="Explica el formato: tiempos, rotación, desempate..."
          value={v.formato_juego}
          onChange={(e) => { setV({ ...v, formato_juego: e.target.value }); setFormatoTocado(true) }}
        />
        {plantillas[v.equipos] && v.formato_juego !== plantillas[v.equipos] && (
          <button
            type="button"
            onClick={() => { setV({ ...v, formato_juego: plantillas[v.equipos] }); setFormatoTocado(false) }}
          >
            Usar la plantilla de {v.equipos} equipos
          </button>
        )}
      </div>

      <input
        placeholder="Premio (opcional). Ej. Coca de 2 litros"
        maxLength={80}
        value={v.premio}
        onChange={cambiar('premio')}
      />
      {v.premio.trim() !== '' && (
        <input
          placeholder={`¿Quién lo gana? (vacío = "${porDefecto}")`}
          maxLength={60}
          value={v.premio_para}
          onChange={cambiar('premio_para')}
        />
      )}

      <div className="space-y-1">
        <p className="font-semibold">Notas de este partido (opcional)</p>
        <textarea
          rows={3}
          maxLength={500}
          placeholder="Ej. Traer camiseta clara y oscura."
          value={v.notas}
          onChange={cambiar('notas')}
        />
      </div>

      {error && <p className="aviso aviso-error">{error}</p>}
      <div className="flex gap-2">
        <button onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : textoBoton}
        </button>
        <button onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}