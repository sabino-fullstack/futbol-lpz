import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const VACIO = { cancha: '', fecha: '', hora: '', cuota: '', cupos: '' }

function AsignarEncargado({ partidoId, perfiles, onAsignar }) {
  const [perfilId, setPerfilId] = useState('')
  return (
    <div>
      <select value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>
        <option value="">Elegir encargado...</option>
        {perfiles.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre} ({p.whatsapp})</option>
        ))}
      </select>
      <button
        disabled={!perfilId}
        onClick={() => { onAsignar(partidoId, perfilId); setPerfilId('') }}
      >
        Asignar
      </button>
    </div>
  )
}

export default function Admin() {
  const [partidos, setPartidos] = useState([])
  const [encargados, setEncargados] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [nuevo, setNuevo] = useState(VACIO)
  const [error, setError] = useState(null)
  const [verCancelados, setVerCancelados] = useState(false)

  async function cargar() {
    const [p, e, pf] = await Promise.all([
      supabase.from('partidos').select('*').order('fecha', { ascending: true }),
      supabase.from('encargados').select('id, partido_id, perfiles(nombre, whatsapp)'),
      supabase.from('perfiles').select('id, nombre, whatsapp').order('nombre'),
    ])
    const fallo = p.error || e.error || pf.error
    if (fallo) return setError(fallo.message)
    setPartidos(p.data)
    setEncargados(e.data)
    setPerfiles(pf.data)
  }

  useEffect(() => { cargar() }, [])

  const cambiar = (campo) => (e) => setNuevo({ ...nuevo, [campo]: e.target.value })

  async function crearPartido() {
    setError(null)
    const { cancha, fecha, hora, cuota, cupos } = nuevo
    if (!cancha || !fecha || !hora || !cuota || !cupos) {
      return setError('Completa todos los campos')
    }
    const { error } = await supabase.from('partidos').insert({
      cancha: cancha.trim(), fecha, hora,
      cuota: Number(cuota), cupos: Number(cupos),
    })
    if (error) return setError(error.message)
    setNuevo(VACIO)
    cargar()
  }

  async function cancelarPartido(id) {
    if (!window.confirm('¿Cancelar este partido?')) return
    const { error } = await supabase.from('partidos').update({ estado: 'cancelado' }).eq('id', id)
    if (error) return setError(error.message)
    cargar()
  }
  async function reactivar(id) {
  const { error } = await supabase.from('partidos').update({ estado: 'abierto' }).eq('id', id)
  if (error) return setError(error.message)
  cargar()
}

  async function asignar(partidoId, perfilId) {
    setError(null)
    const { error } = await supabase.from('encargados')
      .insert({ partido_id: partidoId, perfil_id: perfilId })
    if (error) {
      return setError(error.code === '23505'
        ? 'Esa persona ya es encargada de este partido'
        : error.message)
    }
    cargar()
  }

  async function quitar(id) {
    const { error } = await supabase.from('encargados').delete().eq('id', id)
    if (error) return setError(error.message)
    cargar()
  }

  const visibles = partidos.filter((p) => verCancelados || p.estado !== 'cancelado')

  return (
    <div>
      <h2>Administración</h2>
      {error && <p>{error}</p>}

      <h3>Nuevo partido</h3>
      <input placeholder="Cancha" value={nuevo.cancha} onChange={cambiar('cancha')} />
      <input type="date" value={nuevo.fecha} onChange={cambiar('fecha')} />
      <input type="time" value={nuevo.hora} onChange={cambiar('hora')} />
      <input type="number" placeholder="Cuota (Bs)" value={nuevo.cuota} onChange={cambiar('cuota')} />
      <input type="number" placeholder="Cupos" value={nuevo.cupos} onChange={cambiar('cupos')} />
      <button onClick={crearPartido}>Crear partido</button>

      <h3>Partidos</h3>
<label>
  <input
    type="checkbox"
    checked={verCancelados}
    onChange={(e) => setVerCancelados(e.target.checked)}
  />{' '}
  Mostrar cancelados
</label>

{visibles.map((p) => (
        <div key={p.id}>
          <h4>
            {p.cancha} · {p.fecha} · {p.hora.slice(0, 5)}
            {p.estado === 'cancelado' && ' (CANCELADO)'}
          </h4>
          <p>{p.cuota} Bs · {p.cupos} cupos</p>

          <p>Encargados:</p>
          {encargados.filter((e) => e.partido_id === p.id).map((e) => (
            <div key={e.id}>
              {e.perfiles?.nombre}
              <button onClick={() => quitar(e.id)}>Quitar</button>
            </div>
          ))}
          <AsignarEncargado partidoId={p.id} perfiles={perfiles} onAsignar={asignar} />

          {p.estado !== 'cancelado' && (
            <button onClick={() => cancelarPartido(p.id)}>Cancelar partido</button>
          )}
          {p.estado === 'cancelado' && (
  <button onClick={() => reactivar(p.id)}>Reactivar partido</button>
)}
        </div>
      ))}
    </div>
  )
}