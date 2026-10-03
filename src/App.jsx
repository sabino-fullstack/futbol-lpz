import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { salir } from './auth'
import Partidos from './Partidos'
import MisReservas from './MisReservas'
import Admin from './Admin'
import MisPartidos from './MisPartidos'
import PantallaAcceso from './PantallaAcceso'
import BotonTema from './BotonTema'

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

  const tabs = [
  ['partidos', 'Partidos'],
  ['reservas', 'Mis reservas'],
  esEncargado && ['mis', 'A mi cargo'],
  esSuperadmin && ['admin', 'Administración'],
].filter(Boolean)

return (
  <div className="min-h-screen">
    <header className="sticky top-0 z-10 border-b border-borde bg-fondo/90 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center gap-3 p-3">
        <img src="/logo.png" alt="Fútbol LPZ" className="h-10 w-10 rounded-full" />
        <div className="flex-1 leading-tight">
          <p className="font-bold">Fútbol LPZ</p>
          <p className="text-xs text-suave">Hola, {perfil?.nombre ?? '...'}</p>
        </div>
        <BotonTema />
        <button onClick={salir}>Salir</button>
      </div>
      <nav className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-3 pb-3">
        {tabs.map(([id, texto]) => (
          <button
            key={id}
            onClick={() => setVista(id)}
            className={`whitespace-nowrap ${actual === id ? 'border-transparent bg-verde text-white' : ''}`}
          >
            {texto}
          </button>
        ))}
      </nav>
    </header>

    <main className="mx-auto max-w-xl p-4">
      {actual === 'partidos' && <Partidos perfil={perfil} />}
      {actual === 'reservas' && (
        <MisReservas perfilId={usuarioId} nombreJugador={perfil?.nombre ?? ''} />
      )}
      {actual === 'mis' && <MisPartidos perfilId={usuarioId} />}
      {actual === 'admin' && <Admin perfilId={usuarioId} />}
    </main>
  </div>
)
}

export default App