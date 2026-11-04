import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Download, MessageCircle, Pencil, RotateCcw } from 'lucide-react'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import Rueda from './Rueda'
import { descargarCSV, traerTodo } from './csv'
import {
  bs, hhmm, hoyBolivia, mesActual, nombreMes, rangoMes, sumarMeses, lunesDe, diaMes,
  inicioPartido, finPartido, enlaceEstadoCuenta,
} from './formato'

const num = (v) => Number(v ?? 0)
// Dinero que movió el partido (en los de organizador, no es tuyo)
const netoDe = (f) => num(f.cobrado_qr) + num(f.cobrado_directo) - num(f.dev_hechas)
// Lo que de verdad entra a tu bolsillo: todo en los propios, solo la tarifa cobrada en los de organizador
const miIngreso = (f) => (f.es_organizador ? (f.tarifa_cobrada ? num(f.tarifa) : 0) : netoDe(f))
const miGanancia = (f) => miIngreso(f) - num(f.costo)
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)
const textoPct = (v) => (v === null ? '—' : `${v} %`)
const nombreP = (p) => [p?.nombre, p?.apellido].filter(Boolean).join(' ')

const COLS_RESUMEN = [
  ['Fecha', (f) => f.fecha],
  ['Hora', (f) => hhmm(f.hora)],
  ['Cancha', (f) => f.cancha],
  ['Modalidad', (f) => f.modalidad],
  ['Estado', (f) => f.estado],
  ['Tipo', (f) => (f.es_organizador ? 'De organizador' : 'Propio')],
  ['Organizador', (f) => f.organizador],
  ['Cupos', (f) => f.cupos_total],
  ['Confirmados', (f) => f.confirmados],
  ['Cobrado QR', (f) => num(f.cobrado_qr)],
  ['Cobrado directo', (f) => num(f.cobrado_directo)],
  ['Devoluciones hechas', (f) => num(f.dev_hechas)],
  ['Devoluciones pendientes', (f) => num(f.dev_pendientes)],
  ['Retenido', (f) => num(f.retenido)],
  ['Por cobrar en cancha', (f) => num(f.por_cobrar)],
  ['Movimiento neto', (f) => netoDe(f)],
  ['Tarifa', (f) => (f.es_organizador ? num(f.tarifa) : '')],
  ['Tarifa cobrada', (f) => (f.es_organizador ? f.tarifa_cobrada : '')],
  ['Costo', (f) => num(f.costo)],
  ['Tu ingreso', (f) => miIngreso(f)],
  ['Ganancia', (f) => miGanancia(f)],
  ['Asistieron', (f) => f.asistio],
  ['Faltaron', (f) => f.falto],
  ['Sin marcar', (f) => f.sin_marcar],
]

const COLS_RESERVAS = [
  ['Fecha del partido', (r) => r.partidos?.fecha],
  ['Hora', (r) => hhmm(r.partidos?.hora)],
  ['Cancha', (r) => r.partidos?.cancha],
  ['Jugador', (r) => r.nombre_invitado || nombreP(r.perfil)],
  ['Reservó', (r) => nombreP(r.creador)],
  ['WhatsApp de quien reservó', (r) => r.creador?.whatsapp],
  ['Posición', (r) => r.posicion],
  ['Estado', (r) => r.estado],
  ['Precio', (r) => num(r.precio)],
  ['Asistencia', (r) => r.asistencia],
  ['Cobrado el', (r) => r.cobrado_en],
  ['Tipo de cobro', (r) => r.cobro_tipo],
  ['Cancelado el', (r) => r.cancelada_en],
  ['Tipo de cancelación', (r) => r.cancelacion_tipo],
  ['Monto pagado', (r) => num(r.monto_pagado)],
  ['Devolución', (r) => r.devolucion_estado],
  ['Creada el', (r) => r.created_at],
  ['Grupo', (r) => r.grupo_id],
]

const COLS_PAGOS = [
  ['Creado el', (p) => p.created_at],
  ['Grupo', (p) => p.grupo_id],
  ['Método', (p) => p.metodo],
  ['Monto', (p) => num(p.monto)],
  ['Estado', (p) => p.estado],
  ['Verificado el', (p) => p.verificado_en],
]

const COLS_CUENTAS = [
  ['Nombre', (c) => c.nombre],
  ['Apellido', (c) => c.apellido],
  ['Apodo', (c) => c.apodo],
  ['WhatsApp', (c) => c.whatsapp],
  ['Rol', (c) => c.rol],
  ['Nivel', (c) => c.nivel],
  ['Activa', (c) => c.activo],
  ['En revisión', (c) => c.en_revision],
  ['Motivo de suspensión', (c) => c.suspendido_motivo],
  ['Creada el', (c) => c.created_at],
]

function Dato({ etiqueta, valor, clase = '' }) {
  return (
    <div className="tarjeta space-y-0.5 p-3">
      <p className="text-xs text-suave">{etiqueta}</p>
      <p className={`font-display text-2xl font-bold tabular-nums ${clase}`}>{valor}</p>
    </div>
  )
}

function CostoCancha({ cancha, valor, onCambio, onError }) {
  const [texto, setTexto] = useState(valor == null ? '' : String(valor))
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const t = texto.trim().replace(',', '.')
    let error
    setGuardando(true)
    if (t === '') {
      ;({ error } = await supabase.from('costos_cancha').delete().eq('cancha_id', cancha.id))
    } else {
      const n = Number(t)
      if (Number.isNaN(n) || n < 0 || n > 99999) {
        setGuardando(false)
        return onError('Escribe un costo válido (un número en Bs)')
      }
      ;({ error } = await supabase.from('costos_cancha').upsert(
        { cancha_id: cancha.id, costo: n, updated_at: new Date().toISOString() },
        { onConflict: 'cancha_id' }
      ))
    }
    setGuardando(false)
    if (error) return onError(error.message)
    onCambio()
  }

  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate">{cancha.nombre}</span>
      <input
        className="w-28"
        inputMode="decimal"
        placeholder="Bs por partido"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button disabled={guardando} onClick={guardar}>
        {guardando ? <Rueda size={16} /> : 'Guardar'}
      </button>
    </div>
  )
}

export default function Finanzas({ canchas }) {
  const [mes, setMes] = useState(mesActual())
  const [filas, setFilas] = useState(null)
  const [metricas, setMetricas] = useState(null)
  const [costosCancha, setCostosCancha] = useState({})
  const [efectivo, setEfectivo] = useState([])
  const [entregas, setEntregas] = useState([])
  const [error, setError] = useState(null)
  const [exportando, setExportando] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const pedido = useRef(0)

  async function cargar() {
    const id = ++pedido.current
    const { desde, hasta } = rangoMes(mes)
    // 5 consultas y 5 variables, en el mismo orden
    const [r, m, cc, ef, en] = await Promise.all([
      supabase.rpc('resumen_finanzas', { p_desde: desde, p_hasta: hasta }),
      supabase.rpc('metricas_periodo', { p_desde: desde, p_hasta: hasta }),
      supabase.from('costos_cancha').select('cancha_id, costo'),
      supabase.rpc('efectivo_por_persona'),
      supabase.from('entregas_efectivo')
        .select('id, perfil_id, monto, nota, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
    ])
    if (id !== pedido.current) return // se cambió de mes mientras cargaba
    const fallo = r.error || m.error || cc.error || ef.error || en.error
    if (fallo) return setError(fallo.message)
    const mapa = {}
    cc.data.forEach((x) => { mapa[x.cancha_id] = num(x.costo) })
    setFilas(r.data)
    setMetricas(m.data?.[0] ?? { jugadores_unicos: 0, repetidores: 0, cuentas_nuevas: 0 })
    setCostosCancha(mapa)
    setEfectivo(ef.data)
    setEntregas(en.data)
    setError(null)
  }

  useEffect(() => { setFilas(null); cargar() }, [mes])

  async function costoPartido(f) {
    const t = window.prompt(
      `Costo del partido en ${f.cancha} (${diaMes(f.fecha)}) en Bs.\n` +
      `Déjalo vacío para usar el costo por defecto de la cancha:`,
      f.costo_propio ? String(num(f.costo)) : ''
    )
    if (t === null) return
    const limpio = t.trim().replace(',', '.')
    setError(null)
    if (limpio === '') {
      const { error } = await supabase.from('costos_partido').delete().eq('partido_id', f.id_partido)
      if (error) return setError(error.message)
    } else {
      const n = Number(limpio)
      if (Number.isNaN(n) || n < 0 || n > 99999) return setError('Escribe un costo válido (un número en Bs)')
      const { error } = await supabase.from('costos_partido').upsert(
        { partido_id: f.id_partido, costo: n, updated_at: new Date().toISOString() },
        { onConflict: 'partido_id' }
      )
      if (error) return setError(error.message)
    }
    cargar()
  }

  async function marcarTarifas(ids, cobrada, pregunta) {
    if (pregunta && !window.confirm(pregunta)) return
    setError(null)
    setTrabajando(true)
    const { error } = await supabase.rpc('marcar_tarifas', { p_ids: ids, p_cobrada: cobrada })
    setTrabajando(false)
    if (error) return setError(error.message)
    cargar()
  }

  async function registrarEntrega(p) {
    const debe = num(p.cobrado) - num(p.entregado)
    const t = window.prompt(
      `¿Cuánto te entregó ${nombreP(p)}? (Bs)`,
      debe > 0 ? String(debe) : ''
    )
    if (t === null) return
    const n = Number(t.trim().replace(',', '.'))
    if (Number.isNaN(n) || n <= 0 || n > 99999) return setError('Escribe un monto válido en Bs')
    setError(null)
    setTrabajando(true)
    const { error } = await supabase.from('entregas_efectivo').insert({ perfil_id: p.perfil_id, monto: n })
    setTrabajando(false)
    if (error) return setError(error.message)
    cargar()
  }

  async function anularEntrega(e) {
    if (!window.confirm(`¿Anular la entrega de ${bs(e.monto)} Bs?`)) return
    setError(null)
    const { error } = await supabase.from('entregas_efectivo').delete().eq('id', e.id)
    if (error) return setError(error.message)
    cargar()
  }

  async function exportar(tipo) {
    setError(null)
    setExportando(tipo)
    try {
      const hoy = hoyBolivia()
      if (tipo === 'resumen') {
        descargarCSV(`futbol-lpz-resumen-${mes}.csv`, COLS_RESUMEN, filas ?? [])
      } else if (tipo === 'reservas') {
        const datos = await traerTodo(() =>
          supabase.from('reservas')
            .select('id, grupo_id, estado, posicion, precio, nombre_invitado, asistencia, cobrado_en, cobro_tipo, cancelada_en, cancelacion_tipo, monto_pagado, devolucion_estado, created_at, partidos(fecha, hora, cancha), perfil:perfiles!perfil_id(nombre, apellido), creador:perfiles!creada_por(nombre, apellido, whatsapp)')
            .order('id')
        )
        descargarCSV(`futbol-lpz-reservas-${hoy}.csv`, COLS_RESERVAS, datos)
      } else if (tipo === 'pagos') {
        const datos = await traerTodo(() =>
          supabase.from('pagos')
            .select('id, grupo_id, metodo, monto, estado, verificado_en, created_at')
            .order('id')
        )
        descargarCSV(`futbol-lpz-pagos-${hoy}.csv`, COLS_PAGOS, datos)
      } else if (tipo === 'cuentas') {
        const datos = await traerTodo(() =>
          supabase.from('perfiles')
            .select('id, nombre, apellido, apodo, whatsapp, rol, nivel, activo, en_revision, suspendido_motivo, created_at')
            .order('id')
        )
        descargarCSV(`futbol-lpz-cuentas-${hoy}.csv`, COLS_CUENTAS, datos)
      }
    } catch (e) {
      setError(`No se pudo exportar: ${e?.message ?? e}`)
    }
    setExportando(null)
  }

  // ---------- Cálculos ----------
  const lista = filas ?? []
  const ahora = Date.now()
  const propios = lista.filter((f) => !f.es_organizador)
  const deOrg = lista.filter((f) => f.es_organizador)
  const jugados = lista.filter((f) => f.estado !== 'cancelado' && inicioPartido(f).getTime() <= ahora)

  const ingPropios = propios.reduce((s, f) => s + netoDe(f), 0)
  const tarifasCobradas = deOrg.filter((f) => f.tarifa_cobrada).reduce((s, f) => s + num(f.tarifa), 0)
  const tarifasPendientes = deOrg.filter((f) => !f.tarifa_cobrada).reduce((s, f) => s + num(f.tarifa), 0)
  const movOrg = deOrg.reduce((s, f) => s + netoDe(f), 0)
  const ingresos = ingPropios + tarifasCobradas
  const costos = lista.reduce((s, f) => s + num(f.costo), 0)
  const ganancia = ingresos - costos
  const porCobrar = propios.reduce((s, f) => s + num(f.por_cobrar), 0)
  const devPend = propios.reduce((s, f) => s + num(f.dev_pendientes), 0)
  const sinCosto = propios.filter((f) => f.estado !== 'cancelado' && !f.costo_definido).length

  const ocupados = jugados.reduce((s, f) => s + f.confirmados, 0)
  const capacidad = jugados.reduce((s, f) => s + f.cupos_total, 0)
  const asistio = jugados.reduce((s, f) => s + f.asistio, 0)
  const falto = jugados.reduce((s, f) => s + f.falto, 0)
  const sinMarcar = jugados.reduce((s, f) => s + f.sin_marcar, 0)

  const semanas = {}
  lista.forEach((f) => {
    const k = lunesDe(f.fecha)
    semanas[k] = semanas[k] ?? { ingreso: 0, costo: 0 }
    semanas[k].ingreso += miIngreso(f)
    semanas[k].costo += num(f.costo)
  })
  const listaSem = Object.entries(semanas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lunes, v]) => ({ lunes, ...v, ganancia: v.ingreso - v.costo }))
  const maxAbs = Math.max(1, ...listaSem.map((s) => Math.abs(s.ganancia)))

  // Organizadores del mes
  const porOrg = {}
  deOrg.forEach((f) => {
    if (!porOrg[f.organizador_id]) {
      porOrg[f.organizador_id] = {
        id: f.organizador_id, nombre: f.organizador, whatsapp: f.organizador_whatsapp, filas: [],
      }
    }
    porOrg[f.organizador_id].filas.push(f)
  })
  const orgs = Object.values(porOrg)
  // Una tarifa con porcentaje solo se puede cobrar cuando el partido terminó
  const sePuedeMarcar = (f) =>
    !f.tarifa_cobrada && num(f.tarifa) > 0 &&
    (num(f.tarifa_pct) === 0 || finPartido(f).getTime() < ahora)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button aria-label="Mes anterior" className="btn btn-icono" onClick={() => setMes(sumarMeses(mes, -1))}>
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-center text-xl first-letter:uppercase">{nombreMes(mes)}</h3>
        <button aria-label="Mes siguiente" className="btn btn-icono" onClick={() => setMes(sumarMeses(mes, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      {error && <p className="aviso aviso-error">{error}</p>}
      {!filas && !error && <Cargando />}

      {filas && (
        <>
          {lista.length === 0 && <p className="text-suave">No hay partidos en este mes.</p>}

          {lista.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Dato etiqueta="Tus ingresos" valor={`${bs(ingresos)} Bs`} />
                <Dato etiqueta="Costos" valor={`${bs(costos)} Bs`} />
                <Dato
                  etiqueta="Ganancia"
                  valor={`${bs(ganancia)} Bs`}
                  clase={ganancia < 0 ? 'text-rojo' : 'text-verde'}
                />
                <Dato etiqueta="Ocupación" valor={textoPct(pct(ocupados, capacidad))} />
                <Dato etiqueta="Asistencia" valor={textoPct(pct(asistio, asistio + falto))} />
                <Dato etiqueta="Jugadores distintos" valor={metricas?.jugadores_unicos ?? 0} />
              </div>

              <p className="text-sm text-suave">
                Tus ingresos son lo cobrado en tus partidos propios ({bs(ingPropios)} Bs, ya sin
                devoluciones) más las tarifas ya cobradas a organizadores ({bs(tarifasCobradas)} Bs).
                {' '}{metricas?.repetidores ?? 0} jugaron 2 o más partidos, y hubo{' '}
                {metricas?.cuentas_nuevas ?? 0} cuenta(s) nueva(s) este mes.
              </p>

              {deOrg.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <Dato etiqueta="Tarifas por cobrar" valor={`${bs(tarifasPendientes)} Bs`} clase="text-amarillo-texto" />
                  <Dato etiqueta="Mueven los organizadores" valor={`${bs(movOrg)} Bs`} clase="text-suave" />
                </div>
              )}
              {deOrg.length > 0 && (
                <p className="text-xs text-suave">
                  Lo que mueven los organizadores no es tuyo: solo cuenta tu tarifa, cuando la marcas
                  como cobrada.
                </p>
              )}

              {sinCosto > 0 && (
                <p className="aviso aviso-alerta text-sm">
                  {sinCosto} partido(s) propio(s) sin costo definido: la ganancia puede verse mayor de lo
                  real. Define el costo por cancha (abajo) o por partido.
                </p>
              )}
              {porCobrar > 0 && (
                <p className="aviso text-sm">
                  Falta cobrar en cancha (partidos propios): <strong>{bs(porCobrar)} Bs</strong> (no incluido en la ganancia).
                </p>
              )}
              {devPend > 0 && (
                <p className="aviso text-sm">
                  Devoluciones pendientes (partidos propios): <strong>{bs(devPend)} Bs</strong> (todavía no restadas).
                </p>
              )}
              {sinMarcar > 0 && (
                <p className="aviso text-sm">
                  Hay {sinMarcar} cupo(s) sin marcar asistencia en partidos ya jugados.
                </p>
              )}

              {orgs.length > 0 && (
                <section className="space-y-3">
                  <h3>Organizadores</h3>
                  {orgs.map((o) => {
                    const total = o.filas.reduce((s, f) => s + num(f.tarifa), 0)
                    const cobrado = o.filas.filter((f) => f.tarifa_cobrada).reduce((s, f) => s + num(f.tarifa), 0)
                    const saldo = total - cobrado
                    const mov = o.filas.reduce((s, f) => s + netoDe(f), 0)
                    const marcables = o.filas.filter(sePuedeMarcar)
                    const montoMarcable = marcables.reduce((s, f) => s + num(f.tarifa), 0)
                    const orden = [...o.filas].sort((a, b) => a.fecha.localeCompare(b.fecha))
                    return (
                      <div key={o.id} className="tarjeta space-y-2 border-l-4 border-l-amarillo">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="min-w-0 truncate text-lg font-bold">{o.nombre}</p>
                          <p className="shrink-0 text-sm text-suave">{o.filas.length} partido(s)</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                          <div><p className="text-xs text-suave">Movió</p><p className="font-semibold tabular-nums">{bs(mov)}</p></div>
                          <div><p className="text-xs text-suave">Tarifa total</p><p className="font-semibold tabular-nums">{bs(total)}</p></div>
                          <div>
                            <p className="text-xs text-suave">Saldo</p>
                            <p className={`font-semibold tabular-nums ${saldo > 0 ? 'text-amarillo-texto' : 'text-verde'}`}>{bs(saldo)}</p>
                          </div>
                        </div>

                        <ul className="divide-y divide-borde text-sm">
                          {orden.map((f) => (
                            <li key={f.id_partido} className="flex items-center gap-2 py-1.5">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{diaMes(f.fecha)} · {f.cancha}</span>
                                <span className="text-xs text-suave">
                                  Movió {bs(netoDe(f))} Bs · tarifa {bs(num(f.tarifa))} Bs
                                  {f.estado === 'cancelado' && ' · cancelado'}
                                </span>
                              </span>
                              {f.tarifa_cobrada ? (
                                <>
                                  <span className="shrink-0 text-xs font-semibold text-verde">Cobrada</span>
                                  <button
                                    aria-label="Deshacer cobro de la tarifa"
                                    className="btn btn-icono"
                                    disabled={trabajando}
                                    onClick={() => marcarTarifas([f.id_partido], false,
                                      `¿Deshacer el cobro de la tarifa del ${diaMes(f.fecha)}?`)}
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                </>
                              ) : sePuedeMarcar(f) ? (
                                <button
                                  disabled={trabajando}
                                  onClick={() => marcarTarifas([f.id_partido], true)}
                                >
                                  <Check size={14} /> Cobrada
                                </button>
                              ) : (
                                <span className="shrink-0 text-xs text-suave">
                                  {num(f.tarifa) <= 0 ? 'Sin tarifa' : 'Al terminar el partido'}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>

                        <div className="flex flex-wrap gap-2">
                          {marcables.length > 1 && (
                            <button
                              disabled={trabajando}
                              className="btn btn-activo"
                              onClick={() => marcarTarifas(
                                marcables.map((f) => f.id_partido), true,
                                `¿Marcar ${marcables.length} tarifas como cobradas (${bs(montoMarcable)} Bs)?`)}
                            >
                              <Check size={16} /> Marcar todas cobradas ({bs(montoMarcable)} Bs)
                            </button>
                          )}
                          <a
                            className="btn"
                            target="_blank"
                            rel="noreferrer"
                            href={enlaceEstadoCuenta(o.nombre, o.whatsapp, mes, orden, { total, cobrado, saldo })}
                          >
                            <MessageCircle size={16} /> Enviar estado de cuenta
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </section>
              )}

              <section className="space-y-2">
                <h3>Ganancia por semana</h3>
                {listaSem.map((s) => (
                  <div key={s.lunes} className="space-y-0.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span>Semana del {diaMes(s.lunes)}</span>
                      <span className={`font-semibold tabular-nums ${s.ganancia < 0 ? 'text-rojo' : 'text-verde'}`}>
                        {bs(s.ganancia)} Bs
                      </span>
                    </div>
                    <div
                      className="h-2.5 w-full overflow-hidden rounded-full bg-borde"
                      role="img"
                      aria-label={`Ganancia de la semana: ${bs(s.ganancia)} Bs`}
                    >
                      <div
                        className={`h-full rounded-full ${s.ganancia < 0 ? 'bg-rojo' : 'bg-verde'}`}
                        style={{ width: `${(Math.abs(s.ganancia) / maxAbs) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-suave">
                      Ingresos {bs(s.ingreso)} − costos {bs(s.costo)}
                    </p>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <h3>Por partido</h3>
                {[...lista].reverse().map((f) => {
                  const gan = miGanancia(f)
                  const cancelado = f.estado === 'cancelado'
                  const org = f.es_organizador
                  return (
                    <div
                      key={f.id_partido}
                      className={`tarjeta space-y-2 border-l-4 ${cancelado || gan < 0 ? 'border-l-rojo' : 'border-l-verde'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-semibold">
                          {diaMes(f.fecha)} · {hhmm(f.hora)} · {f.cancha}
                        </p>
                        {cancelado && <span className="shrink-0 text-xs font-bold text-rojo">CANCELADO</span>}
                      </div>
                      {org && (
                        <p className="text-sm">
                          <span className="rounded-full bg-amarillo/15 px-2 py-0.5 text-xs font-bold text-amarillo-texto">
                            De {f.organizador}
                          </span>
                        </p>
                      )}
                      <p className="text-sm text-suave">
                        Ocupación {f.confirmados}/{f.cupos_total} ({textoPct(pct(f.confirmados, f.cupos_total))})
                        {' · '}Asistieron {f.asistio} · Faltaron {f.falto}
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-xs text-suave">{org ? 'Movió' : 'Ingresos'}</p>
                          <p className="font-semibold tabular-nums">{bs(netoDe(f))}</p>
                        </div>
                        {org ? (
                          <div>
                            <p className="text-xs text-suave">Tu tarifa</p>
                            <p className={`font-semibold tabular-nums ${f.tarifa_cobrada ? 'text-verde' : 'text-amarillo-texto'}`}>
                              {bs(num(f.tarifa))}
                            </p>
                            <p className="text-[11px] text-suave">{f.tarifa_cobrada ? 'cobrada' : 'pendiente'}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-xs text-suave">Costo</p>
                            <p className={`font-semibold tabular-nums ${!f.costo_definido ? 'text-amarillo-texto' : ''}`}>
                              {f.costo_definido ? bs(num(f.costo)) : 'sin costo'}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-suave">Ganancia</p>
                          <p className={`font-semibold tabular-nums ${gan < 0 ? 'text-rojo' : 'text-verde'}`}>{bs(gan)}</p>
                        </div>
                      </div>
                      {!org && (num(f.por_cobrar) > 0 || num(f.dev_pendientes) > 0) && (
                        <p className="text-xs text-suave">
                          {num(f.por_cobrar) > 0 && `Por cobrar en cancha: ${bs(num(f.por_cobrar))} Bs. `}
                          {num(f.dev_pendientes) > 0 && `Devoluciones pendientes: ${bs(num(f.dev_pendientes))} Bs.`}
                        </p>
                      )}
                      <button onClick={() => costoPartido(f)}>
                        <Pencil size={14} />{' '}
                        {f.costo_propio ? 'Cambiar costo propio' : org ? 'Costo si tú pagas la cancha' : 'Costo de este partido'}
                      </button>
                    </div>
                  )
                })}
              </section>
            </>
          )}

          {efectivo.length > 0 && (
            <section className="space-y-3">
              <h3>Efectivo en manos de otros</h3>
              <p className="text-sm text-suave">
                Lo que otras personas cobraron en cancha en tus partidos propios, menos lo que ya te
                entregaron. No descuenta devoluciones que hayan hecho con ese efectivo.
              </p>
              {efectivo.map((p) => {
                const debe = num(p.cobrado) - num(p.entregado)
                const suyas = entregas.filter((e) => e.perfil_id === p.perfil_id)
                return (
                  <div
                    key={p.perfil_id}
                    className={`tarjeta space-y-2 border-l-4 ${debe > 0 ? 'border-l-amarillo' : 'border-l-verde'}`}
                  >
                    <p className="font-semibold">{nombreP(p)}</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <div><p className="text-xs text-suave">Cobró</p><p className="font-semibold tabular-nums">{bs(num(p.cobrado))}</p></div>
                      <div><p className="text-xs text-suave">Entregó</p><p className="font-semibold tabular-nums">{bs(num(p.entregado))}</p></div>
                      <div>
                        <p className="text-xs text-suave">Debe entregar</p>
                        <p className={`font-semibold tabular-nums ${debe > 0 ? 'text-amarillo-texto' : 'text-verde'}`}>{bs(debe)}</p>
                      </div>
                    </div>
                    <button disabled={trabajando} onClick={() => registrarEntrega(p)}>Registrar entrega</button>
                    {suyas.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm font-semibold">Entregas ({suyas.length})</summary>
                        <ul className="space-y-1 pt-2 text-sm">
                          {suyas.map((e) => (
                            <li key={e.id} className="flex items-center justify-between gap-2">
                              <span>
                                {new Date(e.created_at).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', timeZone: 'America/La_Paz' })}
                                {' · '}{bs(num(e.monto))} Bs
                              </span>
                              <button onClick={() => anularEntrega(e)}>Anular</button>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          <details className="tarjeta">
            <summary className="cursor-pointer font-semibold">Costo por cancha (por defecto)</summary>
            <div className="space-y-2 pt-3">
              <p className="text-sm text-suave">
                Lo que pagas por partido en cada cancha. Se aplica a tus partidos propios, salvo los que
                tengan un costo propio. Los partidos de organizador no llevan costo a menos que tú pagues
                la cancha. Si el partido lleva premio, súmalo al costo del partido.
              </p>
              {canchas.length === 0 && <p className="text-suave">Todavía no hay canchas.</p>}
              {canchas.map((c) => (
                <CostoCancha
                  key={c.id}
                  cancha={c}
                  valor={costosCancha[c.id]}
                  onCambio={cargar}
                  onError={setError}
                />
              ))}
            </div>
          </details>

          <section className="tarjeta space-y-2">
            <h3>Exportar a Excel</h3>
            <p className="text-sm text-suave">
              Una vez al mes, descarga los archivos y guárdalos en un lugar privado (por ejemplo, tu
              Google Drive personal). Son un registro de tus datos, no una copia restaurable de la base de
              datos, y contienen números de WhatsApp.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ['resumen', `Resumen de ${nombreMes(mes)}`],
                ['reservas', 'Reservas (todas)'],
                ['pagos', 'Pagos (todos)'],
                ['cuentas', 'Cuentas'],
              ].map(([id, texto]) => (
                <button key={id} disabled={exportando !== null} onClick={() => exportar(id)}>
                  {exportando === id ? <><Rueda size={16} /> Preparando...</> : <><Download size={16} /> {texto}</>}
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}