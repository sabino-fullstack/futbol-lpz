import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Interruptor from './Interruptor'

const ordenar = (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es')
const clave = (t) => t.trim().toLowerCase()

export default function Zonas({ onCambio }) {
  const [zonas, setZonas] = useState([])
  const [pend, setPend] = useState([])
  const [nueva, setNueva] = useState('')
  const [lote, setLote] = useState('')
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  async function cargar() {
    const [z, p] = await Promise.all([
      supabase.from('zonas').select('id, nombre, orden, activa'),
      supabase.rpc('zonas_otras_pendientes'),
    ])
    if (z.error || p.error) return setError((z.error || p.error).message)
    setZonas([...z.data].sort(ordenar))
    setPend(p.data ?? [])
  }

  useEffect(() => { cargar() }, [])

  async function agregar(nombres) {
    setError(null)
    setAviso(null)
    const pedidos = nombres.map((x) => x.trim()).filter(Boolean)
    const existentes = new Set(zonas.map((z) => clave(z.nombre)))
    const nuevos = []
    for (const n of pedidos) {
      if (n.length < 2 || n.length > 60) {
        return setError(`"${n.slice(0, 30)}" no es un nombre válido (entre 2 y 60 letras).`)
      }
      if (!existentes.has(clave(n))) { existentes.add(clave(n)); nuevos.push(n) }
    }
    if (nuevos.length === 0) {
      return setAviso(pedidos.length > 0 ? 'Todas esas zonas ya existían.' : 'No escribiste ninguna zona.')
    }
    setTrabajando(true)
    const { error } = await supabase.from('zonas').insert(nuevos.map((nombre) => ({ nombre, orden: 0 })))
    setTrabajando(false)
    if (error) return setError(error.message)
    const omitidas = pedidos.length - nuevos.length
    setAviso(`Se agregaron ${nuevos.length} zona(s).${omitidas > 0 ? ` ${omitidas} ya existían.` : ''}`)
    setNueva('')
    setLote('')
    await cargar()
    onCambio?.()
  }

  async function visible(z, v) {
    setError(null)
    const { data, error } = await supabase.from('zonas').update({ activa: v }).eq('id', z.id).select('id')
    if (error) return setError(error.message)
    if (!data?.length) return setError('No se pudo cambiar la zona')
    cargar()
  }

  async function renombrar(z) {
    const t = window.prompt('Nuevo nombre de la zona:', z.nombre)
    if (t === null) return
    const n = t.trim()
    if (n.length < 2 || n.length > 60) return setError('El nombre debe tener entre 2 y 60 letras')
    setError(null)
    const { error } = await supabase.from('zonas').update({ nombre: n }).eq('id', z.id)
    if (error) return setError(error.code === '23505' ? 'Ya existe una zona con ese nombre' : error.message)
    cargar()
    onCambio?.()
  }

  async function promover(p) {
    const t = window.prompt(
      `Nombre oficial para "${p.texto}" (${p.cuentas} persona(s) la escribieron):`, p.texto
    )
    if (t === null) return
    setError(null)
    setAviso(null)
    setTrabajando(true)
    const { data, error } = await supabase.rpc('promover_zona_otra', { p_clave: p.clave, p_nombre: t })
    setTrabajando(false)
    if (error) return setError(error.message)
    setAviso(`Listo: ${data} persona(s) quedaron asignadas a esa zona.`)
    await cargar()
    onCambio?.()
  }

  return (
    <details className="tarjeta">
      <summary className="cursor-pointer font-semibold">
        Administrar zonas ({zonas.filter((z) => z.activa).length})
        {pend.length > 0 && <span className="ml-2 text-amarillo-texto">· {pend.length} por revisar</span>}
      </summary>
      <div className="space-y-4 pt-3">
        {error && <p className="aviso aviso-error">{error}</p>}
        {aviso && <p className="aviso aviso-ok">{aviso}</p>}

        {pend.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-bold">Zonas escritas por la gente ("Otra")</h4>
            {pend.map((p) => (
              <div key={p.clave} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {p.texto} <span className="text-sm text-suave">· {p.cuentas} persona(s)</span>
                </span>
                <button disabled={trabajando} onClick={() => promover(p)}>Agregar a la lista</button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-bold">Agregar zonas</h4>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1"
              placeholder="Nombre de la zona"
              maxLength={60}
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
            />
            <button disabled={trabajando} onClick={() => agregar([nueva])}>Agregar</button>
          </div>
          <textarea
            rows={4}
            placeholder={'O pega varias, una por línea:\nSopocachi\nMiraflores'}
            value={lote}
            onChange={(e) => setLote(e.target.value)}
          />
          <button disabled={trabajando || lote.trim() === ''} onClick={() => agregar(lote.split('\n'))}>
            Agregar todas
          </button>
        </div>

        <div className="space-y-2">
          <h4 className="font-bold">Lista actual</h4>
          <p className="text-xs text-suave">
            Las zonas ocultas no se pueden elegir de nuevo, pero quienes ya la tenían la conservan.
          </p>
          {zonas.map((z) => (
            <div key={z.id} className="flex flex-wrap items-center gap-2">
              <span className={`min-w-0 flex-1 truncate ${z.activa ? '' : 'text-suave line-through'}`}>{z.nombre}</span>
              <Interruptor activo={z.activa} onCambio={(v) => visible(z, v)} etiqueta="Visible" />
              <button onClick={() => renombrar(z)}>Renombrar</button>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}