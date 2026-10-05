import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router'
import { supabase } from './supabaseClient'
import Contador from './Contador'
import Interruptor from './Interruptor'
import Canchas from './Canchas'
import Cuentas from './Cuentas'
import { bs, rangoHora, textoEquipos, finPartido } from './formato'

const MODALIDADES = ['Fútbol 11', 'Fútbol 9', 'Fútbol 8', 'Fútbol 7', 'Fútbol 6', 'Fútbol 5', 'Futsal']
const SECCIONES = [['partidos', 'Partidos'], ['canchas', 'Canchas'], ['cuentas', 'Cuentas']]

const VACIO = {
  cancha_id: '', modalidad: 'Fútbol 11', modalidad_otra: '',
  fecha: '', hora: '', hora_fin: '', cuota: '',
  cupos: 18, cupos_arco: 0, cuota_arquero: '', equipos: 0,
}

function AsignarEncargado({ partidoId, perfiles, onAsignar }) {
  const [perfilId, setPerfilId] = useState('')
  return (
    <div className="flex flex-wrap gap-2">
      <select value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>
        <option value="">Elegir encargado...</option>
        {perfiles.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre} {p.apellido ?? ''} ({p.whatsapp})</option>
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
  const { seccion } = useParams()
  const [params, setParams] = useSearchParams()
  const ver = params.get('ver')
  const filtro = ['proximos', 'pasados', 'cancelados'].includes(ver) ? ver : 'proximos'

  const [partidos, setPartidos] = useState([])
  const [encargados, setEncargados] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [canchas, setCanchas] = useState([])
  const [nuevo, setNuevo] = useState(VACIO)
  const [error, setError] = useState(null)
  const [pasadosVisibles, setPasadosVisibles] = useState(10)
  const [pendientes, setPendientes] = useState({})
  const [creando, setCreando] = useState(false)

  async function cargar() {
    // 6 consultas y 6 variables, en el mismo orden
    const [p, e, pf, c, dev, cob] = await Promise.all([
      supabase.from('partidos').select('*')
        .order('fecha', { ascending: true }).order('hora', { ascending: true }),
      supabase.from('encargados').select('id, partido_id, cuota_bonificada, perfiles(nombre, apellido, whatsapp)'),
      supabase.from('perfiles').select('id, nombre, apellido, whatsapp').eq('activo', true).order('nombre'),
      supabase.from('canchas').select('id, nombre, enlace_maps, foto_url').order('nombre'),
      supabase.from('reservas').select('partido_id').eq('devolucion_estado', 'pendiente'),
      supabase.from('pagos').select('grupo_id').eq('metodo', 'cancha').eq('estado', 'pendiente'),
    ])
    const fallo = p.error || e.error || pf.error || c.error || dev.error || cob.error
    if (fallo) return setError(fallo.message)

    // Cupos confirmados cuyo pago en cancha todavía no se cobró
    const grupos = cob.data.map((x) => x.grupo_id)
    let porCobrar = []
    if (grupos.length > 0) {
      const r = await supabase.from('reservas').select('partido_id')
        .in('grupo_id', grupos).eq('estado', 'confirmado')
      if (r.error) return setError(r.error.message)
      porCobrar = r.data
    }

    const pend = {}
    const sumar = (id, campo) => {
      pend[id] = pend[id] ?? { cobros: 0, devoluciones: 0 }
      pend[id][campo] += 1
    }
    dev.data.forEach((x) => sumar(x.partido_id, 'devoluciones'))
    porCobrar.forEach((x) => sumar(x.partido_id, 'cobros'))

    setPartidos(p.data)
    setEncargados(e.data)
    setPerfiles(pf.data)
    setCanchas(c.data)
    setPendientes(pend)
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
    const modalidad = nuevo.modalidad === '__otra' ? nuevo.modalidad_otra.trim() : nuevo.modalidad
    if (!modalidad) return setError('Escribe la modalidad del partido')
    if (modalidad.length > 30) return setError('La modalidad es demasiado larga (máximo 30 letras)')

    const fila = {
      cancha: cancha.nombre,
      cancha_id: cancha.id,
      modalidad,
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
    setCreando(false)
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

  // Todos los hooks están arriba; desde aquí solo hay cálculos
  const ahora = Date.now()
  const cancelados = partidos.filter((p) => p.estado === 'cancelado')
  const vivos = partidos.filter((p) => p.estado !== 'cancelado')
  const proximos = vivos.filter((p) => finPartido(p).getTime() >= ahora)
  const pasados = vivos
    .filter((p) => finPartido(p).getTime() < ahora)
    .reverse() // los más recientes primero
  const hayPendientePasado = pasados.some((p) => pendientes[p.id])

  const lista = filtro === 'proximos'
    ? proximos
    : filtro === 'pasados'
      ? pasados.slice(0, pasadosVisibles)
      : cancelados

  if (!SECCIONES.some(([id]) => id === seccion)) {
    return <Navigate to="/admin/partidos" replace />
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Administración</h2>
      {error && <p className="text-rojo">{error}</p>}

      <nav className="flex gap-2">
        {SECCIONES.map(([id, texto]) => (
          <NavLink
            key={id}
            to={`/admin/${id}`}
            onClick={() => setError(null)}
            className={({ isActive }) => `btn ${isActive ? 'btn-activo' : ''}`}
          >
            {texto}
          </NavLink>
        ))}
      </nav>

      {seccion === 'partidos' && (
        <div className="space-y-4">
          {!creando ? (
            <button onClick={() => setCreando(true)}>+ Nuevo partido</button>
          ) : (
            <div className="space-y-2 rounded-xl border border-borde bg-tarjeta p-3">
              <h3 className="font-bold">Nuevo partido</h3>
              {canchas.length === 0 && (
                <p className="text-suave">Primero crea una cancha en la pestaña "Canchas".</p>
              )}
              <select value={nuevo.cancha_id} onChange={cambiar('cancha_id')}>
                <option value="">Elegir cancha...</option>
                {canchas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <select value={nuevo.modalidad} onChange={cambiar('modalidad')}>
                {MODALIDADES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__otra">Otra…</option>
              </select>
              {nuevo.modalidad === '__otra' && (
                <input
                  placeholder="Ej. Fútbol 8 mixto"
                  maxLength={30}
                  value={nuevo.modalidad_otra}
                  onChange={cambiar('modalidad_otra')}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <input type="date" value={nuevo.fecha} onChange={cambiar('fecha')} />
                <label>
                  Inicio <input type="time" value={nuevo.hora} onChange={cambiar('hora')} />
                </label>
                <label>
                  Fin (opcional) <input type="time" value={nuevo.hora_fin} onChange={cambiar('hora_fin')} />
                </label>
              </div>
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
                <p className="text-amarillo">
                  Ojo: {nuevo.cupos} cupos no se dividen exactamente entre {nuevo.equipos} equipos.
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={crearPartido}>Crear partido</button>
                <button onClick={() => { setCreando(false); setNuevo(VACIO); setError(null) }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <nav className="flex flex-wrap gap-2">
            {[
              ['proximos', `Próximos (${proximos.length})`],
              ['pasados', `Pasados (${pasados.length})${hayPendientePasado ? ' ⚠️' : ''}`],
              ['cancelados', `Cancelados (${cancelados.length})`],
            ].map(([id, texto]) => (
              <button
                key={id}
                onClick={() => setParams({ ver: id }, { replace: true })}
                className={filtro === id ? 'border-transparent bg-verde text-white' : ''}
              >
                {texto}
              </button>
            ))}
          </nav>

          {filtro === 'pasados' && hayPendientePasado && (
            <p className="rounded-xl border border-amarillo p-3 text-sm">
              ⚠️ Hay partidos pasados con cobros en cancha o devoluciones sin resolver.
              Ábrelos con "Gestionar lista".
            </p>
          )}

          {lista.length === 0 && <p className="text-suave">No hay partidos en esta sección.</p>}

          {lista.map((p) => {
            const delPartido = encargados.filter((e) => e.partido_id === p.id)
            return (
              <div key={p.id} className="space-y-2 rounded-xl border border-borde bg-tarjeta p-3">
                <h4 className="font-bold">
                  {p.cancha}{p.modalidad && ` (${p.modalidad})`} · {p.fecha} · {rangoHora(p)}
                  {p.estado === 'cancelado' && ' (CANCELADO)'}
                </h4>
                <p className="text-sm text-suave">
                  Jugadores: {p.cupos} a {bs(p.cuota)} Bs
                  {p.cupos_arco > 0
                    ? ` · Arqueros: ${p.cupos_arco} a ${bs(p.cuota_arquero)} Bs`
                    : ' · Sin cupos de arco'}
                  {textoEquipos(p) && ` · ${textoEquipos(p)}`}
                </p>
                {pendientes[p.id]?.cobros > 0 && (
                  <p className="text-sm font-semibold text-amarillo">
                    ⚠️ {pendientes[p.id].cobros} cupo(s) por cobrar en cancha
                  </p>
                )}
                {pendientes[p.id]?.devoluciones > 0 && (
                  <p className="text-sm font-semibold text-amarillo">
                    ⚠️ {pendientes[p.id].devoluciones} devolución(es) pendiente(s)
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Link to={`/admin/partidos/${p.id}`} className="btn">Gestionar lista</Link>
                  {p.cupos_arco > 0 && (
                    <button onClick={() => cambiarCuotaArquero(p)}>Cuota de arquero</button>
                  )}
                  {p.estado !== 'cancelado' ? (
                    <button onClick={() => cancelarPartido(p.id)}>Cancelar partido</button>
                  ) : (
                    <button onClick={() => reactivar(p.id)}>Reactivar partido</button>
                  )}
                </div>

                <details>
                  <summary className="cursor-pointer font-semibold">
                    Encargados ({delPartido.length})
                  </summary>
                  <div className="space-y-2 pt-2">
                    {delPartido.map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center gap-2">
                        <span>{e.perfiles?.nombre} {e.perfiles?.apellido ?? ''}</span>
                        <Interruptor
                          activo={e.cuota_bonificada === true}
                          onCambio={(valor) => cambiarBonificacion(e, valor)}
                          etiqueta="Cuota bonificada"
                        />
                        <button onClick={() => quitar(e.id)}>Quitar</button>
                      </div>
                    ))}
                    <AsignarEncargado partidoId={p.id} perfiles={perfiles} onAsignar={asignar} />
                  </div>
                </details>
              </div>
            )
          })}

          {filtro === 'pasados' && pasados.length > pasadosVisibles && (
            <button onClick={() => setPasadosVisibles(pasadosVisibles + 10)}>Mostrar 10 más</button>
          )}
        </div>
      )}

      {seccion === 'canchas' && <Canchas canchas={canchas} onCambio={cargar} />}
      {seccion === 'cuentas' && <Cuentas />}
    </div>
  )
}