import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Contador from './Contador'

export default function ReservarForm({ partido, onListo, onCancelar }) {
  const [yaTengo, setYaTengo] = useState(null) // null = consultando
  const [cantidad, setCantidad] = useState(1)
  const [nombres, setNombres] = useState([])
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabase.rpc('tengo_cupo', { p_partido: partido.id }).then(({ data, error }) => {
      if (error) return setError(error.message)
      setYaTengo(data)
    })
  }, [])

  if (yaTengo === null) {
    return error
      ? <div><p>{error}</p><button onClick={onCancelar}>Volver</button></div>
      : <p>Cargando...</p>
  }

  const max = Math.min(5, partido.libres)
  // Con cupo propio, todos los nombres son de acompañantes; si no, uno de los cupos es el mío
  const faltanNombres = yaTengo ? cantidad : cantidad - 1

  function cambiarNombre(i, texto) {
    const copia = [...nombres]
    copia[i] = texto
    setNombres(copia)
  }

  async function reservar() {
    setError(null)
    const lista = Array.from({ length: faltanNombres }, (_, i) => (nombres[i] ?? '').trim())
    if (lista.some((n) => n === '')) {
      return setError('Escribe el nombre de cada acompañante')
    }
    setEnviando(true)
    const { data, error } = await supabase.rpc('reservar_cupo', {
      p_partido: partido.id,
      p_incluirme: !yaTengo,
      p_invitados: lista,
    })
    setEnviando(false)
    if (error) return setError(error.message)
    onListo(data) // data es el grupo_id
  }

  return (
    <div>
      <h3>{yaTengo ? 'Agregar acompañantes' : 'Reservar'}: {partido.cancha}</h3>
      {yaTengo && <p>Ya tienes un cupo en este partido. Aquí puedes sumar a otras personas.</p>}

      <Contador
        etiqueta={yaTengo ? 'Acompañantes:' : 'Cupos:'}
        valor={cantidad}
        min={1}
        max={Math.max(1, max)}
        onCambio={setCantidad}
      />

      {!yaTengo && <p>Tu cupo ya está incluido.</p>}
      {Array.from({ length: faltanNombres }, (_, i) => (
        <div key={i}>
          <input
            placeholder={`Nombre del acompañante ${i + 1}`}
            value={nombres[i] ?? ''}
            onChange={(e) => cambiarNombre(i, e.target.value)}
          />
        </div>
      ))}

      <p>Total: {cantidad * partido.cuota} Bs</p>
      {error && <p>{error}</p>}

      <button onClick={reservar} disabled={enviando || max < 1}>
        {enviando ? 'Reservando...' : 'Reservar'}
      </button>
      <button onClick={onCancelar}>Cancelar</button>
    </div>
  )
}