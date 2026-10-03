import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Contador from './Contador'
import { bs } from './formato'

export default function ReservarForm({ partido, perfil, onListo, onCancelar }) {
  const [yaTengo, setYaTengo] = useState(null) // null = consultando
  const [cantidad, setCantidad] = useState(1)
  const [nombres, setNombres] = useState([])
  const [yoArquero, setYoArquero] = useState(false)
  const [arqueros, setArqueros] = useState([])
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  

  useEffect(() => {
    supabase.rpc('tengo_cupo', { p_partido: partido.id }).then(({ data, error }) => {
      if (error) return setError(error.message)
      setYaTengo(data)
    })
  }, [])
  
  const [limite, setLimite] = useState(null)

useEffect(() => {
  supabase.from('limites_cuenta')
    .select('max_cupos, max_grupos')
    .eq('nivel', perfil?.nivel ?? 'nuevo')
    .single()
    .then(({ data }) => setLimite(data))
}, [])

  if (yaTengo === null) {
    return error
      ? <div><p>{error}</p><button onClick={onCancelar}>Volver</button></div>
      : <p>Cargando...</p>
  }

  const hayArco = partido.cupos_arco > 0
  const libresJug = partido.libres
  const libresArq = hayArco ? partido.libresArco : 0
const max = Math.min(5, libresJug + libresArq, limite?.max_cupos ?? 5)

  // Con cupo propio, todos los nombres son de acompañantes; si no, uno de los cupos es el mío
  const faltanNombres = yaTengo ? cantidad : cantidad - 1
  const marcasAcomp = Array.from({ length: faltanNombres }, (_, i) => arqueros[i] === true)
  const nArq = (!yaTengo && yoArquero ? 1 : 0) + marcasAcomp.filter(Boolean).length
  const nJug = cantidad - nArq
  // Total estimado: el precio real lo calcula y guarda la base de datos
  const total = nJug * partido.cuota + nArq * partido.cuota_arquero

  function cambiarNombre(i, texto) {
    const copia = [...nombres]
    copia[i] = texto
    setNombres(copia)
  }
  function cambiarArquero(i, valor) {
    const copia = [...arqueros]
    copia[i] = valor
    setArqueros(copia)
  }

  async function reservar() {
    setError(null)
    const lista = Array.from({ length: faltanNombres }, (_, i) => (nombres[i] ?? '').trim())
    if (lista.some((n) => n === '')) {
      return setError('Escribe el nombre de cada acompañante')
    }
    if (nJug > libresJug) return setError(`Solo quedan ${libresJug} cupo(s) de jugador`)
    if (nArq > libresArq) return setError(`Solo quedan ${libresArq} cupo(s) de arquero`)

    setEnviando(true)
    const { data, error } = await supabase.rpc('reservar_cupo', {
      p_partido: partido.id,
      p_incluirme: !yaTengo,
      p_invitados: lista,
      p_yo_arquero: !yaTengo && yoArquero,
      p_invitados_arquero: marcasAcomp,
    })
    setEnviando(false)
    if (error) return setError(error.message)
    onListo(data) // data es el grupo_id
  }

  return (
    <div>
      <h3>{yaTengo ? 'Agregar acompañantes' : 'Reservar'}: {partido.cancha}</h3>
      {perfil?.nivel === 'nuevo' && limite && (
  <p className="rounded-xl border border-amarillo p-3 text-sm">
    Tu cuenta es nueva: puedes tener hasta {limite.max_cupos} cupo(s) sin confirmar a la vez.
    Cuando se confirme tu primer pago, el límite subira.
  </p>
)}
      {yaTengo && <p>Ya tienes un cupo en este partido. Aquí puedes sumar a otras personas.</p>}

      <Contador
        etiqueta={yaTengo ? 'Acompañantes:' : 'Cupos:'}
        valor={cantidad}
        min={1}
        max={Math.max(1, max)}
        onCambio={setCantidad}
      />

      {!yaTengo && (
        <div>
          <strong>Tu cupo</strong>{' '}
          {hayArco && (
            <label>
              <input
                type="checkbox"
                checked={yoArquero}
                onChange={(e) => setYoArquero(e.target.checked)}
              />{' '}
              Soy arquero ({bs(partido.cuota_arquero)} Bs)
            </label>
          )}
        </div>
      )}

      {Array.from({ length: faltanNombres }, (_, i) => (
        <div key={i}>
          <input
            placeholder={`Nombre del acompañante ${i + 1}`}
            value={nombres[i] ?? ''}
            onChange={(e) => cambiarNombre(i, e.target.value)}
          />{' '}
          {hayArco && (
            <label>
              <input
                type="checkbox"
                checked={arqueros[i] === true}
                onChange={(e) => cambiarArquero(i, e.target.checked)}
              />{' '}
              Es arquero
            </label>
          )}
        </div>
      ))}

      <p>
        Total: {bs(total)} Bs
        {nArq > 0 && ` (${nJug} jugador y ${nArq} arquero)`}
      </p>
      {error && <p>{error}</p>}

      <button onClick={reservar} disabled={enviando || max < 1}>
        {enviando ? 'Reservando...' : 'Reservar'}
      </button>
      <button onClick={onCancelar}>Cancelar</button>
    </div>
  )
}