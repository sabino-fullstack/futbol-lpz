import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { salir } from './auth'
import Partidos from './Partidos'
import PantallaAcceso from './PantallaAcceso'

function App() {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Al abrir la app: ¿ya hay una sesión guardada?
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })
    // Y se entera de cualquier cambio (entrar, salir)
    const { data: suscripcion } = supabase.auth.onAuthStateChange(
      (_evento, nuevaSesion) => setSesion(nuevaSesion)
    )
    return () => suscripcion.subscription.unsubscribe()
  }, [])

  if (cargando) return <p>Cargando...</p>
  if (!sesion) return <PantallaAcceso />

  return (
    <div>
      <p>
        Hola, {sesion.user.user_metadata.nombre}{' '}
        <button onClick={salir}>Salir</button>
      </p>
      <Partidos />
    </div>
  )
}

export default App