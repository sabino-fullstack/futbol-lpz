import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from './supabaseClient'
import { salir } from './auth'
import Rueda from './Rueda'

const campo = 'w-full rounded-xl border border-borde bg-tarjeta px-4 py-3 text-lg'

function traducir(msg = '') {
  if (msg.includes('different from the old')) return 'La contraseña nueva debe ser distinta a la temporal.'
  if (msg.includes('at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  return 'No se pudo cambiar la contraseña. Inténtalo de nuevo.'
}

export default function CambiarClave({ onListo }) {
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [ver, setVer] = useState(false)
  const [hecho, setHecho] = useState(false) // la contraseña ya se cambió, falta cerrar el trámite
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function guardar() {
    setError(null)
    if (!hecho) {
      if (nueva.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
      if (nueva !== repetir) return setError('Las dos contraseñas no coinciden.')
    }
    setCargando(true)
    if (!hecho) {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) {
        setCargando(false)
        return setError(traducir(error.message))
      }
      setHecho(true)
    }
    const r = await supabase.rpc('clave_cambiada')
    setCargando(false)
    if (r.error) {
      return setError('Tu contraseña ya cambió, pero falta un último paso. Toca "Guardar" otra vez.')
    }
    onListo()
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/icon-192.png" alt="" className="h-20 w-20 rounded-full" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide">
          Crea tu contraseña
        </h1>
        <p className="text-suave">
          Entraste con una contraseña temporal. Elige una nueva que solo tú conozcas.
        </p>
      </div>

      <div className="relative">
        <input
          className={`${campo} pr-14`}
          type={ver ? 'text' : 'password'}
          placeholder="Contraseña nueva (mínimo 6)"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          disabled={hecho}
        />
        <button
          type="button"
          onClick={() => setVer(!ver)}
          aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
          className="btn btn-icono absolute right-1.5 top-1/2 -translate-y-1/2 border-0 bg-transparent"
        >
          {ver ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      <input
        className={campo}
        type={ver ? 'text' : 'password'}
        placeholder="Repite la contraseña"
        autoComplete="new-password"
        value={repetir}
        onChange={(e) => setRepetir(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && guardar()}
        disabled={hecho}
      />

      {error && <p className="aviso aviso-error">{error}</p>}

      <button onClick={guardar} disabled={cargando} className="btn btn-primario">
        {cargando ? <><Rueda /> Guardando...</> : 'Guardar'}
      </button>
      <button type="button" onClick={salir} className="border-0 bg-transparent text-base text-suave underline">
        Salir
      </button>
    </div>
  )
}