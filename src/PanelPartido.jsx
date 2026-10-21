import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Banknote, ChevronLeft, Hand, MessageCircle, RefreshCw, RotateCcw, Search, UserCheck, UserX,
} from 'lucide-react'
import { supabase } from './supabaseClient'
import Contador from './Contador'
import Cargando from './Cargando'
import Etiqueta, { BORDE_IZQ } from './EtiquetaEstado'
import { claveCupo } from './estados'
import {
  bs, nombreCompleto, enlaceDevolucion, inicioPartido, finPartido, sinTildes,
} from './formato'

const ETIQUETA_DEVOLUCION = {
  pendiente: 'Devolución pendiente',
  no_corresponde: 'Sin devolución (dinero retenido)',
  hecha: 'Devuelto',
}
const PESTANAS = [['jugadores', 'Jugadores'], ['asistencia', 'Asistencia'], ['dinero', 'Dinero']]
const ORDEN_ASIST = { pendiente: 0, asistio: 1, no_asistio: 2 }
const nombreDe = (r) => r.nombre_invitado || nombreCompleto(r.perfil) || 'Jugador'

function colorGrupo(claves) {
  if (claves.some((c) => c === 'por_verificar' || c === 'cancha_debe')) return 'amarillo'
  if (claves.includes('rechazado')) return 'rojo'
  if (claves.some((c) => c === 'reservado' || c === 'vencido')) return 'gris'
  return 'verde'
}

function Filtros({ opciones, valor, onCambio }) {
  return (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
      {opciones.map(([id, texto, n]) => (
        <button
          key={id}
          onClick={() => onCambio(id)}
          aria-pressed={valor === id}
          className={`shrink-0 whitespace-nowrap ${
            valor === id ? 'border-transparent bg-verde text-sobre-verde' : ''
          }`}
        >
          {texto} <span className="opacity-70">{n}</span>
        </button>
      ))}
    </div>
  )
}

function Buscador({ valor, onCambio, placeholder }) {
  return (
    <div className="relative">
      <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-suave" />
      <input
        className="w-full pl-10"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
    </div>
  )
}

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
  const [filtroA, setFiltroA] = useState('todos')
  const [filtroJ, setFiltroJ] = useState('todos')

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
        .select('id, grupo_id, perfil_id, estado, vencimiento, nombre_invitado, posicion, precio, asistencia, cobrado_en, cancelada_en, cancelacion_tipo, monto_pagado, devolucion_estado, perfil:perfiles!perfil_id(id, nombre, apellido, apodo, en_revision), creador:perfiles!creada_por(id, nombre, apellido, apodo, whatsapp, nivel, rechazos_seguidos, en_revision)')
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

  function cobrar(r, valor) {
    return ejecutar(
      'cobrar_cupo',
      { p_reserva: r.id, p_cobrado: valor },
      valor ? null : `¿Deshacer el cobro de ${nombreDe(r)}?`
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
        <button onClick={onVolver} className="btn"><ChevronLeft size={18} /> Volver</button>
        {error ? <p className="aviso aviso-error">{error}</p> : <Cargando />}
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

  const pagoDe = {}
  pagos.forEach((x) => { pagoDe[x.grupo_id] = x })

  const activas = reservas.filter((r) => r.estado !== 'cancelado')
  const canceladas = reservas.filter((r) => r.estado === 'cancelado' && r.cancelada_en)
  const clave = (r) => claveCupo(r, pagoDe[r.grupo_id], ahora)

  const gruposMapa = {}
  activas.forEach((r) => {
    if (!gruposMapa[r.grupo_id]) {
      gruposMapa[r.grupo_id] = { grupoId: r.grupo_id, filas: [], pago: pagoDe[r.grupo_id] }
    }
    gruposMapa[r.grupo_id].filas.push(r)
  })
  const grupos = Object.values(gruposMapa)

  const confirmados = activas.filter((r) => r.estado === 'confirmado')
  const porVerificar = activas.filter((r) => clave(r) === 'por_verificar')
  const pendientes = activas.filter((r) => clave(r) === 'reservado' || clave(r) === 'rechazado')
  const conArq = (lista) => {
    const a = lista.filter((r) => r.posicion === 'arquero').length
    return a > 0 ? `${lista.length} (${a} arq.)` : `${lista.length}`
  }

  const q = sinTildes(busqueda.trim())
  const coincideTexto = (r) =>
    !q || sinTildes(`${nombreDe(r)} ${nombreCompleto(r.creador)}`).includes(q)

  // ---------- Asistencia ----------
  const filas = confirmados.map((r) => ({ r, c: clave(r) }))
  const debe = (f) => f.c === 'cancha_debe' && f.r.asistencia !== 'no_asistio'
  const porCobrar = filas.filter(debe)
  const montoPorCobrar = porCobrar.reduce((s, f) => s + Number(f.r.precio), 0)
  const nAsistio = filas.filter((f) => f.r.asistencia === 'asistio').length
  const nFalto = filas.filter((f) => f.r.asistencia === 'no_asistio').length
  const sinMarcar = filas.filter((f) => f.r.asistencia === 'pendiente')

  const cumpleA = (f) => {
    if (filtroA === 'sin_marcar') return f.r.asistencia === 'pendiente'
    if (filtroA === 'asistio') return f.r.asistencia === 'asistio'
    if (filtroA === 'falto') return f.r.asistencia === 'no_asistio'
    if (filtroA === 'debe') return debe(f)
    if (filtroA === 'arqueros') return f.r.posicion === 'arquero'
    return true
  }
  const visiblesA = filas
    .filter((f) => cumpleA(f) && coincideTexto(f.r))
    .sort((a, b) =>
      ORDEN_ASIST[a.r.asistencia] - ORDEN_ASIST[b.r.asistencia] ||
      nombreDe(a.r).localeCompare(nombreDe(b.r), 'es'))

  // ---------- Jugadores ----------
  const cumpleJ = (c) => {
    if (filtroJ === 'por_verificar') return c === 'por_verificar'
    if (filtroJ === 'debe') return c === 'cancha_debe'
    if (filtroJ === 'qr') return c === 'qr'
    if (filtroJ === 'reservado') return c === 'reservado' || c === 'rechazado'
    return true
  }
  const nJ = (fn) => activas.filter((r) => fn(clave(r))).length
  const gruposVisibles = grupos.filter(
    (g) =>
      g.filas.some((f) => cumpleJ(clave(f))) &&
      (!q || g.filas.some(coincideTexto))
  )

  const hayDinero = (g, f) =>
    g.pago?.metodo === 'cancha'
      ? !!f.cobrado_en
      : g.pago && g.pago.metodo !== 'bonificado'
        && ['por_verificar', 'verificado'].includes(g.pago.estado)

  const yaTengoCupo = activas.some((r) => r.perfil_id === perfilId && r.estado === 'confirmado')

  // ---------- Dinero ----------
  const idsGrupos = new Set(reservas.map((r) => r.grupo_id))
  const cobradoQR = pagos
    .filter((x) => idsGrupos.has(x.grupo_id) && x.estado === 'verificado' && x.metodo === 'qr')
    .reduce((s, x) => s + Number(x.monto), 0)
  const cobradoCancha = reservas
    .filter((r) => r.cobrado_en)
    .reduce((s, r) => s + Number(r.precio), 0)
  const cobrado = cobradoQR + cobradoCancha
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
      const k = r.creador?.id ?? 'manual'
      if (!porPersona[k]) porPersona[k] = { creador: r.creador, items: [] }
      porPersona[k].items.push(r)
    })
  const gruposDev = Object.values(porPersona)
  const otrasCanc = canceladas.filter((r) => r.devolucion_estado !== 'pendiente')

  // ---------- Agregar jugadores ----------
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
      <div className="flex items-center justify-between">
        <button onClick={onVolver} className="btn"><ChevronLeft size={18} /> Volver</button>
        <button onClick={cargar} aria-label="Actualizar" className="btn btn-icono">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl">{partido.cancha}</h2>
        <p className="text-suave">{partido.fecha} · {partido.hora.slice(0, 5)}</p>
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
      {trabajando && <p className="text-sm text-suave">Procesando...</p>}

      <nav className="flex flex-wrap gap-2">
        {PESTANAS.map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setParams({ tab: id }, { replace: true })}
            className={tab === id ? 'border-transparent bg-verde text-sobre-verde' : ''}
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

          <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar jugador por nombre o apodo" />
          <Filtros
            valor={filtroJ}
            onCambio={setFiltroJ}
            opciones={[
              ['todos', 'Todos', activas.length],
              ['por_verificar', 'Por verificar', nJ((c) => c === 'por_verificar')],
              ['debe', 'Debe en cancha', nJ((c) => c === 'cancha_debe')],
              ['qr', 'Pagó QR', nJ((c) => c === 'qr')],
              ['reservado', 'Sin pago', nJ((c) => c === 'reservado' || c === 'rechazado')],
            ]}
          />

          {grupos.length === 0 && <p className="text-suave">Todavía no hay reservas.</p>}
          {grupos.length > 0 && gruposVisibles.length === 0 && (
            <p className="text-suave">No hay jugadores con ese filtro.</p>
          )}

          {gruposVisibles.map((g) => {
            const creador = g.filas[0].creador
            const claves = g.filas.map(clave)
            const debenG = g.filas.filter(
              (f) => clave(f) === 'cancha_debe' && f.asistencia !== 'no_asistio'
            )
            const montoG = debenG.reduce((s, f) => s + Number(f.precio), 0)
            return (
              <div key={g.grupoId} className={`tarjeta space-y-2 border-l-4 ${BORDE_IZQ[colorGrupo(claves)]}`}>
                {creador ? (
                  <div className="space-y-1.5 text-sm">
                    <p>
                      Reservó: <strong>{nombreCompleto(creador)}</strong>
                      <span className="text-suave">
                        {' · '}{creador.nivel === 'confiable' ? 'Confiable' : 'Cuenta nueva'}
                      </span>
                    </p>
                    {creador.en_revision && (
                      <p className="font-semibold text-amarillo-texto">Cuenta en revisión por faltas</p>
                    )}
                    {creador.rechazos_seguidos >= 2 && (
                      <p className="font-semibold text-rojo">{creador.rechazos_seguidos} pagos rechazados</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {creador.whatsapp && (
                        <a href={`https://wa.me/${creador.whatsapp}`} target="_blank" rel="noreferrer" className="btn">
                          <MessageCircle size={16} /> WhatsApp
                        </a>
                      )}
                      {creador.nivel === 'nuevo' && (
                        <button
                          disabled={trabajando}
                          onClick={() => ejecutar('aprobar_cuenta',
                            { p_perfil: creador.id, p_confiable: true },
                            '¿Marcar esta cuenta como confiable? Tendrá límites más amplios.')}
                        >
                          Marcar confiable
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
                    <li key={f.id} className="space-y-1.5 border-t border-borde pt-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{nombreDe(f)}</span>
                        {f.posicion === 'arquero' && <Hand size={16} className="text-suave" aria-label="Arquero" />}
                        <span className="text-sm tabular-nums text-suave">{bs(f.precio)} Bs</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Etiqueta clave={clave(f)} />
                        {f.asistencia === 'asistio' && <Etiqueta clave="asistio" />}
                        {f.asistencia === 'no_asistio' && <Etiqueta clave="falto" />}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={trabajando} onClick={() => reasignar(f)}>Reasignar</button>
                        {hayDinero(g, f) ? (
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

                {debenG.length > 1 && (
                  <button
                    disabled={trabajando || !comenzo}
                    className="btn btn-amarillo w-full"
                    onClick={() => ejecutar('cobrar_en_cancha', { p_grupo: g.grupoId },
                      `¿Ya cobraste ${bs(montoG)} Bs en cancha a los ${debenG.length} cupos de este grupo que asistieron?`)}
                  >
                    <Banknote size={18} /> Cobrar a todo el grupo ({bs(montoG)} Bs)
                  </button>
                )}
                {debenG.length > 0 && !comenzo && (
                  <p className="text-sm text-suave">El cobro en cancha se registra desde la hora de inicio.</p>
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
            <h3>Agregar jugadores</h3>
            <Contador etiqueta="Cantidad" valor={cantidad} min={1} max={maxAgregar} onCambio={setCantidad} />
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
              Total: {bs(totalAgregar)} Bs{nArq > 0 && ` (${nJug} jugador y ${nArq} arquero)`}
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
              <h3>Cupos de arco</h3>
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
        <div className="space-y-3">
          <div className="tarjeta flex justify-around text-center">
            <div><p className="text-2xl font-bold text-verde">{nAsistio}</p><p className="text-sm text-suave">Asistieron</p></div>
            <div><p className="text-2xl font-bold text-rojo">{nFalto}</p><p className="text-sm text-suave">Faltaron</p></div>
            <div><p className="text-2xl font-bold">{sinMarcar.length}</p><p className="text-sm text-suave">Sin marcar</p></div>
          </div>

          <div className={`aviso flex items-center gap-2 ${porCobrar.length > 0 ? 'aviso-alerta' : 'aviso-ok'}`}>
            <Banknote size={20} className="shrink-0" />
            <p className="font-semibold">
              {porCobrar.length > 0
                ? `Por cobrar: ${porCobrar.length} cupo(s) · ${bs(montoPorCobrar)} Bs`
                : 'No hay cobros pendientes en cancha'}
            </p>
          </div>

          {!puedeAsistio && (
            <p className="aviso aviso-alerta text-sm">
              La asistencia se puede marcar desde 1 hora antes del partido, y las faltas desde su inicio.
            </p>
          )}

          <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar jugador por nombre o apodo" />
          <Filtros
            valor={filtroA}
            onCambio={setFiltroA}
            opciones={[
              ['todos', 'Todos', filas.length],
              ['sin_marcar', 'Sin marcar', sinMarcar.length],
              ['asistio', 'Asistió', nAsistio],
              ['falto', 'Faltó', nFalto],
              ['debe', 'Debe pagar', porCobrar.length],
              ...(hayArco ? [['arqueros', 'Arqueros', filas.filter((f) => f.r.posicion === 'arquero').length]] : []),
            ]}
          />

          <button
            disabled={trabajando || !comenzo || sinMarcar.length === 0}
            onClick={() => ejecutar(
              'marcar_asistieron_pendientes',
              { p_partido: partidoId },
              `¿Marcar como "asistió" a los ${sinMarcar.length} jugadores que quedaron sin marcar?`
            )}
          >
            Marcar que asistieron los {sinMarcar.length} sin marcar
          </button>

          {confirmados.length === 0 && <p className="text-suave">Todavía no hay cupos confirmados.</p>}
          {confirmados.length > 0 && visiblesA.length === 0 && (
            <p className="text-suave">No hay jugadores con ese filtro o búsqueda.</p>
          )}

          {visiblesA.map((f) => {
            const { r, c } = f
            const propias = r.perfil_id ? (faltas[r.perfil_id]?.propias ?? 0) : 0
            const deAcomp = !r.perfil_id && r.creador ? (faltas[r.creador.id]?.acompanantes ?? 0) : 0
            const claveAsist = r.asistencia === 'asistio' ? 'asistio'
              : r.asistencia === 'no_asistio' ? 'falto' : 'sin_marcar'
            const colorBorde = debe(f) ? 'amarillo'
              : claveAsist === 'asistio' ? 'verde'
              : claveAsist === 'falto' ? 'rojo' : 'gris'
            return (
              <div key={r.id} className={`tarjeta space-y-2 border-l-4 ${BORDE_IZQ[colorBorde]}`}>
                <div className="space-y-1.5">
                  <p className="flex items-center gap-2 text-lg font-bold">
                    {nombreDe(r)}
                    {r.posicion === 'arquero' && <Hand size={16} className="text-suave" aria-label="Arquero" />}
                    <span className="ml-auto text-sm font-semibold tabular-nums text-suave">{bs(r.precio)} Bs</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Etiqueta clave={c} />
                    <Etiqueta clave={claveAsist} />
                  </div>
                  {!r.perfil_id && r.creador && (
                    <p className="text-sm text-suave">Reservó: {nombreCompleto(r.creador)}</p>
                  )}
                  {r.perfil?.en_revision && (
                    <p className="text-sm font-semibold text-amarillo-texto">Cuenta en revisión</p>
                  )}
                  {propias > 0 && (
                    <p className="text-sm text-amarillo-texto">{propias} falta(s) en los últimos 90 días</p>
                  )}
                  {deAcomp > 0 && (
                    <p className="text-sm text-amarillo-texto">
                      Acompañantes de {nombreCompleto(r.creador)} con {deAcomp} falta(s) en 90 días
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={trabajando || !puedeAsistio || r.asistencia === 'asistio'}
                    className="btn btn-activo"
                    onClick={() => marcar(r, 'asistio')}
                  >
                    <UserCheck size={18} /> Asistió
                  </button>
                  <button
                    disabled={trabajando || !comenzo || r.asistencia === 'no_asistio'}
                    className="btn"
                    onClick={() => marcar(r, 'no_asistio')}
                  >
                    <UserX size={18} /> Faltó
                  </button>
                  {r.asistencia !== 'pendiente' && (
                    <button
                      disabled={trabajando}
                      aria-label="Deshacer asistencia"
                      className="btn btn-icono"
                      onClick={() => marcar(r, 'pendiente')}
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}
                  {debe(f) && (
                    <button
                      disabled={trabajando || !comenzo}
                      className="btn btn-amarillo"
                      onClick={() => cobrar(r, true)}
                    >
                      <Banknote size={18} /> Cobrar {bs(r.precio)} Bs
                    </button>
                  )}
                  {c === 'cancha_cobrado' && (
                    <button disabled={trabajando} onClick={() => cobrar(r, false)}>
                      <RotateCcw size={16} /> Deshacer cobro
                    </button>
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
          <h3>Devoluciones pendientes</h3>
          {gruposDev.length === 0 && <p className="text-suave">No hay devoluciones pendientes.</p>}
          {gruposDev.map((g) => {
            const total = g.items.reduce((s, r) => s + Number(r.monto_pagado), 0)
            return (
              <div key={g.creador?.id ?? 'manual'} className="tarjeta space-y-2 border-l-4 border-l-amarillo">
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
                      <MessageCircle size={16} /> Contactar por WhatsApp
                    </a>
                  )}
                  <button disabled={trabajando} onClick={() => marcarDevueltas(g.items)}>
                    Marcar devuelto
                  </button>
                </div>
              </div>
            )
          })}

          <h3>Otras cancelaciones</h3>
          {otrasCanc.length === 0 && <p className="text-suave">No hay otras cancelaciones.</p>}
          {otrasCanc.map((r) => (
            <div key={r.id} className="tarjeta space-y-1.5 border-l-4 border-l-rojo">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{nombreDe(r)}</span>
                {r.posicion === 'arquero' && <Hand size={16} className="text-suave" aria-label="Arquero" />}
                <Etiqueta clave="cancelado" />
              </div>
              <p className="text-sm text-suave">
                {r.cancelacion_tipo === 'tardia' ? 'Cancelación tardía' : 'Cancelación a tiempo'}
                {' · '}
                {r.devolucion_estado
                  ? `${bs(r.monto_pagado)} Bs · ${ETIQUETA_DEVOLUCION[r.devolucion_estado]}`
                  : 'sin pago'}
              </p>
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
            <h3>Resumen de dinero</h3>
            <p>Cobrado por QR: {bs(cobradoQR)} Bs</p>
            <p>Cobrado en cancha: {bs(cobradoCancha)} Bs</p>
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