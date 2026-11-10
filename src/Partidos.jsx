import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TarjetaPartido from './TarjetaPartido'
import ProximoPartido from './ProximoPartido'
import AyudaInicial from './AyudaInicial'
import PerfilPendiente from './PerfilPendiente'
import InstalarApp from './InstalarApp'
import PieApp from './PieApp'
import Cargando from './Cargando'
import { useAutoRefrescar } from './useAutoRefrescar'
import { hoyBolivia, etiquetaDia, inicioPartido, mapaEspera } from './formato'

export default function Partidos({ perfil }) {
  const [partidos, setPartidos] = useState([])
  const [libres, setLibres] = useState({})
  const [misEstados, setMisEstados] = useState({})
  const [espera, setEspera] = useState({})
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)

  // silencioso = true: actualización automática, no muestra errores ni parpadea
  async function cargar(silencioso) {
    const callado = silencioso === true
    const { data: todos, error } = await supabase
      .from('partidos')
      .select('*, canchas(nombre, enlace_maps, foto_url, foto_mini_url), encargados(id, tipo, perfiles(nombre, apellido, apodo, whatsapp))')
      .neq('estado', 'cancelado')
      .gte('fecha', hoyBolivia())
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })
    if (error) {
      if (!callado) setError(error.message)
      return
    }

    // Los partidos de hoy que ya empezaron dejan de aparecer
    const data = todos.filter((p) => inicioPartido(p).getTime() > Date.now())
    const ids = data.map((p) => p.id)
    const vacio = Promise.resolve({ data: [], error: null })

    // 3 consultas y 3 variables, en el mismo orden
    const [lib, me, es] = await Promise.all([
      ids.length > 0 ? supabase.rpc('libres_partidos', { p_ids: ids }) : vacio,
      supabase.rpc('mis_estados'),
      ids.length > 0 ? supabase.rpc('espera_partidos', { p_ids: ids }) : vacio,
    ])
    if (lib.error) {
      if (!callado) setError(lib.error.message)
      return
    }

    const mapa = {}
    ;(lib.data ?? []).forEach((x) => {
      mapa[x.id_partido] = { jugador: x.libres_jugador, arquero: x.libres_arquero }
    })
    const estados = {}
    ;(me.data ?? []).forEach((x) => { estados[x.partido_id] = x })

    // Todo junto, para que un partido nuevo no aparezca un instante como "lleno"
    setPartidos(data)
    setLibres(mapa)
    setMisEstados(estados)
    setEspera(mapaEspera(es.data)) // si esta consulta falla, la lista igual se muestra
    setError(null)
    setCargado(true)
  }

  useEffect(() => { cargar() }, [])
  useAutoRefrescar(() => cargar(true))

  if (error && !cargado) return <p className="aviso aviso-error">Error: {error}</p>
  if (!cargado) return <Cargando texto="Cargando partidos..." />

  const proximo = partidos.find((p) => (misEstados[p.id]?.confirmados ?? 0) > 0)

  const dias = []
  partidos.forEach((p) => {
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.fecha === p.fecha) ultimo.items.push(p)
    else dias.push({ fecha: p.fecha, items: [p] })
  })

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Próximos partidos</h1>

      {proximo && <ProximoPartido p={proximo} estado={misEstados[proximo.id]} />}
      <AyudaInicial perfil={perfil} />
      <PerfilPendiente perfil={perfil} />
      <InstalarApp />

      {partidos.length === 0 && (
        <p className="text-suave">No hay partidos disponibles por ahora.</p>
      )}

      {dias.map((dia) => {
        const et = etiquetaDia(dia.fecha)
        return (
          <section key={dia.fecha} className="space-y-2.5">
            <div className="flex items-baseline gap-2 border-b border-borde pb-1">
              <h3 className={`text-2xl ${et.titulo === 'Hoy' ? 'text-verde' : ''}`}>{et.titulo}</h3>
              <span className="text-sm text-suave first-letter:uppercase">{et.detalle}</span>
            </div>
            {dia.items.map((p) => (
              <TarjetaPartido
                key={p.id}
                p={p}
                libres={libres[p.id] ?? { jugador: 0, arquero: 0 }}
                miEstado={misEstados[p.id]}
                espera={espera[p.id]}
                onEsperaCambio={() => cargar(true)}
              />
            ))}
          </section>
        )
      })}

      <PieApp />
    </div>
  )
}