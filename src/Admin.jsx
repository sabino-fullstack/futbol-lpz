import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Contador from './Contador'
import PanelPartido from './PanelPartido'
import Interruptor from './Interruptor'
import Canchas from './Canchas'
import { bs, rangoHora, textoEquipos } from './formato'

const VACIO = {
  cancha_id: '', fecha: '', hora: '', hora_fin: '', cuota: '',
  cupos: 18, cupos_arco: 0, cuota_arquero: '', equipos: 0,
}

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

export default function Admin({ perfilId }) {
  const [partidos, setPartidos] = useState([])
  const [encargados, setEncargados] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [canchas, setCanchas] = useState([])
  const [nuevo, setNuevo] = useState(VACIO)
  const [error, setError] = useState(null)
  const [verCancelados, setVerCancelados] = useState(false)
  const [gestionando, setGestionando] = useState(null)

  async function cargar() {
    const [p, e, pf, c] = await Promise.all([
      supabase.from('partidos').select('*').order('fecha', { ascending: true }),
      supabase.from('encargados').select('id, partido_id, cuota_bonificada, perfiles(nombre, whatsapp)'),
      supabase.from('perfiles').select('id, nombre, whatsapp').order('nombre'),
      supabase.from('canchas').select('id, nombre, enlace_maps, foto_url').order('nombre'),
    ])
    const fallo = p.error || e.error || pf.error || c.error
    if (fallo) return setError(fallo.message)
    setPartidos(p.data)
    setEncargados(e.data)
    setPerfiles(pf.data)
    setCanchas(c.data)
  }

  useEffect(() => { cargar() }, [])

  const cambiar = (campo) => (e) => setNuevo({ ...nuevo, [campo]: e.target.value })

  async function crearPartido() {
    setError(null)
    const { cancha_id, fecha, hora, hora_fin, cuota, cupos, equipos } = nuevo
    const cancha = canchas.find((c) => c.id === cancha_id)
    if (!cancha || !fecha || !hora || !cuota || !cupos) {
      return setError('Completa todos los campos')
    }
    if (hora_fin && hora_fin <= hora) {
      return setError('La hora de fin debe ser posterior a la de inicio')
    }
    const fila = {
      cancha: cancha.nombre,
      cancha_id: cancha.id,
      fecha, hora,
      hora_fin: hora_fin || null,
      cuota: Number(cuota),
      cupos: Number(cupos),
      cupos_arco: Number(nuevo.cupos_arco),
      equipos: equipos > 0 ? equipos : null,
    }
    // Si se deja vacía, la base de datos pone la mitad de la cuota
    if (nuevo.cuota_arquero !== '') fila.cuota_arquero = Number(nuevo.cuota_arquero)

    const { error } = await supabase.from('partidos').insert(fila)
    if (error) return setError(error.message)
    setNuevo(VACIO)
    cargar()
  }

  async function cambiarCuotaArquero(p) {
    const texto = window.prompt(
      `Nueva cuota de arquero (hoy ${bs(p.cuota_arquero)} Bs). Solo afecta reservas nuevas:`
    )
    if (texto === null) return
    const valor = Number(texto)
    if (texto.trim() === '' || Number.isNaN(valor) || valor < 0) {
      return setError('Escribe un número válido')
    }
    const { error } = await supabase.from('partidos')
      .update({ cuota_arquero: valor }).eq('id', p.id)
    if (error) return setError(error.message)
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

  async function cambiarBonificacion(e, activar) {
    setError(null)
    const { data, error } = await supabase
      .from('encargados')
      .update({ cuota_bonificada: activar })
      .eq('id', e.id)
      .select('id')
    if (error) return setError(error.message)
    if (!data || data.length === 0) {
      return setError('No se pudo cambiar la bonificación')
    }
    cargar()
  }

  const visibles = partidos.filter((p) => verCancelados || p.estado !== 'cancelado')

  if (gestionando) {
    return (
      <PanelPartido
        partidoId={gestionando}
        perfilId={perfilId}
        onVolver={() => setGestionando(null)}
      />
    )
  }

  return (
    <div>
      <h2>Administración</h2>
      {error && <p>{error}</p>}

      <h3>Nuevo partido</h3>
      {canchas.length === 0 && <p>Primero crea una cancha (más abajo en esta pantalla).</p>}
      <select value={nuevo.cancha_id} onChange={cambiar('cancha_id')}>
        <option value="">Elegir cancha...</option>
        {canchas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <input type="date" value={nuevo.fecha} onChange={cambiar('fecha')} />
      <label>
        Inicio <input type="time" value={nuevo.hora} onChange={cambiar('hora')} />
      </label>
      <label>
        Fin (opcional) <input type="time" value={nuevo.hora_fin} onChange={cambiar('hora_fin')} />
      </label>
      <input type="number" placeholder="Cuota (Bs)" value={nuevo.cuota} onChange={cambiar('cuota')} />
      <Contador
        etiqueta="Cupos de jugador:"
        valor={nuevo.cupos}
        min={2}
        max={40}
        onCambio={(v) => setNuevo({ ...nuevo, cupos: v })}
      />
      <Contador
        etiqueta="Cupos de arco:"
        valor={nuevo.cupos_arco}
        min={0}
        max={6}
        onCambio={(v) => setNuevo({ ...nuevo, cupos_arco: v })}
      />
      {nuevo.cupos_arco > 0 && (
        <input
          type="number"
          placeholder="Cuota arquero (vacío = la mitad)"
          value={nuevo.cuota_arquero}
          onChange={cambiar('cuota_arquero')}
        />
      )}
      <Contador
        etiqueta="Equipos (0 = no indicar):"
        valor={nuevo.equipos}
        min={0}
        max={8}
        onCambio={(v) => setNuevo({ ...nuevo, equipos: v })}
      />
      {nuevo.equipos > 0 && nuevo.cupos % nuevo.equipos !== 0 && (
        <p>
          Ojo: {nuevo.cupos} cupos no se dividen exactamente entre {nuevo.equipos} equipos.
        </p>
      )}
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
            {p.cancha} · {p.fecha} · {rangoHora(p)}
            {p.estado === 'cancelado' && ' (CANCELADO)'}
          </h4>
          <p>
            Jugadores: {p.cupos} a {bs(p.cuota)} Bs
            {p.cupos_arco > 0
              ? ` · Arqueros: ${p.cupos_arco} a ${bs(p.cuota_arquero)} Bs`
              : ' · Sin cupos de arco'}
          </p>
          {textoEquipos(p) && <p>{textoEquipos(p)}</p>}
          {p.cupos_arco > 0 && (
            <button onClick={() => cambiarCuotaArquero(p)}>Cambiar cuota de arquero</button>
          )}

          <p>Encargados:</p>
          {encargados.filter((e) => e.partido_id === p.id).map((e) => (
            <div key={e.id}>
              {e.perfiles?.nombre}{' '}
              <Interruptor
                activo={e.cuota_bonificada === true}
                onCambio={(valor) => cambiarBonificacion(e, valor)}
                etiqueta="Cuota bonificada"
              />{' '}
              <button onClick={() => quitar(e.id)}>Quitar</button>
            </div>
          ))}
          <AsignarEncargado partidoId={p.id} perfiles={perfiles} onAsignar={asignar} />

          {p.estado !== 'cancelado' && (
            <button onClick={() => cancelarPartido(p.id)}>Cancelar partido</button>
          )}
          <button onClick={() => setGestionando(p.id)}>Gestionar lista</button>
          {p.estado === 'cancelado' && (
            <button onClick={() => reactivar(p.id)}>Reactivar partido</button>
          )}
        </div>
      ))}

      <h3>Canchas</h3>
      <Canchas canchas={canchas} onCambio={cargar} />
    </div>
  )
}