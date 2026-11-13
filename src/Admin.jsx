import { useEffect, useState } from 'react'
import { NavLink, Navigate, useParams, useSearchParams } from 'react-router'
import { Megaphone } from 'lucide-react'
import { supabase } from './supabaseClient'
import Interruptor from './Interruptor'
import Canchas from './Canchas'
import Cuentas from './Cuentas'
import Formatos from './Formatos'
import Finanzas from './Finanzas'
import FormularioPartido from './FormularioPartido'
import MensajeGrupo from './MensajeGrupo'
import {
  bs, rangoHora, textoEquipos, finPartido, fechaCorta, sumarDias,
  enlaceCambio, enlaceCancelacion,
} from './formato'
import Analisis from './Analisis'
import EnviarAviso from './EnviarAviso'


const SECCIONES = [['partidos', 'Partidos'], ['finanzas', 'Finanzas'], ['analisis', 'Análisis'], ['canchas', 'Canchas'], ['formatos', 'Formatos'], ['cuentas', 'Cuentas'], ['avisos', 'Avisos']]

function AsignarEncargado({ partidoId, perfiles, onAsignar }) {
  const [perfilId, setPerfilId] = useState('')
  const [tipo, setTipo] = useState('encargado')
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select value={perfilId} onChange={(e) => setPerfilId(e.target.value)}>
          <option value="">Elegir persona...</option>
          {perfiles.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre} {p.apellido ?? ''} ({p.whatsapp})</option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="encargado">Encargado (con QR y pagos)</option>
          <option value="ayudante">Ayudante (asistencia y cobros en cancha)</option>
        </select>
        <button
          disabled={!perfilId}
          onClick={() => { onAsignar(partidoId, perfilId, tipo); setPerfilId('') }}
        >
          Asignar
        </button>
      </div>
      {tipo === 'ayudante' && (
        <p className="text-xs text-suave">
          El ayudante no sube QR ni confirma pagos: solo marca asistencia y cobra en cancha.
          Los jugadores verán únicamente el QR de los encargados.
        </p>
      )}
    </div>
  )
}

// Propio o de un organizador, con su tarifa
function AcuerdoPartido({ acuerdo, perfiles, partidoId, onCambio, onError }) {
  const [editando, setEditando] = useState(false)
  const [org, setOrg] = useState(acuerdo?.organizador_id ?? '')
  const [fija, setFija] = useState(String(acuerdo?.tarifa_fija ?? 20))
  const [pct, setPct] = useState(String(acuerdo?.tarifa_pct ?? 0))
  const [cancelado, setCancelado] = useState(acuerdo?.cobrar_si_cancelado ?? false)
  const [trabajando, setTrabajando] = useState(false)

  const organizador = acuerdo ? perfiles.find((p) => p.id === acuerdo.organizador_id) : null

  async function guardar() {
    onError(null)
    const f = Number(fija.replace(',', '.'))
    const pc = Number(pct.replace(',', '.'))
    if (!org) return onError('Elige al organizador')
    if (fija === '' || Number.isNaN(f) || f < 0 || f > 9999) return onError('La tarifa fija debe estar entre 0 y 9999')
    if (pct === '' || Number.isNaN(pc) || pc < 0 || pc > 100) return onError('El porcentaje debe estar entre 0 y 100')
    if (!acuerdo && !window.confirm(
      'Este partido pasará a ser de un organizador: tus ingresos de este partido serán solo la tarifa, ' +
      'no lo que se cobre a los jugadores. ¿Continuar?'
    )) return
    setTrabajando(true)
    const { error } = await supabase.rpc('guardar_acuerdo', {
      p_partido: partidoId, p_organizador: org, p_fija: f, p_pct: pc, p_cobrar_cancelado: cancelado,
    })
    setTrabajando(false)
    if (error) return onError(error.message)
    setEditando(false)
    onCambio()
  }

  async function quitar() {
    if (!window.confirm(
      'Este partido volverá a ser propio: contará todo lo que se cobre. Si el organizador sigue como ' +
      'encargado, sus pagos por QR irán a su cuenta: quítalo de "Encargados" y sube tu propio QR. ¿Continuar?'
    )) return
    onError(null)
    setTrabajando(true)
    const { error } = await supabase.rpc('quitar_acuerdo', { p_partido: partidoId })
    setTrabajando(false)
    if (error) return onError(error.message)
    onCambio()
  }

  if (!editando) {
    return acuerdo ? (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-amarillo/15 px-2 py-0.5 text-xs font-bold text-amarillo-texto">
          De {organizador ? `${organizador.nombre} ${organizador.apellido ?? ''}` : 'un organizador'}
        </span>
        <span className="text-suave">
          Tarifa {bs(acuerdo.tarifa_fija)} Bs{Number(acuerdo.tarifa_pct) > 0 ? ` + ${acuerdo.tarifa_pct} %` : ''}
          {acuerdo.cobrada_en ? ' · cobrada' : ' · pendiente'}
        </span>
        <button disabled={trabajando} onClick={() => setEditando(true)}>Cambiar</button>
        <button disabled={trabajando} onClick={quitar}>Volver a propio</button>
      </div>
    ) : (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-suave">Partido propio</span>
        <button onClick={() => setEditando(true)}>Pasar a organizador</button>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-borde p-3">
      <select value={org} onChange={(e) => setOrg(e.target.value)}>
        <option value="">Elegir organizador...</option>
        {perfiles.map((p) => (
          <option key={p.id} value={p.id}>{p.nombre} {p.apellido ?? ''} ({p.whatsapp})</option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <label>
          Tarifa fija (Bs){' '}
          <input className="w-24" inputMode="decimal" value={fija} onChange={(e) => setFija(e.target.value)} />
        </label>
        <label>
          + Porcentaje (%){' '}
          <input className="w-24" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-3 py-1">
        <input type="checkbox" checked={cancelado} onChange={(e) => setCancelado(e.target.checked)} />
        Cobrar la tarifa aunque el partido se cancele
      </label>
      <div className="flex gap-2">
        <button disabled={trabajando} className="btn btn-activo" onClick={guardar}>Guardar</button>
        <button onClick={() => setEditando(false)}>Cancelar</button>
      </div>
    </div>
  )
}

export default function Admin({ perfilId }) {
  const { seccion } = useParams()
  const [params, setParams] = useSearchParams()
  const ver = params.get('ver')
  const filtro = ['proximos', 'pasados', 'cancelados'].includes(ver) ? ver : 'proximos'

  const [partidos, setPartidos] = useState([])
  const [encargados, setEncargados] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [canchas, setCanchas] = useState([])
  const [acuerdos, setAcuerdos] = useState({})
  const [error, setError] = useState(null)
  const [pasadosVisibles, setPasadosVisibles] = useState(10)
  const [creando, setCreando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [duplicandoId, setDuplicandoId] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [avisoCancel, setAvisoCancel] = useState(null)
  const [avisoCreado, setAvisoCreado] = useState(null)
  const [verMensaje, setVerMensaje] = useState(false)

  async function cargar() {
    // 5 consultas y 5 variables, en el mismo orden
    const [p, e, pf, c, ac] = await Promise.all([
      supabase.from('partidos').select('*')
        .order('fecha', { ascending: true }).order('hora', { ascending: true }),
      supabase.from('encargados')
        .select('id, partido_id, perfil_id, tipo, qr_url, cuota_bonificada, perfiles(nombre, apellido, whatsapp)'),
      supabase.from('perfiles').select('id, nombre, apellido, whatsapp').eq('activo', true).order('nombre'),
      supabase.from('canchas').select('id, nombre, enlace_maps, foto_url, foto_mini_url, direccion, referencia, recomendaciones').order('nombre'),
      supabase.from('acuerdos_partido')
        .select('partido_id, organizador_id, tarifa_fija, tarifa_pct, cobrar_si_cancelado, cobrada_en'),
    ])
    const fallo = p.error || e.error || pf.error || c.error || ac.error
    if (fallo) return setError(fallo.message)
    const mapa = {}
    ac.data.forEach((x) => { mapa[x.partido_id] = x })
    setPartidos(p.data)
    setEncargados(e.data)
    setPerfiles(pf.data)
    setCanchas(c.data)
    setAcuerdos(mapa)
  }

  useEffect(() => { cargar() }, [])

  // Los formularios devuelven un mensaje de error (texto) o null si todo salió bien.
  // `origen` es el partido duplicado (si lo hay): de ahí se copian los encargados.
  async function crearPartido(fila, extras = {}, origen = null) {
    const semanas = Math.max(0, Math.min(8, Number(extras.semanas) || 0))
    const filas = Array.from({ length: semanas + 1 }, (_, i) => {
      const d = { ...fila, fecha: sumarDias(fila.fecha, 7 * i) }
      if (d.cuota_arquero === null) delete d.cuota_arquero // la base pone la mitad
      return d
    })

    const { data, error } = await supabase.from('partidos').insert(filas).select('id, fecha')
    if (error) return error.message

    // Acuerdo con un organizador (también define quién queda como encargado)
    let falloAcuerdo = null
    if (extras.acuerdo) {
      for (const p of data) {
        const r = await supabase.rpc('guardar_acuerdo', {
          p_partido: p.id,
          p_organizador: extras.acuerdo.organizador_id,
          p_fija: extras.acuerdo.fija,
          p_pct: extras.acuerdo.pct,
          p_cobrar_cancelado: extras.acuerdo.cobrar_cancelado,
        })
        if (r.error) { falloAcuerdo = r.error.message; break }
      }
    }

    // Sin acuerdo, se copian los encargados del partido duplicado
    let copiados = 0
    let fallaCopia = false
    if (origen && extras.copiarEncargados && !extras.acuerdo) {
      const base = encargados.filter((e) => e.partido_id === origen.id)
      const nuevas = data.flatMap((p) =>
        base.map((e) => ({
          partido_id: p.id,
          perfil_id: e.perfil_id,
          tipo: e.tipo,
          cuota_bonificada: e.tipo === 'encargado' ? e.cuota_bonificada : false,
          qr_url: e.tipo === 'encargado' ? e.qr_url : null,
        }))
      )
      if (nuevas.length > 0) {
        const r = await supabase.from('encargados').insert(nuevas)
        if (r.error) fallaCopia = true
        else copiados = base.length
      }
    }

    const organizador = extras.acuerdo
      ? perfiles.find((x) => x.id === extras.acuerdo.organizador_id) : null

    setCreando(false)
    setDuplicandoId(null)
    setAvisoCreado({
      n: data.length,
      primera: filas[0].fecha,
      ultima: filas[filas.length - 1].fecha,
      copiados,
      fallaCopia,
      falloAcuerdo,
      organizador: organizador ? `${organizador.nombre} ${organizador.apellido ?? ''}`.trim() : null,
    })
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

  async function cancelarPartido(p) {
    const motivo = window.prompt(
      `Motivo de la cancelación del partido en ${p.cancha} (${p.fecha}). Lo verán los jugadores:`
    )
    if (motivo === null) return
    if (!motivo.trim()) return setError('Escribe el motivo de la cancelación')
    if (!window.confirm(
      'Se liberarán todas las reservas y quienes ya pagaron quedarán con la devolución pendiente. ¿Cancelar el partido?'
    )) return
    setError(null)
    setAviso(null)
    const { data, error } = await supabase.rpc('cancelar_partido', { p_partido: p.id, p_motivo: motivo })
    if (error) return setError(error.message)
    setAvisoCancel({ partidoId: p.id, motivo: motivo.trim(), ...data })
    cargar()
  }

  async function reactivar(id) {
    const { error } = await supabase.rpc('reactivar_partido', { p_partido: id })
    if (error) return setError(error.message)
    cargar()
  }

  async function asignar(partidoId, perfilId, tipo) {
    setError(null)
    const { error } = await supabase.from('encargados')
      .insert({ partido_id: partidoId, perfil_id: perfilId, tipo })
    if (error) {
      return setError(error.code === '23505'
        ? 'Esa persona ya tiene un rol en este partido. Quítala y vuelve a asignarla si quieres cambiarlo.'
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
  const pasados = vivos.filter((p) => finPartido(p).getTime() < ahora).reverse()
  const partidoAviso = aviso ? partidos.find((x) => x.id === aviso.partidoId) : null
  const partidoCancel = avisoCancel ? partidos.find((x) => x.id === avisoCancel.partidoId) : null
  const otrosPerfiles = perfiles.filter((x) => x.id !== perfilId)

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
      <h2>Administración</h2>
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

          {avisoCancel && (
            <div className="aviso aviso-ok space-y-2">
              <p>
                Partido cancelado. {avisoCancel.reservas} reserva(s) liberada(s)
                {avisoCancel.devoluciones > 0 &&
                  `, ${avisoCancel.devoluciones} con devolución pendiente por ${bs(avisoCancel.monto)} Bs (el encargado las ve en "A mi cargo")`}.
              </p>
              <div className="flex flex-wrap gap-2">
                {partidoCancel && (
                  <a className="btn btn-activo" target="_blank" rel="noreferrer"
                     href={enlaceCancelacion(partidoCancel, avisoCancel.motivo)}>
                    Avisar por WhatsApp
                  </a>
                )}
                <button onClick={() => setAvisoCancel(null)}>Cerrar</button>
              </div>
            </div>
          )}

          {avisoCreado && (
            <div className={`aviso space-y-2 ${avisoCreado.falloAcuerdo ? 'aviso-alerta' : 'aviso-ok'}`}>
              <p>
                {avisoCreado.n === 1
                  ? 'Partido creado.'
                  : `Se crearon ${avisoCreado.n} partidos, uno por semana (del ${fechaCorta(avisoCreado.primera)} al ${fechaCorta(avisoCreado.ultima)}).`}
                {avisoCreado.organizador && !avisoCreado.falloAcuerdo &&
                  ` Organiza ${avisoCreado.organizador}: queda como encargado y tú registras solo la tarifa.`}
                {avisoCreado.copiados > 0 && ` Se copiaron ${avisoCreado.copiados} encargado(s) con su QR.`}
                {avisoCreado.fallaCopia && ' Los partidos se crearon, pero no se pudieron copiar los encargados: asígnalos a mano.'}
                {avisoCreado.falloAcuerdo && ` Los partidos se crearon, pero el acuerdo falló: ${avisoCreado.falloAcuerdo} Puedes definirlo en cada partido con "Pasar a organizador".`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { setVerMensaje(true); setAvisoCreado(null) }}>
                  Armar mensaje para el grupo
                </button>
                <button onClick={() => setAvisoCreado(null)}>Cerrar</button>
              </div>
            </div>
          )}

          <button onClick={() => setVerMensaje(!verMensaje)}>
            <Megaphone size={16} /> Mensaje para el grupo
          </button>
          {verMensaje && <MensajeGrupo partidos={partidos} />}

          {!creando ? (
            <button onClick={() => setCreando(true)}>+ Nuevo partido</button>
          ) : (
            <div className="tarjeta">
              <FormularioPartido
                canchas={canchas}
                perfiles={otrosPerfiles}
                textoBoton="Crear partido"
                onGuardar={(fila, extras) => crearPartido(fila, extras)}
                onCancelar={() => setCreando(false)}
              />
            </div>
          )}

          <nav className="flex flex-wrap gap-2">
            {[
              ['proximos', `Próximos (${proximos.length})`],
              ['pasados', `Pasados (${pasados.length})`],
              ['cancelados', `Cancelados (${cancelados.length})`],
            ].map(([id, texto]) => (
              <button
                key={id}
                onClick={() => setParams({ ver: id }, { replace: true })}
                className={filtro === id ? 'border-transparent bg-verde text-sobre-verde' : ''}
              >
                {texto}
              </button>
            ))}
          </nav>

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

            if (duplicandoId === p.id) {
              return (
                <div key={p.id} className="tarjeta">
                  <FormularioPartido
                    canchas={canchas}
                    base={p}
                    perfiles={otrosPerfiles}
                    acuerdoBase={acuerdos[p.id] ?? null}
                    textoBoton="Crear"
                    onGuardar={(fila, extras) => crearPartido(fila, extras, p)}
                    onCancelar={() => setDuplicandoId(null)}
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

                <AcuerdoPartido
                  key={`${p.id}-${acuerdos[p.id]?.organizador_id ?? 'propio'}-${acuerdos[p.id]?.tarifa_fija ?? ''}-${acuerdos[p.id]?.tarifa_pct ?? ''}`}
                  partidoId={p.id}
                  acuerdo={acuerdos[p.id] ?? null}
                  perfiles={otrosPerfiles}
                  onCambio={cargar}
                  onError={setError}
                />

                <div className="flex flex-wrap gap-2">
                  {p.estado !== 'cancelado' && (
                    <button onClick={() => { setAviso(null); setDuplicandoId(null); setEditandoId(p.id) }}>
                      Editar
                    </button>
                  )}
                  <button onClick={() => { setAviso(null); setEditandoId(null); setCreando(false); setDuplicandoId(p.id) }}>
                    Duplicar
                  </button>
                  {p.estado !== 'cancelado' ? (
                    <button onClick={() => cancelarPartido(p)}>Cancelar partido</button>
                  ) : (
                    <button onClick={() => reactivar(p.id)}>Reactivar partido</button>
                  )}
                </div>

                <details>
                  <summary className="cursor-pointer font-semibold">
                    Encargados y ayudantes ({delPartido.length})
                  </summary>
                  <div className="space-y-2 pt-2">
                    {delPartido.map((e) => (
                      <div key={e.id} className="flex flex-wrap items-center gap-2">
                        <span>{e.perfiles?.nombre} {e.perfiles?.apellido ?? ''}</span>
                        {e.tipo === 'ayudante' ? (
                          <span className="rounded-full bg-borde px-2 py-0.5 text-xs font-bold text-suave">Ayudante</span>
                        ) : (
                          <Interruptor
                            activo={e.cuota_bonificada === true}
                            onCambio={(valor) => cambiarBonificacion(e, valor)}
                            etiqueta="Cuota bonificada"
                          />
                        )}
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

      {seccion === 'finanzas' && <Finanzas canchas={canchas} />}
      {seccion === 'canchas' && <Canchas canchas={canchas} onCambio={cargar} />}
      {seccion === 'formatos' && <Formatos />}
      {seccion === 'cuentas' && <Cuentas />}
      {seccion === 'analisis' && <Analisis />}
      {seccion === 'avisos' && <EnviarAviso />}
    </div>
  )
}