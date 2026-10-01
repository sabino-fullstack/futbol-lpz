import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function ReservarForm({ partido, onListo, onCancelar }) {
  const [incluirme, setIncluirme] = useState(true)
  const [invitados, setInvitados] = useState([])
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const total = (incluirme ? 1 : 0) + invitados.length

  function cambiarInvitado(i, texto) {
    setInvitados(invitados.map((n, j) => (j === i ? texto : n)))
  }

  async function reservar() {
    setError(null)
    if (total < 1) return setError('Reserva al menos un cupo')
    if (invitados.some((n) => n.trim() === '')) {
      return setError('Escribe el nombre de cada acompañante (o quítalo)')
    }
    setEnviando(true)
    const { data, error } = await supabase.rpc('reservar_cupo', {
      p_partido: partido.id,
      p_incluirme: incluirme,
      p_invitados: invitados,
    })
    setEnviando(false)
    if (error) return setError(error.message)
    onListo(data) // data es el grupo_id
  }

  return (
    <div>
      <h3>Reservar: {partido.cancha}</h3>

      <label>
        <input type="checkbox" checked={incluirme}
          onChange={(e) => setIncluirme(e.target.checked)} />{' '}
        Me incluyo yo
      </label>

      <p>Acompañantes:</p>
      {invitados.map((nombre, i) => (
        <div key={i}>
          <input placeholder="Nombre del acompañante" value={nombre}
            onChange={(e) => cambiarInvitado(i, e.target.value)} />
          <button onClick={() => setInvitados(invitados.filter((_, j) => j !== i))}>
            Quitar
          </button>
        </div>
      ))}
      {total < 5 && (
        <button onClick={() => setInvitados([...invitados, ''])}>
          + Agregar acompañante
        </button>
      )}

      <p>Total: {total} cupo(s) · {total * partido.cuota} Bs</p>
      {error && <p>{error}</p>}

      <button onClick={reservar} disabled={enviando}>
        {enviando ? 'Reservando...' : 'Reservar'}
      </button>
      <button onClick={onCancelar}>Cancelar</button>
    </div>
  )
}