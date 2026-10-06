import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from './supabaseClient'
import Contador from './Contador'
import {
  bs, nombreCompleto, enlaceDevolucion, inicioPartido, finPartido, sinTildes,
} from './formato'

const ETIQUETA_DEVOLUCION = {
  pendiente: 'Devolución pendiente',
  no_corresponde: 'Sin devolución (dinero retenido)',
  hecha: 'Devuelto',
}
const PESTANAS = [['jugadores', 'Jugadores'], ['asistencia', 'Asistencia'], ['dinero', 'Dinero']]
const nombreDe = (r) => r.nombre_invitado || nombreCompleto(r.perfil) || 'Jugador'

export default function PanelPartido({ partidoId, perfilId, onVolver }) {
  const [params, setParams] = useSearchParams()
  const [partido, setPartido] = useState(null)
  const [reservas, setReservas] = useState([])
  const [pagos, setPagos] = useState([])
  const [libres, setLibres] = useState({ jugador: 0, arquero: 0 })
  const [faltas, setFaltas] = useState({})
  const [miBonificado, setMiBonificado] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [verPendientes, setVerPendientes] = useState(false)

  const [cantidad, setCantidad] = useState(1)
  const [nombres, setNombres] = useState([])
  const [arqs, setArqs] = useState([])
  const [metodo, setMetodo] = useState('qr')
  const [aConvertir, setAConvertir] = useState(1)

  async function cargar() {
    // 7 consultas y 7 variables, en el mismo orden
    const [p, r, pg, lj, la, enc, fa] = await Promise.all([
      supabase.from('partidos').select('*').eq('id', partidoId).single(),
      supabase.from('reservas')
        .select('id, grupo_id, perfil_id, estado, vencimiento, nombre_invitado, posicion, precio, asistencia, cancelada_en, cancelacion_tipo, monto_pagado, devolucion_estado, perfil:perfiles!perfil_id(id, nombre, apellido, apodo, en_revision), creador:perfiles!creada_por(id, nombre, apellido, apodo, whatsapp, nivel, rechazos_seguidos, en_revision)')
        .eq('partido_id', partidoId)
        .order('created_at', { ascending: true }),
      supabase.from('pagos')
        .select('grupo_id, metodo, estado, monto')
        .order('created_at', { ascending: true }),
      supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'jugador' }),
      supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'arquero' }),
      supabase.from('encargados')
        .select('cuota_bonificada')
        .eq('perfil_id', perfilId)
        .eq('partido_id', partidoId),
      supabase.rpc('faltas_partido', { p_partido: partidoId }),
    ])
    const fallo = p.error || r.error || pg.error || lj.error || la.error || enc.error || fa.error
    if (fallo) return setError(fallo.message)
    const mapa = {}
    ;(fa.data ?? []).forEach((x) => { mapa[x.perfil] = x })
    setPartido(p.data)
    setReservas(r.data)
    setPagos(pg.data)
    setLibres({ jugador: lj.data ?? 0, arquero: la.data ?? 0 })
    setMiBonificado(enc.data.some((e) => e.cuota_bonificada))
    setFaltas(mapa)
  }

  useEffect(() => { cargar() }, [partidoId])

  // Ejecuta una función de la base de datos y recarga el panel
  async function ejecutar(fn, args, pregunta) {
    if (pregunta && !window.confirm(pregunta)) return false
    setError(null)
    setAviso(null)
    setTrabajando(true)
    const { error } = await supabase.rpc(fn, args)
    setTrabajando(false)
    if (error) { setError(error.message); return false }
    await cargar()
    return true
  }

  async function marcar(r, valor) {
    setError(null)
    setAviso(null)
    if (valor === 'no_asistio' && r.perfil_id && r.asistencia !== 'no_asistio') {
      const previas = faltas[r.perfil_id]?.propias ?? 0
      if (previas + 1 >= 2 && !window.confirm(
        `Esta sería la falta número ${previas + 1} de esta cuenta en 90 días: quedará en revisión ` +
        `y no podrá reservar hasta que un encargado la apruebe. ¿Confirmas la falta?`
      )) return
    }
    setTrabajando(true)
    const { data, error } = await supabase.rpc('marcar_asistencia', { p_reserva: r.id, p_valor: valor })
    setTrabajando(false)
    if (error) return setError(error.message)
    if (data?.revision) setAviso(`La cuenta de ${nombreDe(r)} quedó en revisión por faltas reiteradas.`)
    await cargar()
  }

  async function marcarTodos(n) {
    await ejecutar(
      'marcar_asistieron_pendientes',
      { p_partido: partidoId },
      `¿Marcar como "asistió" a los ${n} jugadores que quedaron sin marcar?`
    )
  }

  function reasignar(fila) {
    const nuevo = window.prompt('Nombre de la persona que ocupará este cupo:')
    if (nuevo && nuevo.trim()) {
      ejecutar('reasignar_cupo', { p_reserva: fila.id, p_nuevo_nombre: nuevo })
    }
  }

  async function marcarDevueltas(items) {
    const total = items.reduce((s, r) => s + Number(r.monto_pagado), 0)
    if (!window.confirm(`¿Ya devolviste ${bs(total)} Bs?`)) return
    setError(null)
    setTrabajando(true)
    for (const r of items) {
      const { error } = await supabase.rpc('marcar_devolucion_hecha', { p_reserva: r.id })
      if (error) { setError(error.message); break }
    }
    setTrabajando(false)
    await cargar()
  }

  if (!partido) {
    return (
      <div className="space-y-3">
        <button onClick={onVolver}>← Volver</button>
        {error ? <p className="aviso aviso-error">{error}</p> : <p className="text-suave">Cargando...</p>}
      </div>
    )
  }

  const hayArco = partido.cupos_arco > 0
  const ahora = Date.now()
  const inicio = inicioPartido(partido).getTime()
  const fin = finPartido(partido).getTime()
  const comenzo = ahora >= inicio
  const puedeAsistio = ahora >= inicio - 60 * 60 * 1000
  const enJuego = puedeAsistio && ahora <= fin + 72 * 3600 * 1000

  const tabParam = params.get('tab')
  const tab = PESTANAS.some(([id]) => id === tabParam) ? tabParam : (enJuego ? 'asistencia' : 'jugadores')

  // El último pago de cada grupo es el que manda
  const pagoDe = {}
  pagos.forEach((x) => { pagoDe[x.grupo_id] = x })

  const activas = reservas.filter((r) => r.estado !== 'cancelado')
  const canceladas = reservas.filter((r) => r.estado === 'cancelado' && r.cancelada_en)

  const gruposMapa = {}
  activas.forEach((r) => {
    if (!gruposMapa[r.grupo_id]) {
      gruposMapa[r.grupo_id] = { grupoId: r.grupo_id, filas: [], pago: pagoDe[r.grupo_id] }
    }
    gruposMapa[r.grupo_id].filas.push(r)
  })
  const grupos = Object.values(gruposMapa)

  const confirmados = activas.filter((r) => r.estado === 'confirmado')
  const porVerificar = activas.filter(
    (r) => r.estado === 'reservado' && pagoDe[r.grupo_id]?.estado === 'por_verificar'
  )
  const pendientes = activas.filter(
    (r) => r.estado === 'reservado'
      && pagoDe[r.grupo_id]?.estado !== 'por_verificar'
      && new Date(r.vencimiento).getTime() > ahora
  )
  const conArq = (lista) => {
    const a = lista.filter((r) => r.posicion === 'arquero').length
    return a > 0 ? `${lista.length} (${a} arq.)` : `${lista.length}`
  }

  // Asistencia
  const nAsistio = confirmados.filter((r) => r.asistencia === 'asistio').length
  const nFalto = confirmados.filter((r) => r.asistencia === 'no_asistio').length
  const sinMarcar = confirmados.filter((r) => r.asistencia === 'pendiente')
  const q = sinTildes(busqueda.trim())
  const base = q
    ? confirmados.filter((r) => sinTildes(`${nombreDe(r)} ${nombreCompleto(r.creador)}`).includes(q))
    : verPendientes ? sinMarcar : []
  const resultados = [...base].sort(
    (a, b) => (a.asistencia === 'pendiente' ? 0 : 1) - (b.asistencia === 'pendiente' ? 0 : 1)
  )

  // Dinero
  const idsGrupos = new Set(reservas.map((r) => r.grupo_id))
  const cobrado = pagos
    .filter((x) => idsGrupos.has(x.grupo_id) && x.estado === 'verificado' && x.metodo !== 'bonificado')
    .reduce((s, x) => s + Number(x.monto), 0)
  const sumaDevolucion = (estado) => canceladas
    .filter((r) => r.devolucion_estado === estado)
    .reduce((s, r) => s + Number(r.monto_pagado), 0)
  const devHechas = sumaDevolucion('hecha')
  const devPendientes = sumaDevolucion('pendiente')
  const retenido = sumaDevolucion('no_corresponde')
  const neto = cobrado - devHechas

  const porPersona = {}
  canceladas
    .filter((r) => r.devolucion_estado === 'pendiente')
    .forEach((r) => {
      const clave = r.creador?.id ?? 'manual'
      if (!porPersona[clave]) porPersona[clave] = { creador: r.creador, items: [] }
      porPersona[clave].items.push(r)
    })
  const gruposDev = Object.values(porPersona)
  const otrasCanc = canceladas.filter((r) => r.devolucion_estado !== 'pendiente')

  function describir(g) {
    const p = g.pago
    if (g.filas.some((f) => f.estado === 'confirmado')) {
      if (p?.metodo === 'bonificado') return '✅ Confirmado · cuota bonificada'
      if (p?.metodo === 'cancha' && p.estado === 'pendiente') return '💵 Pagará en cancha'
      if (p?.metodo === 'cancha') return '✅ Confirmado · cobrado en cancha'
      return '✅ Confirmado · pagó por QR'
    }
    if (p?.estado === 'por_verificar') return '⏳ Pago por verificar'
    const rechazado = p?.estado === 'rechazado' ? ' (pago rechazado)' : ''
    const vigente = new Date(g.filas[0].vencimiento).getTime() > ahora
    return vigente
      ? `Reservado, sin pago${rechazado}`
      : `Venció, el cupo se liberó${rechazado}`
  }

  const hayDinero = (g) =>
    g.pago && g.pago.metodo !== 'bonificado'
    && ['por_verificar', 'verificado'].includes(g.pago.estado)

  const yaTengoCupo = activas.some((r) => r.perfil_id === perfilId && r.estado === 'confirmado')

  // Formulario de agregar jugadores
  const marcas = Array.from({ length: cantidad }, (_, i) => hayArco && arqs[i] === true)
  const nArq = marcas.filter(Boolean).length
  const nJug = cantidad - nArq
  const totalAgregar = nJug * partido.cuota + nArq * partido.cuota_arquero
  const maxAgregar = Math.max(1, Math.min(10, libres.jugador + libres.arquero))

  async function agregar() {
    const lista = Array.from({ length: cantidad }, (_, i) => (nombres[i] ?? '').trim())
    if (lista.some((n) => n === '')) return setError('Escribe el nombre de cada jugador')
    if (nJug > libres.jugador) return setError(`Solo quedan ${libres.jugador} cupo(s) de jugador`)
    if (nArq > libres.arquero) return setError(`Solo quedan ${libres.arquero} cupo(s) de arquero`)
    const ok = await ejecutar('agregar_jugadores', {
      p_partido: partidoId, p_nombres: lista, p_metodo: metodo, p_arqueros: marcas,
    })
    if (ok) { setCantidad(1); setNombres([]); setArqs([]) }
  }

  const convertir = Math.min(aConvertir, Math.max(1, libres.arquero))

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={onVolver}>← Volver</button>
        <button onClick={cargar}>Actualizar</button>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold">
          {partido.cancha} · {partido.fecha} · {partido.hora.slice(0, 5)}
        </h2>
        <p className="text-sm text-suave">
          Jugadores: {libres.jugador} libres de {partido.cupos} ({bs(partido.cuota)} Bs)
          {hayArco && ` · Arqueros: ${libres.arquero} libres de ${partido.cupos_arco} (${bs(partido.cuota_arquero)} Bs)`}
        </p>
        <p className="text-sm">
          {conArq(confirmados)} confirmados · {conArq(porVerificar)} por verificar · {conArq(pendientes)} pendientes
        </p>
      </div>

      {error && <p className="aviso aviso-error">{error}</p>}
      {aviso && <p className="aviso aviso-alerta">{aviso}</p>}
      {trabajando && <p className="text-suave">Procesando...</p>}

      <nav className="flex flex-wrap gap-2">
        {PESTANAS.map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={tab === id ? 'border-transparent bg-verde text-white' : ''}
          >
            {texto}
          </button>
        ))}
      </nav>

      {/* ===================== JUGADORES ===================== */}
      {tab === 'jugadores' && (
        <div className="space-y-4">
          {miBonificado && !yaTengoCupo && (
            <button
              disabled={trabajando}
              className="btn btn-activo"
              onClick={() => ejecutar('tomar_cupo_bonificado', { p_partido: partidoId })}
            >
              Tomar mi cupo bonificado
            </button>
          )}

          {grupos.length === 0 && <p className="text-suave">Todavía no hay reservas.</p>}

          {grupos.map((g) => {
            const creador = g.filas[0].creador
            const hayPorCobrar = g.filas.some(
              (f) => f.estado === 'confirmado' && f.asistencia !== 'no_asistio'
            )
            return (
              <div key={g.grupoId} className="tarjeta space-y-2">
                <p className="text-lg font-bold">{describir(g)}</p>

                {creador ? (
                  <div className="space-y-1 text-sm">
                    <p>
                      Reservó: {nombreCompleto(creador)}
                      <span className="text-suave">
                        {' · '}{creador.nivel === 'confiable' ? 'Confiable' : 'Cuenta nueva'}
                      </span>
                    </p>
                    {creador.en_revision && (
                      <p className="font-semibold text-amarillo">🔎 Cuenta en revisión por faltas</p>
                    )}
                    {creador.rechazos_seguidos >= 2 && (
                      <p className="font-semibold text-rojo">⚠️ {creador.rechazos_seguidos} pagos rechazados</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {creador.whatsapp && (
                        <a href={`https://wa.me/${creador.whatsapp}`} target="_blank" rel="noreferrer" className="btn">
                          WhatsApp
                        </a>
                      )}
                      {creador.nivel === 'nuevo' && (
                        <button
                          disabled={trabajando}
                          onClick={() => ejecutar('aprobar_cuenta',
                            { p_perfil: creador.id, p_confiable: true },
                            '¿Marcar esta cuenta como confiable? Tendrá límites más amplios.')}
                        >
                          Marcar como confiable
                        </button>
                      )}
                      {(creador.rechazos_seguidos >= 2 || creador.en_revision) && (
                        <button
                          disabled={trabajando}
                          onClick={() => ejecutar('aprobar_cuenta',
                            { p_perfil: creador.id, p_confiable: false },
                            '¿Quitar las restricciones de esta cuenta (pagos rechazados o revisión por faltas)?')}
                        >
                          Quitar restricciones
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-suave">Agregado por el encargado</p>
                )}

                <ul className="space-y-2">
                  {g.filas.map((f) => (
                    <li key={f.id} className="space-y-1 border-t border-borde pt-2">
                      <p>
                        {nombreDe(f)}
                        {f.posicion === 'arquero' && <strong> 🧤 ARQUERO</strong>}
                        {' · '}{bs(f.precio)} Bs
                        {f.asistencia === 'asistio' && ' · ✅ asistió'}
                        {f.asistencia === 'no_asistio' && ' · ❌ faltó'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={trabajando} onClick={() => reasignar(f)}>Reasignar</button>
                        {hayDinero(g) ? (
                          <>
                            <button
                              disabled={trabajando}
                              onClick={() => ejecutar('liberar_cupo',
                                { p_reserva: f.id, p_devolver: true },
                                `¿Liberar este cupo y dejar pendiente la devolución de ${bs(f.precio)} Bs?`)}
                            >
                              Liberar y devolver
                            </button>
                            <button
                              disabled={trabajando}
                              onClick={() => ejecutar('liberar_cupo',
                                { p_reserva: f.id, p_devolver: false },
                                '¿Liberar este cupo SIN devolver el dinero?')}
                            >
                              Liberar sin devolución
                            </button>
                          </>
                        ) : (
                          <button
                            disabled={trabajando}
                            onClick={() => ejecutar('liberar_cupo',
                              { p_reserva: f.id, p_devolver: false },
                              '¿Liberar este cupo?')}
                          >
                            Liberar
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {g.pago?.estado === 'por_verificar' && (
                  <div className="space-y-2 border-t border-borde pt-2">
                    <p className="font-semibold">Monto a verificar: {bs(g.pago.monto)} Bs</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={trabajando}
                        className="btn btn-activo"
                        onClick={() => ejecutar('confirmar_pago', { p_grupo: g.grupoId })}
                      >
                        Confirmar pago
                      </button>
                      <button
                        disabled={trabajando}
                        onClick={() => ejecutar('rechazar_pago', { p_grupo: g.grupoId },
                          `¿Rechazar este pago? La persona tendrá otros ${partido.minutos_reserva} minutos para volver a intentarlo.`)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                )}

                {g.pago?.metodo === 'cancha' && g.pago.estado === 'pendiente' && (
                  hayPorCobrar ? (
                    <button
                      disabled={trabajando}
                      className="btn btn-activo"
                      onClick={() => ejecutar('cobrar_en_cancha', { p_grupo: g.grupoId },
                        '¿Ya cobraste en cancha a quienes asistieron de este grupo?')}
                    >
                      Marcar cobrado
                    </button>
                  ) : (
                    <p className="text-sm text-suave">Faltaron todos: no hay nada que cobrar en este grupo.</p>
                  )
                )}

                {!g.filas.some((f) => f.estado === 'confirmado') && g.pago?.estado !== 'por_verificar' && (
                  <button
                    disabled={trabajando}
                    onClick={() => ejecutar('cambiar_a_cancha', { p_grupo: g.grupoId },
                      '¿Pasar esta reserva a pago en cancha? El cupo quedará confirmado.')}
                  >
                    Pasar a pago en cancha
                  </button>
                )}
              </div>
            )
          })}

          <div className="tarjeta space-y-3">
            <h3 className="text-lg font-bold">Agregar jugadores</h3>
            <Contador
              etiqueta="Cantidad"
              valor={cantidad}
              min={1}
              max={maxAgregar}
              onCambio={setCantidad}
            />
            {Array.from({ length: cantidad }, (_, i) => (
              <div key={i} className="space-y-1">
                <input
                  className="w-full"
                  placeholder={`Nombre del jugador ${i + 1}`}
                  value={nombres[i] ?? ''}
                  onChange={(e) => {
                    const copia = [...nombres]
                    copia[i] = e.target.value
                    setNombres(copia)
                  }}
                />
                {hayArco && (
                  <label className="flex items-center gap-3 py-1">
                    <input
                      type="checkbox"
                      checked={arqs[i] === true}
                      onChange={(e) => {
                        const copia = [...arqs]
                        copia[i] = e.target.checked
                        setArqs(copia)
                      }}
                    />
                    Arquero
                  </label>
                )}
              </div>
            ))}
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              <option value="qr">Ya pagó (por QR)</option>
              <option value="cancha">Pagará en cancha</option>
            </select>
            <p className="font-semibold">
              Total: {bs(totalAgregar)} Bs
              {nArq > 0 && ` (${nJug} jugador y ${nArq} arquero)`}
            </p>
            <button
              disabled={trabajando || (libres.jugador + libres.arquero) < 1}
              className="btn btn-activo"
              onClick={agregar}
            >
              Agregar
            </button>
          </div>

          {hayArco && (
            <div className="tarjeta space-y-3">
              <h3 className="text-lg font-bold">Cupos de arco</h3>
              <p>{libres.arquero} libre(s) de {partido.cupos_arco}</p>
              {libres.arquero > 0 ? (
                <>
                  <p className="text-sm text-suave">
                    Si no hay arqueros suficientes, convierte los cupos de arco libres en
                    cupos de jugador. No se puede deshacer.
                  </p>
                  <Contador
                    etiqueta="Convertir"
                    valor={convertir}
                    min={1}
                    max={libres.arquero}
                    onCambio={setAConvertir}
                  />
                  <button
                    disabled={trabajando}
                    onClick={async () => {
                      const ok = await ejecutar('convertir_cupos_arco',
                        { p_partido: partidoId, p_cantidad: convertir },
                        `¿Convertir ${convertir} cupo(s) de arco libre(s) en cupos de jugador? No se puede deshacer.`)
                      if (ok) setAConvertir(1)
                    }}
                  >
                    Convertir en cupos de jugador
                  </button>
                </>
              ) : (
                <p className="text-suave">Todos los cupos de arco están ocupados.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== ASISTENCIA ===================== */}
      {tab === 'asistencia' && (
        <div className="space-y-4">
          <div className="tarjeta flex justify-around text-center">
            <div><p className="text-2xl font-bold text-verde">{nAsistio}</p><p className="text-sm text-suave">Asistieron</p></div>
            <div><p className="text-2xl font-bold text-rojo">{nFalto}</p><p className="text-sm text-suave">Faltaron</p></div>
            <div><p className="text-2xl font-bold">{sinMarcar.length}</p><p className="text-sm text-suave">Sin marcar</p></div>
          </div>

          {!puedeAsistio && (
            <p className="aviso aviso-alerta text-sm">
              La asistencia se puede marcar desde 1 hora antes del partido, y las faltas desde su inicio.
            </p>
          )}

          <input
            className="w-full"
            placeholder="Buscar jugador por nombre o apodo"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setVerPendientes(!verPendientes)}>
              {verPendientes ? 'Ocultar sin marcar' : `Mostrar sin marcar (${sinMarcar.length})`}
            </button>
            <button
              disabled={trabajando || !comenzo || sinMarcar.length === 0}
              onClick={() => marcarTodos(sinMarcar.length)}
            >
              Marcar asistieron a los sin marcar
            </button>
          </div>

          {confirmados.length === 0 && (
            <p className="text-suave">Todavía no hay cupos confirmados.</p>
          )}
          {confirmados.length > 0 && !q && !verPendientes && (
            <p className="text-suave">Escribe un nombre para buscar.</p>
          )}
          {q && resultados.length === 0 && (
            <p className="text-suave">No se encontró ningún jugador confirmado con ese nombre.</p>
          )}

          {resultados.map((r) => {
            const propias = r.perfil_id ? (faltas[r.perfil_id]?.propias ?? 0) : 0
            const deAcomp = !r.perfil_id && r.creador ? (faltas[r.creador.id]?.acompanantes ?? 0) : 0
            return (
              <div key={r.id} className="tarjeta space-y-2">
                <div>
                  <p className="text-lg font-bold">
                    {nombreDe(r)}{r.posicion === 'arquero' && ' 🧤'}
                  </p>
                  {!r.perfil_id && r.creador && (
                    <p className="text-sm text-suave">Reservó: {nombreCompleto(r.creador)}</p>
                  )}
                  {r.perfil?.en_revision && (
                    <p className="text-sm font-semibold text-amarillo">🔎 Cuenta en revisión</p>
                  )}
                  {propias > 0 && (
                    <p className="text-sm text-amarillo">⚠️ {propias} falta(s) en los últimos 90 días</p>
                  )}
                  {deAcomp > 0 && (
                    <p className="text-sm text-amarillo">
                      Acompañantes de {nombreCompleto(r.creador)} con {deAcomp} falta(s) en 90 días
                    </p>
                  )}
                  <p className="font-semibold">
                    {r.asistencia === 'asistio' && '✅ Asistió'}
                    {r.asistencia === 'no_asistio' && '❌ Faltó'}
                    {r.asistencia === 'pendiente' && 'Sin marcar'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={trabajando || !puedeAsistio || r.asistencia === 'asistio'}
                    className="btn btn-activo flex-1"
                    onClick={() => marcar(r, 'asistio')}
                  >
                    ✓ Asistió
                  </button>
                  <button
                    disabled={trabajando || !comenzo || r.asistencia === 'no_asistio'}
                    className="btn flex-1"
                    onClick={() => marcar(r, 'no_asistio')}
                  >
                    ✗ Faltó
                  </button>
                  {r.asistencia !== 'pendiente' && (
                    <button disabled={trabajando} onClick={() => marcar(r, 'pendiente')}>Deshacer</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ===================== DINERO ===================== */}
      {tab === 'dinero' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Devoluciones pendientes</h3>
          {gruposDev.length === 0 && <p className="text-suave">No hay devoluciones pendientes.</p>}
          {gruposDev.map((g) => {
            const total = g.items.reduce((s, r) => s + Number(r.monto_pagado), 0)
            return (
              <div key={g.creador?.id ?? 'manual'} className="tarjeta space-y-2">
                <p className="text-lg font-bold">{bs(total)} Bs · {g.items.length} cupo(s)</p>
                <p>
                  {g.creador
                    ? `Devolver a: ${nombreCompleto(g.creador)}`
                    : 'Cupo agregado a mano: coordina la devolución directamente con la persona.'}
                </p>
                <ul className="text-sm text-suave">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      {nombreDe(r)}{r.posicion === 'arquero' && ' (arquero)'} · {bs(r.monto_pagado)} Bs
                      {' · '}{r.cancelacion_tipo === 'tardia' ? 'cancelación tardía' : 'a tiempo'}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  {g.creador?.whatsapp && (
                    <a
                      className="btn btn-activo"
                      target="_blank"
                      rel="noreferrer"
                      href={enlaceDevolucion(g.creador, total, partido)}
                    >
                      💬 Contactar por WhatsApp
                    </a>
                  )}
                  <button disabled={trabajando} onClick={() => marcarDevueltas(g.items)}>
                    Marcar devuelto
                  </button>
                </div>
              </div>
            )
          })}

          <h3 className="text-lg font-bold">Otras cancelaciones</h3>
          {otrasCanc.length === 0 && <p className="text-suave">No hay otras cancelaciones.</p>}
          {otrasCanc.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2">
              <span>
                {nombreDe(r)}{r.posicion === 'arquero' && ' (arquero)'}
                {' · '}{r.cancelacion_tipo === 'tardia' ? 'cancelación tardía' : 'cancelación a tiempo'}
                {' · '}
                {r.devolucion_estado
                  ? `${bs(r.monto_pagado)} Bs · ${ETIQUETA_DEVOLUCION[r.devolucion_estado]}`
                  : 'sin pago'}
              </span>
              {r.devolucion_estado === 'no_corresponde' && (
                <button
                  disabled={trabajando}
                  onClick={() => ejecutar('marcar_devolucion_hecha', { p_reserva: r.id }, '¿Ya devolviste este dinero?')}
                >
                  Marcar devolución hecha
                </button>
              )}
            </div>
          ))}

          <div className="tarjeta space-y-1">
            <h3 className="text-lg font-bold">Resumen de dinero</h3>
            <p>Cobrado (QR y cancha): {bs(cobrado)} Bs</p>
            <p>Devoluciones hechas: − {bs(devHechas)} Bs</p>
            <p className="text-lg font-bold">Neto recibido: {bs(neto)} Bs</p>
            <p>Devoluciones pendientes: {bs(devPendientes)} Bs (aún por devolver)</p>
            <p>Neto si se devuelve todo lo pendiente: {bs(neto - devPendientes)} Bs</p>
            <p className="text-sm text-suave">
              Retenido por cancelaciones tardías: {bs(retenido)} Bs (ya está dentro del neto)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}