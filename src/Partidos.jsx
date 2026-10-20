import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import TarjetaPartido from './TarjetaPartido'
import InstalarApp from './InstalarApp'
import FranjaAuspiciantes from './FranjaAuspiciantes'
import { hoyBolivia, etiquetaDia, inicioPartido } from './formato'

export default function Partidos() {
  const [partidos, setPartidos] = useState([])
  const [libres, setLibres] = useState({})
  const [misEstados, setMisEstados] = useState({})
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)

  async function cargar() {
    const { data: todos, error } = await supabase
      .from('partidos')
      .select('*, canchas(nombre, enlace_maps, foto_url), encargados(id, perfiles(nombre, apellido, apodo, whatsapp))')
      .neq('estado', 'cancelado')
      .gte('fecha', hoyBolivia())
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })
    if (error) return setError(error.message)

    // Los partidos de hoy que ya empezaron dejan de aparecer
    const data = todos.filter((p) => inicioPartido(p).getTime() > Date.now())
    setPartidos(data)

    const [lib, me] = await Promise.all([
      data.length > 0
        ? supabase.rpc('libres_partidos', { p_ids: data.map((p) => p.id) })
        : Promise.resolve({ data: [], error: null }),
      supabase.rpc('mis_estados'),
    ])
    if (lib.error) return setError(lib.error.message)

    const mapa = {}
    ;(lib.data ?? []).forEach((x) => {
      mapa[x.id_partido] = { jugador: x.libres_jugador, arquero: x.libres_arquero }
    })
    setLibres(mapa)

    const estados = {}
    ;(me.data ?? []).forEach((x) => { estados[x.partido_id] = x })
    setMisEstados(estados)
    setCargado(true)
  }

  useEffect(() => { cargar() }, [])

  if (error) return <p className="aviso aviso-error">Error: {error}</p>
  if (!cargado) return <p className="text-suave">Cargando partidos...</p>

  const dias = []
  partidos.forEach((p) => {
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.fecha === p.fecha) ultimo.items.push(p)
    else dias.push({ fecha: p.fecha, items: [p] })
  })

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Próximos partidos</h1>
      <InstalarApp />
      <FranjaAuspiciantes />

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
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}