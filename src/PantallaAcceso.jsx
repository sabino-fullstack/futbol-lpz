import { useState } from 'react'
import { registrar, entrar } from './auth'

function traducir(msg = '') {
  if (msg.includes('Invalid login credentials')) return 'El número o la contraseña no son correctos.'
  if (msg.includes('already registered')) return 'Ese número ya tiene una cuenta. Toca "Ya tengo cuenta".'
  if (msg.includes('at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  return msg
}

const campo = 'w-full rounded-xl border border-borde bg-tarjeta px-4 py-3 text-lg'

export default function PantallaAcceso() {
  const [modo, setModo] = useState('entrar') // 'entrar' | 'crear'
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [apodo, setApodo] = useState('')
  const [numero, setNumero] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  const creando = modo === 'crear'

  async function enviar() {
    setError(null)
    if (creando && (!nombre.trim() || !apellido.trim())) {
      return setError('Escribe tu nombre y tu apellido.')
    }
    if (!numero.trim() || !contrasena) {
      return setError('Escribe tu número y tu contraseña.')
    }
    setCargando(true)
    const { error } = creando
      ? await registrar({ nombre, apellido, apodo, numero, contrasena })
      : await entrar({ numero, contrasena })
    setCargando(false)
    if (error) setError(traducir(error.message))
    // Si todo sale bien, App detecta la sesión y cambia sola
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-2">
        <img src="/logo.png" alt="Fútbol LPZ" className="h-28 w-28 rounded-full" />
        <h1 className="text-2xl font-bold">Fútbol LPZ</h1>
        <p className="text-suave">{creando ? 'Crea tu cuenta' : 'Entra a tu cuenta'}</p>
      </div>

      {creando && (
        <>
          <input className={campo} placeholder="Nombre" autoComplete="given-name"
            value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className={campo} placeholder="Apellido" autoComplete="family-name"
            value={apellido} onChange={(e) => setApellido(e.target.value)} />
          <input className={campo} placeholder="Apodo (opcional)" maxLength={30}
            value={apodo} onChange={(e) => setApodo(e.target.value)} />
          <p className="-mt-2 text-sm text-suave">
            Usa tu nombre y apellido reales: así el encargado identifica tu pago.
          </p>
        </>
      )}

      <input className={campo} placeholder="Tu número de WhatsApp" type="tel"
        inputMode="numeric" autoComplete="username"
        value={numero} onChange={(e) => setNumero(e.target.value)} />

      <div className="flex gap-2">
        <input className={campo} placeholder="Contraseña (mínimo 6)"
          type={verClave ? 'text' : 'password'}
          autoComplete={creando ? 'new-password' : 'current-password'}
          value={contrasena} onChange={(e) => setContrasena(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && enviar()} />
        <button type="button" onClick={() => setVerClave(!verClave)}>
          {verClave ? 'Ocultar' : 'Ver'}
        </button>
      </div>

      {error && <p className="rounded-xl border border-rojo p-3 text-rojo">{error}</p>}

      <button onClick={enviar} disabled={cargando}
        className="w-full rounded-xl border-0 bg-verde py-4 text-lg font-bold text-white">
        {cargando ? 'Un momento...' : creando ? 'Crear cuenta' : 'Entrar'}
      </button>

      <button type="button" onClick={() => { setError(null); setModo(creando ? 'entrar' : 'crear') }}
        className="border-0 bg-transparent text-base text-verde underline">
        {creando ? 'Ya tengo cuenta' : 'Soy nuevo, crear cuenta'}
      </button>
    </div>
  )
}