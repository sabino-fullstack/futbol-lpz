import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { salir } from './auth'
import Partidos from './Partidos'
import MisReservas from './MisReservas'
import Admin from './Admin'
import MisPartidos from './MisPartidos'
import PantallaAcceso from './PantallaAcceso'

function App() {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const [esEncargado, setEsEncargado] = useState(false)
  const [vista, setVista] = useState('partidos')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session)
      setCargando(false)
    })
    const { data: suscripcion } = supabase.auth.onAuthStateChange(
      (_evento, nuevaSesion) => setSesion(nuevaSesion)
    )
    return () => suscripcion.subscription.unsubscribe()
  }, [])

  const usuarioId = sesion?.user.id
  useEffect(() => {
    if (!usuarioId) {
      setPerfil(null)
      setEsEncargado(false)
      setVista('partidos')
      return
    }
    supabase.from('perfiles').select('*').eq('id', usuarioId).single()
      .then(({ data }) => setPerfil(data))
    supabase.from('encargados').select('id').eq('perfil_id', usuarioId).limit(1)
      .then(({ data }) => setEsEncargado((data ?? []).length > 0))
  }, [usuarioId])

  if (cargando) return <p>Cargando...</p>
  if (!sesion) return <PantallaAcceso />

  const esSuperadmin = perfil?.rol === 'superadmin'
  // Si por alguna razón la vista no está permitida, se vuelve a Partidos
  const permitida =
    vista === 'partidos' || vista === 'reservas' ||
    (vista === 'mis' && esEncargado) || (vista === 'admin' && esSuperadmin)
  const actual = permitida ? vista : 'partidos'

  return (
    <div>
      <p>
        Hola, {perfil?.nombre ?? '...'}{' '}
        <button onClick={salir}>Salir</button>
      </p>

      <nav>
        <button onClick={() => setVista('partidos')}>Partidos</button>
        <button onClick={() => setVista('reservas')}>Mis reservas</button>
        {esEncargado && (
          <button onClick={() => setVista('mis')}>Mis partidos a cargo</button>
        )}
        {esSuperadmin && (
          <button onClick={() => setVista('admin')}>Administración</button>
        )}
      </nav>

      {actual === 'partidos' && <Partidos perfil={perfil} />}
      {actual === 'reservas' && (
        <MisReservas perfilId={usuarioId} nombreJugador={perfil?.nombre ?? ''} />
      )}
      {actual === 'mis' && <MisPartidos perfilId={usuarioId} />}
      {actual === 'admin' && <Admin />}
    </div>
  )
}

export default App