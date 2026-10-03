import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Contador from './Contador'
import { bs } from './formato'

const ETIQUETA_DEVOLUCION = {
  pendiente: 'Devolución pendiente',
  no_corresponde: 'Sin devolución (dinero retenido)',
  hecha: 'Devuelto',
}

export default function PanelPartido({ partidoId, perfilId, onVolver }) {
  const [partido, setPartido] = useState(null)
  const [reservas, setReservas] = useState([])
  const [pagos, setPagos] = useState([])
  const [libres, setLibres] = useState({ jugador: 0, arquero: 0 })
  const [miBonificado, setMiBonificado] = useState(false)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  // Formulario "agregar jugadores"
  const [cantidad, setCantidad] = useState(1)
  const [nombres, setNombres] = useState([])
  const [arqs, setArqs] = useState([])
  const [metodo, setMetodo] = useState('qr')

  // Conversión de cupos de arco
  const [aConvertir, setAConvertir] = useState(1)

  async function cargar() {
    // Ojo: son 6 consultas y 6 variables, en el mismo orden
    const [p, r, pg, lj, la, enc] = await Promise.all([
      supabase.from('partidos').select('*').eq('id', partidoId).single(),
      supabase.from('reservas')
        .select('id, grupo_id, perfil_id, estado, vencimiento, nombre_invitado, posicion, precio, cancelada_en, cancelacion_tipo, monto_pagado, devolucion_estado, perfil:perfiles!perfil_id(nombre), creador:perfiles!creada_por(nombre, whatsapp)')
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
    ])
    const fallo = p.error || r.error || pg.error || lj.error || la.error || enc.error
    if (fallo) return setError(fallo.message)
    setPartido(p.data)
    setReservas(r.data)
    setPagos(pg.data)
    setLibres({ jugador: lj.data ?? 0, arquero: la.data ?? 0 })
    setMiBonificado(enc.data.some((e) => e.cuota_bonificada))
  }

  useEffect(() => { cargar() }, [partidoId])

  // Ejecuta una función de la base de datos y recarga el panel
  async function ejecutar(fn, params, pregunta) {
    if (pregunta && !window.confirm(pregunta)) return false
    setError(null)
    setTrabajando(true)
    const { error } = await supabase.rpc(fn, params)
    setTrabajando(false)
    if (error) { setError(error.message); return false }
    await cargar()
    return true
  }

  function reasignar(fila) {
    const nuevo = window.prompt('Nombre de la persona que ocupará este cupo:')
    if (nuevo && nuevo.trim()) {
      ejecutar('reasignar_cupo', { p_reserva: fila.id, p_nuevo_nombre: nuevo })
    }
  }

  if (!partido) {
    return (
      <div>
        <button onClick={onVolver}>← Volver</button>
        {error ? <p>{error}</p> : <p>Cargando...</p>}
      </div>
    )
  }

  const hayArco = partido.cupos_arco > 0
  const ahora = Date.now()

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

  // Contadores: cada cupo cuenta una vez, con el detalle de arqueros
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

  // Resumen de dinero
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

  // Formulario de agregar: cada nombre con su casilla de arquero
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
    <div>
      <button onClick={onVolver}>← Volver</button>{' '}
      <button onClick={cargar}>Actualizar</button>

      <h2>{partido.cancha} · {partido.fecha} · {partido.hora.slice(0, 5)}</h2>
      <p>
        Jugadores: {libres.jugador} libres de {partido.cupos} ({bs(partido.cuota)} Bs)
        {hayArco && (
          <> | Arqueros: {libres.arquero} libres de {partido.cupos_arco} ({bs(partido.cuota_arquero)} Bs)</>
        )}
      </p>
      <p>
        {conArq(confirmados)} confirmados | {conArq(porVerificar)} por verificar
        | {conArq(pendientes)} pendientes
      </p>

      {error && <p>{error}</p>}
      {trabajando && <p>Procesando...</p>}

      {miBonificado && !yaTengoCupo && (
        <button
          disabled={trabajando}
          onClick={() => ejecutar('tomar_cupo_bonificado', { p_partido: partidoId })}
        >
          Tomar mi cupo bonificado
        </button>
      )}

      <h3>Jugadores</h3>
      {grupos.length === 0 && <p>Todavía no hay reservas.</p>}

      {grupos.map((g) => (
        <div key={g.grupoId}>
          <p><strong>{describir(g)}</strong></p>

          {g.filas[0].creador ? (
            <p>
              Reservó: {g.filas[0].creador.nombre}{' '}
              {g.filas[0].creador.whatsapp && (
                <a href={`https://wa.me/${g.filas[0].creador.whatsapp}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              )}
            </p>
          ) : (
            <p>Agregado por el encargado</p>
          )}

          {g.filas.map((f) => (
            <div key={f.id}>
              {f.nombre_invitado ?? f.perfil?.nombre ?? 'Jugador'}
              {f.posicion === 'arquero' && <strong> 🧤 ARQUERO</strong>}
              {' · '}{bs(f.precio)} Bs{' '}
              <button disabled={trabajando} onClick={() => reasignar(f)}>Reasignar</button>{' '}
              {hayDinero(g) ? (
                <>
                  <button
                    disabled={trabajando}
                    onClick={() => ejecutar('liberar_cupo',
                      { p_reserva: f.id, p_devolver: true },
                      `¿Liberar este cupo y dejar pendiente la devolución de ${bs(f.precio)} Bs?`)}
                  >
                    Liberar y devolver
                  </button>{' '}
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
          ))}

          {g.pago?.estado === 'por_verificar' && (
            <div>
              <p>Monto a verificar: {bs(g.pago.monto)} Bs</p>
              <button
                disabled={trabajando}
                onClick={() => ejecutar('confirmar_pago', { p_grupo: g.grupoId })}
              >
                Confirmar pago
              </button>{' '}
              <button
                disabled={trabajando}
                onClick={() => ejecutar('rechazar_pago', { p_grupo: g.grupoId },
                  `¿Rechazar este pago? La persona tendrá otros ${partido.minutos_reserva} minutos para volver a intentarlo.`)}
              >
                Rechazar
              </button>
            </div>
          )}

          {g.pago?.metodo === 'cancha' && g.pago.estado === 'pendiente' && (
            <button
              disabled={trabajando}
              onClick={() => ejecutar('cobrar_en_cancha', { p_grupo: g.grupoId },
                '¿Ya cobraste en cancha a los cupos de este grupo?')}
            >
              Marcar cobrado
            </button>
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
          <hr />
        </div>
      ))}

      <h3>Agregar jugadores</h3>
      <Contador
        etiqueta="Cantidad:"
        valor={cantidad}
        min={1}
        max={maxAgregar}
        onCambio={setCantidad}
      />
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i}>
          <input
            placeholder={`Nombre del jugador ${i + 1}`}
            value={nombres[i] ?? ''}
            onChange={(e) => {
              const copia = [...nombres]
              copia[i] = e.target.value
              setNombres(copia)
            }}
          />{' '}
          {hayArco && (
            <label>
              <input
                type="checkbox"
                checked={arqs[i] === true}
                onChange={(e) => {
                  const copia = [...arqs]
                  copia[i] = e.target.checked
                  setArqs(copia)
                }}
              />{' '}
              Arquero
            </label>
          )}
        </div>
      ))}
      <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
        <option value="qr">Ya pagó (por QR)</option>
        <option value="cancha">Pagará en cancha</option>
      </select>
      <p>
        Total: {bs(totalAgregar)} Bs
        {nArq > 0 && ` (${nJug} jugador y ${nArq} arquero)`}
      </p>
      <button
        disabled={trabajando || (libres.jugador + libres.arquero) < 1}
        onClick={agregar}
      >
        Agregar
      </button>

      {hayArco && (
        <div>
          <h3>Cupos de arco</h3>
          <p>{libres.arquero} libre(s) de {partido.cupos_arco}</p>
          {libres.arquero > 0 ? (
            <>
              <p>
                Si no hay arqueros suficientes, convierte los cupos de arco libres en
                cupos de jugador. No se puede deshacer.
              </p>
              <Contador
                etiqueta="Convertir:"
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
            <p>Todos los cupos de arco están ocupados.</p>
          )}
        </div>
      )}

      <h3>Cancelaciones</h3>
      {canceladas.length === 0 && <p>No hay cancelaciones.</p>}
      {canceladas.map((r) => (
        <div key={r.id}>
          {r.nombre_invitado ?? r.perfil?.nombre ?? 'Jugador'}
          {r.posicion === 'arquero' && ' (arquero)'}
          {' · '}{r.cancelacion_tipo === 'tardia' ? 'cancelación tardía' : 'cancelación a tiempo'}
          {' · '}
          {r.devolucion_estado
            ? `${bs(r.monto_pagado)} Bs · ${ETIQUETA_DEVOLUCION[r.devolucion_estado]}`
            : 'sin pago'}{' '}
          {['pendiente', 'no_corresponde'].includes(r.devolucion_estado) && (
            <button
              disabled={trabajando}
              onClick={() => ejecutar('marcar_devolucion_hecha', { p_reserva: r.id },
                '¿Ya devolviste este dinero?')}
            >
              Marcar devolución hecha
            </button>
          )}
        </div>
      ))}

      <h3>Resumen de dinero</h3>
      <p>Cobrado (QR y cancha): {bs(cobrado)} Bs</p>
      <p>Devoluciones hechas: − {bs(devHechas)} Bs</p>
      <p><strong>Neto recibido: {bs(neto)} Bs</strong></p>
      <p>Devoluciones pendientes: {bs(devPendientes)} Bs (aún por devolver)</p>
      <p>Neto si se devuelve todo lo pendiente: {bs(neto - devPendientes)} Bs</p>
      <p>Retenido por cancelaciones tardías: {bs(retenido)} Bs (ya está dentro del neto)</p>
    </div>
  )
}