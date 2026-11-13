import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import Etiqueta, { BORDE_IZQ } from './EtiquetaEstado'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import Rueda from './Rueda'
import Interruptor from './Interruptor'
import { fechaCorta, rangoHora, inicioPartido, finPartido, mapaEspera } from './formato'
import { Banknote, QrCode, RotateCcw, Upload, UserCheck, Bell, ClipboardList } from 'lucide-react'
import MiEstadoCuenta from './MiEstadoCuenta'

const COLUMNAS = 'id, cancha, modalidad, fecha, hora, hora_fin, cupos, cupos_arco, estado'

export default function MisPartidos({ perfilId, esSuperadmin }) {
  const [params, setParams] = useSearchParams()
  const ver = params.get('ver') === 'pasados' ? 'pasados' : 'proximos'

  const [items, setItems] = useState([]) // { partido, asig }
  const [libres, setLibres] = useState({})
  const [pend, setPend] = useState({})
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)
  const [subiendo, setSubiendo] = useState(null)
  const [verTodos, setVerTodos] = useState(false)
  const [pasadosVisibles, setPasadosVisibles] = useState(10)
  const [aTodos, setATodos] = useState(true)
  const [espera, setEspera] = useState({})

  async function cargar() {
    const a = await supabase.from('encargados')
      .select(`id, partido_id, tipo, qr_url, partidos(${COLUMNAS})`)
      .eq('perfil_id', perfilId)
    if (a.error) return setError(a.error.message)

    const mias = new Map()
    a.data.forEach((x) => {
      if (x.partidos) mias.set(x.partido_id, x)
    })

    let lista = [...mias.values()].map((x) => ({ partido: x.partidos, asig: x }))
    if (esSuperadmin && verTodos) {
      const t = await supabase.from('partidos').select(COLUMNAS)
      if (t.error) return setError(t.error.message)
      lista = t.data.map((p) => ({ partido: p, asig: mias.get(p.id) ?? null }))
    }
    setItems(lista)

    const ids = lista.map((x) => x.partido.id)
    if (ids.length > 0) {
      // 2 consultas y 2 variables, en el mismo orden
      const [pe, li] = await Promise.all([
        supabase.rpc('pendientes_partidos', { p_ids: ids }),
        supabase.rpc('libres_partidos', { p_ids: ids }),
      ])
      if (pe.error || li.error) return setError((pe.error || li.error).message)
      const mp = {}
      ;(pe.data ?? []).forEach((x) => { mp[x.id_partido] = x })
      const ml = {}
      ;(li.data ?? []).forEach((x) => { ml[x.id_partido] = x })
      setPend(mp)
      setLibres(ml)
      const es = await supabase.rpc('espera_partidos', { p_ids: ids })
setEspera(mapaEspera(es.data))
    }
    setCargado(true)
  }

  useEffect(() => { cargar() }, [verTodos])
  const [tieneAcuerdos, setTieneAcuerdos] = useState(false)
  useEffect(() => {
  supabase.rpc('tengo_acuerdos').then(({ data }) => setTieneAcuerdos(data === true))
}, [])

async function subirQR(asignacion, archivo) {
  if (!archivo) return
  setError(null)
  setSubiendo(asignacion.id)

  const ext = archivo.name.split('.').pop().toLowerCase()
  const ruta = `${perfilId}/${asignacion.id}-${Date.now()}.${ext}`

  const { error: errSubida } = await supabase.storage
    .from('qrs')
    .upload(ruta, archivo, { contentType: archivo.type, cacheControl: '31536000' })
  if (errSubida) {
    setSubiendo(null)
    return setError('No se pudo subir: ' + errSubida.message)
  }

  const nuevo = supabase.storage.from('qrs').getPublicUrl(ruta).data.publicUrl

  // Este partido y, si se elige, todos mis próximos partidos
const mios = items.filter((x) => x.asig && x.asig.tipo === 'encargado')
  const objetivos = mios.filter(
    (x) => x.asig.id === asignacion.id ||
      (aTodos && x.partido.estado !== 'cancelado' && finPartido(x.partido).getTime() >= Date.now())
  )
  const ids = objetivos.map((x) => x.asig.id)
  const viejos = [...new Set(objetivos.map((x) => x.asig.qr_url).filter(Boolean))]

  const { error: errGuardar } = await supabase
    .from('encargados')
    .update({ qr_url: nuevo })
    .in('id', ids)
  if (errGuardar) {
    setSubiendo(null)
    return setError('Se subió, pero no se guardó: ' + errGuardar.message)
  }

  // Borra los QR anteriores que ya nadie usa (otro partido puede seguir usándolos)
  for (const url of viejos) {
    if (!url.includes('/qrs/')) continue
    const { data: usos } = await supabase.from('encargados').select('id').eq('qr_url', url).limit(1)
    if (usos && usos.length === 0) {
      const rutaVieja = url.split('/qrs/')[1]
      const { data: borrados, error: errBorrar } = await supabase.storage.from('qrs').remove([rutaVieja])
      if (errBorrar || !borrados?.length) {
        console.warn('No se pudo borrar el QR anterior', errBorrar, rutaVieja)
      }
    }
  }

  setSubiendo(null)
  cargar()
}

  if (!cargado && !error) return <Cargando />

  const ahora = Date.now()
const conTiempo = items
.filter((x) => x.partido.estado !== 'cancelado' ||
  (x.asig?.tipo !== 'ayudante' && (pend[x.partido.id]?.devoluciones ?? 0) > 0))
  .map((x) => ({
    ...x,
    inicio: inicioPartido(x.partido).getTime(),
    fin: finPartido(x.partido).getTime(),
  }))
const proximos = conTiempo
  .filter((x) => x.partido.estado !== 'cancelado' && x.fin >= ahora)
  .sort((a, b) => a.inicio - b.inicio)
const pasados = conTiempo
  .filter((x) => x.partido.estado === 'cancelado' || x.fin < ahora)
  .sort((a, b) => b.inicio - a.inicio)
  // El cobro en cancha solo cuenta cuando el partido ya empezó
const alertas = (x) => {
  const p = pend[x.partido.id]
  const empezo = x.inicio <= ahora
  return {
    cobros: p && empezo ? p.por_cobrar : 0,
    devs: p && x.asig?.tipo !== 'ayudante' ? p.devoluciones : 0,
    sinMarcar: p && empezo && ahora <= x.fin + 72 * 3600 * 1000 ? p.sin_marcar : 0,
  }
}
  const hayAlertaPasado = pasados.some((x) => {
    const a = alertas(x)
    return a.cobros + a.devs + a.sinMarcar > 0
  })
  const lista = ver === 'proximos' ? proximos : pasados.slice(0, pasadosVisibles)

  function tarjeta(x) {

    const p = x.partido
        const cancelado = p.estado === 'cancelado'
    const l = libres[p.id]
    const a = alertas(x)
    const hayAlerta = a.cobros + a.devs + a.sinMarcar > 0
    return (
      <div key={p.id} className={`tarjeta space-y-2.5 border-l-4 ${cancelado ? BORDE_IZQ.rojo : hayAlerta ? BORDE_IZQ.amarillo : BORDE_IZQ.verde}`}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 truncate text-xl">{p.cancha}</h3>
            {x.asig?.tipo === 'ayudante' && (
  <span className="shrink-0 rounded-full bg-borde px-2 py-0.5 text-[11px] font-bold uppercase text-suave">
    Ayudante
  </span>
)}
            {cancelado && <Etiqueta clave="partido_cancelado" />}
            {p.modalidad && (
              <span className="shrink-0 rounded-full bg-verde/15 px-2 py-0.5 text-[11px] font-bold uppercase text-verde">
                {p.modalidad}
              </span>
            )}
          </div>
          <p className="text-sm text-suave first-letter:uppercase">
            {fechaCorta(p.fecha)} · {rangoHora(p)}
          </p>
        </div>

        {l && !cancelado && (
          <p className="text-sm">
            Jugadores: <strong>{p.cupos - l.libres_jugador}/{p.cupos}</strong>
            {(() => {
  const e = espera[p.id]
  const n = (e?.jugador?.esperando ?? 0) + (e?.arquero?.esperando ?? 0)
  return n > 0 && !cancelado ? (
    <p className="flex items-center gap-1.5 text-sm font-semibold text-amarillo-texto">
      <Bell size={16} /> {n} {n === 1 ? 'persona en lista de espera' : 'personas en lista de espera'}
    </p>
  ) : null
})()}
            {p.cupos_arco > 0 && (
              <> · Arqueros: <strong>{p.cupos_arco - l.libres_arquero}/{p.cupos_arco}</strong></>
            )}
          </p>
        )}

        {a.cobros > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amarillo-texto">
            <Banknote size={16} /> {a.cobros} cupo(s) por cobrar en cancha
          </p>
        )}
        {a.devs > 0 && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amarillo-texto">
            <RotateCcw size={16} /> {a.devs} devolución(es) pendiente(s)
          </p>
        )}
        {a.sinMarcar > 0 && (
  <p className="flex items-center gap-1.5 text-sm font-semibold text-amarillo-texto">
    <UserCheck size={16} /> {a.sinMarcar} sin marcar asistencia
  </p>
)}

<Link to={`/a-cargo/${p.id}`} className="btn btn-primario">
  <ClipboardList size={20} /> Gestionar partido
</Link>

        {x.asig?.tipo === 'encargado' && !cancelado && (
          <details className="rounded-xl border border-borde p-2.5">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
              <QrCode size={18} className="shrink-0 text-verde" />
              <span className="flex-1">Mi QR de pago</span>
              {!x.asig.qr_url && (
                <span className="rounded-full bg-amarillo/15 px-2 py-0.5 text-xs font-bold text-amarillo-texto">
                  Falta subirlo
                </span>
              )}
            </summary>
            <div className="space-y-2 pt-3">
              {x.asig.qr_url ? (
                <img src={x.asig.qr_url} alt="Tu QR" className="mx-auto w-52 max-w-full rounded-lg bg-white p-2" />
              ) : (
                <p className="aviso aviso-alerta text-sm">
                  Aún no subiste tu QR. Los jugadores no podrán pagarte hasta que lo subas.
                </p>
              )}
              <label className="flex items-center gap-3 py-1 text-sm">
  <input type="checkbox" checked={aTodos} onChange={(e) => setATodos(e.target.checked)} />
  Usar este QR en todos mis próximos partidos
</label>
              <label className="btn cursor-pointer">
                {subiendo === x.asig.id ? (
                  <><Rueda size={16} /> Subiendo...</>
                ) : (
                  <><Upload size={16} /> {x.asig.qr_url ? 'Cambiar QR' : 'Subir QR'}</>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={subiendo === x.asig.id}
                  onChange={(e) => {
                    subirQR(x.asig, e.target.files[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </details>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2>A mi cargo</h2>
      {tieneAcuerdos && <MiEstadoCuenta />}
      {error && <p className="aviso aviso-error">{error}</p>}

      {esSuperadmin && (
        <Interruptor
          activo={verTodos}
          onCambio={(v) => { setVerTodos(v); setCargado(false) }}
          etiqueta="Ver todos los partidos"
        />
      )}

      <nav className="flex flex-wrap gap-2">
        {[
          ['proximos', `Próximos (${proximos.length})`],
          ['pasados', `Pasados (${pasados.length})${hayAlertaPasado ? ' ⚠️' : ''}`],
        ].map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setParams({ ver: id }, { replace: true })}
            className={ver === id ? 'border-transparent bg-verde text-sobre-verde' : ''}
          >
            {texto}
          </button>
        ))}
      </nav>

      {ver === 'pasados' && hayAlertaPasado && (
        <p className="aviso aviso-alerta text-sm">
          Hay partidos pasados con cobros en cancha o devoluciones sin resolver. Ábrelos con "Gestionar".
        </p>
      )}

      {lista.length === 0 && (
        <p className="text-suave">
          {ver === 'proximos' ? 'No tienes partidos próximos a tu cargo.' : 'No hay partidos pasados.'}
          {esSuperadmin && !verTodos && ' Activa "Ver todos los partidos" para ver los de otros encargados.'}
        </p>
      )}

      {lista.map(tarjeta)}

      {ver === 'pasados' && pasados.length > pasadosVisibles && (
        <button onClick={() => setPasadosVisibles(pasadosVisibles + 10)}>Mostrar 10 más</button>
      )}
    </div>
  )
}