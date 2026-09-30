import { useState } from 'react'
import { registrar, entrar } from './auth'

export default function PantallaAcceso() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'crear'
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function enviar() {
    setError(null)
    setCargando(true)
    const { error } =
      modo === 'crear'
        ? await registrar({ nombre, numero, contrasena })
        : await entrar({ numero, contrasena })
    setCargando(false)
    if (error) setError(error.message)
    // Si todo sale bien, App detecta la sesión y cambia sola
  }

  return (
    <div>
      <h2>{modo === 'crear' ? 'Crear cuenta' : 'Entrar'}</h2>

      {modo === 'crear' && (
        <input placeholder="Tu nombre" value={nombre}
          onChange={(e) => setNombre(e.target.value)} />
      )}
      <input placeholder="Tu número de WhatsApp" inputMode="numeric"
        value={numero} onChange={(e) => setNumero(e.target.value)} />
      <input placeholder="Contraseña (mínimo 6)" type="password"
        value={contrasena} onChange={(e) => setContrasena(e.target.value)} />

      {error && <p>{error}</p>}

      <button onClick={enviar} disabled={cargando}>
        {modo === 'crear' ? 'Crear cuenta' : 'Entrar'}
      </button>
      <button onClick={() => setModo(modo === 'crear' ? 'entrar' : 'crear')}>
        {modo === 'crear' ? 'Ya tengo cuenta' : 'Soy nuevo, crear cuenta'}
      </button>
    </div>
  )
}