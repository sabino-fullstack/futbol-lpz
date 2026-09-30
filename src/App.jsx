import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [partidos, setPartidos] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    async function cargarPartidos() {
      const { data, error } = await supabase
        .from('partidos')
        .select('*')
        .order('fecha', { ascending: true })

      if (error) setError(error.message)
      else setPartidos(data)
    }
    cargarPartidos()
  }, [])

  if (error) return <p>Error: {error}</p>

  return (
    <div>
      <h1>Fútbol LPZ</h1>
      {partidos.map((p) => (
        <div key={p.id}>
          <h2>{p.cancha}</h2>
          <p>{p.fecha} · {p.hora}</p>
          <p>Cuota: {p.cuota} Bs · Cupos: {p.cupos}</p>
        </div>
      ))}
    </div>
  )
}

export default App