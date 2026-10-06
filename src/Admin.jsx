import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, useParams, useSearchParams } from 'react-router'
import { supabase } from './supabaseClient'
import Interruptor from './Interruptor'
import Canchas from './Canchas'
import Cuentas from './Cuentas'
import FormularioPartido from './FormularioPartido'
import { bs, rangoHora, textoEquipos, finPartido, enlaceCambio } from './formato'
import Formatos from './Formatos'

const SECCIONES = [['partidos', 'Partidos'], ['canchas', 'Canchas'], ['formatos', 'Formatos'], ['cuentas', 'Cuentas']]

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
  const [error, setError] = useState(null)
  const [pasadosVisibles, setPasadosVisibles] = useState(10)
  const [pendientes, setPendientes] = useState({})
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [aviso, setAviso] = useState(null)

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
    const r = await supabase.from('reservas').select('partido_id')
  .in('grupo_id', grupos).eq('estado', 'confirmado')
  .neq('asistencia', 'no_asistio')

    setPartidos(p.data)
    setEncargados(e.data)
    setPerfiles(pf.data)
    setCanchas(c.data)
    setPendientes(pend)
  }

  useEffect(() => { cargar() }, [])

  // Los formularios devuelven un mensaje de error (texto) o null si todo salió bien
  async function crearPartido(fila) {
    const datos = { ...fila }
    if (datos.cuota_arquero === null) delete datos.cuota_arquero // la base pone la mitad
    const { error } = await supabase.from('partidos').insert(datos)
    if (error) return error.message
    setCreando(false)
    cargar()
    return null
  }

  async function editarPartido(p, fila) {
    const { data, error } = await supabase.rpc('editar_partido', {
      p_partido: p.id,
      p_cancha_id: fila.cancha_id,
      p_modalidad: fila.modalidad,
      p_fecha: fila.fecha,
      p_hora: fila.hora,
      p_hora_fin: fila.hora_fin,
      p_cuota: fila.cuota,
      p_cupos: fila.cupos,
      p_cupos_arco: fila.cupos_arco,
      p_cuota_arquero: fila.cuota_arquero,
      p_equipos: fila.equipos,
      p_formato_juego: fila.formato_juego,
p_premio: fila.premio,
p_premio_para: fila.premio_para,
p_notas: fila.notas,
    })
    if (error) return error.message
    setEditandoId(null)
    setAviso({ partidoId: p.id, ...data })
    cargar()
    return null
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
    .reverse()
  const hayPendientePasado = pasados.some((p) => pendientes[p.id])
  const partidoAviso = aviso ? partidos.find((x) => x.id === aviso.partidoId) : null

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
      {error && <p className="aviso aviso-error">{error}</p>}

      <nav className="flex flex-wrap gap-2">
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
          {aviso && (
            <div className="aviso aviso-ok space-y-2">
              <p>
                Partido actualizado.
                {aviso.activas > 0 && ` Tiene ${aviso.activas} cupo(s) activo(s).`}
                {aviso.cambio && ' Cambiaste fecha, hora o cancha: avisa a los jugadores.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {aviso.cambio && partidoAviso && (
                  <a className="btn btn-activo" target="_blank" rel="noreferrer" href={enlaceCambio(partidoAviso)}>
                    Avisar por WhatsApp
                  </a>
                )}
                <button onClick={() => setAviso(null)}>Cerrar</button>
              </div>
            </div>
          )}

          {!creando ? (
            <button onClick={() => setCreando(true)}>+ Nuevo partido</button>
          ) : (
            <div className="tarjeta">
              <FormularioPartido
                canchas={canchas}
                textoBoton="Crear partido"
                onGuardar={crearPartido}
                onCancelar={() => setCreando(false)}
              />
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
            <p className="aviso aviso-alerta text-sm">
              ⚠️ Hay partidos pasados con cobros en cancha o devoluciones sin resolver.
              Ábrelos con "Gestionar lista".
            </p>
          )}

          {lista.length === 0 && <p className="text-suave">No hay partidos en esta sección.</p>}

          {lista.map((p) => {
            const delPartido = encargados.filter((e) => e.partido_id === p.id)

            if (editandoId === p.id) {
              return (
                <div key={p.id} className="tarjeta">
                  <FormularioPartido
                    canchas={canchas}
                    partido={p}
                    textoBoton="Guardar cambios"
                    onGuardar={(fila) => editarPartido(p, fila)}
                    onCancelar={() => setEditandoId(null)}
                  />
                </div>
              )
            }

            return (
              <div key={p.id} className="tarjeta space-y-2">
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
                  {p.estado !== 'cancelado' && (
                    <button onClick={() => { setAviso(null); setEditandoId(p.id) }}>Editar</button>
                  )}
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
      {seccion === 'formatos' && <Formatos />}
    </div>
  )
}