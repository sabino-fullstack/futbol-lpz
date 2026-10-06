import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const EQUIPOS = [2, 3, 4]

export default function Formatos() {
  const [textos, setTextos] = useState({})
  const [aviso, setAviso] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  async function cargar() {
    const { data, error } = await supabase.from('formatos_plantilla').select('equipos, texto')
    if (error) return setError(error.message)
    const m = {}
    data.forEach((x) => { m[x.equipos] = x.texto })
    setTextos(m)
  }

  useEffect(() => { cargar() }, [])

  async function guardar(n) {
    setError(null)
    setAviso(null)
    const texto = (textos[n] ?? '').trim()
    setTrabajando(true)
    const { error } = texto === ''
      ? await supabase.from('formatos_plantilla').delete().eq('equipos', n)
      : await supabase.from('formatos_plantilla').upsert({ equipos: n, texto }, { onConflict: 'equipos' })
    setTrabajando(false)
    if (error) return setError(error.message)
    setAviso(texto === '' ? `Plantilla de ${n} equipos eliminada.` : `Plantilla de ${n} equipos guardada.`)
  }

  return (
    <div className="space-y-4">
      <p className="text-suave">
        Escribe una sola vez cómo se juega según los equipos. Al crear un partido, el texto se
        carga solo y puedes ajustarlo para ese día.
      </p>
      {error && <p className="aviso aviso-error">{error}</p>}
      {aviso && <p className="aviso aviso-ok">{aviso}</p>}

      {EQUIPOS.map((n) => (
        <div key={n} className="tarjeta space-y-2">
          <h4 className="font-bold">Con {n} equipos</h4>
          <textarea
            rows={6}
            maxLength={1000}
            placeholder="Cómo se juega: tiempos, rotación, desempate..."
            value={textos[n] ?? ''}
            onChange={(e) => setTextos({ ...textos, [n]: e.target.value })}
          />
          <button disabled={trabajando} onClick={() => guardar(n)}>Guardar</button>
        </div>
      ))}
    </div>
  )
}