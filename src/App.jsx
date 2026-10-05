import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router'
import { supabase } from './supabaseClient'
import { salir } from './auth'
import Partidos from './Partidos'
import ReservarForm from './ReservarForm'
import PantallaPago from './PantallaPago'
import MisReservas from './MisReservas'
import MisPartidos from './MisPartidos'
import PanelRuta from './PanelRuta'
import Admin from './Admin'
import PantallaAcceso from './PantallaAcceso'
import CuentaSuspendida from './CuentaSuspendida'
import BotonTema from './BotonTema'
import ErrorBoundary from './ErrorBoundary'
import DetallePartido from './DetallePartido'

function ScrollArriba() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  const { pathname } = useLocation()
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [perfil, setPerfil] = useState(null)
  const [esEncargado, setEsEncargado] = useState(false)
  const [verificado, setVerificado] = useState(false) // ya sabemos quién es y qué puede ver

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
      setVerificado(false)
      return
    }
    let vigente = true
    setVerificado(false)
    Promise.all([
      supabase.from('perfiles').select('*').eq('id', usuarioId).single(),
      supabase.from('encargados').select('id').eq('perfil_id', usuarioId).limit(1),
    ]).then(([p, e]) => {
      if (!vigente) return
      setPerfil(p.data)
      setEsEncargado((e.data ?? []).length > 0)
      setVerificado(true)
    })
    return () => { vigente = false }
  }, [usuarioId])

  if (cargando) return <p className="p-4 text-suave">Cargando...</p>
  if (!sesion) return <PantallaAcceso />
  // Esperamos a saber el rol antes de decidir qué direcciones existen
  if (!verificado) return <p className="p-4 text-suave">Cargando...</p>
  if (perfil && perfil.activo === false) return <CuentaSuspendida />

  const esSuperadmin = perfil?.rol === 'superadmin'
  const tabs = [
    ['/partidos', 'Partidos'],
    ['/reservas', 'Mis reservas'],
    esEncargado && ['/a-cargo', 'A mi cargo'],
    esSuperadmin && ['/admin', 'Administración'],
  ].filter(Boolean)

  return (
    <div className="min-h-screen">
      <ScrollArriba />
      <header className="sticky top-0 z-10 border-b border-borde bg-fondo/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 p-3">
          <Link to="/partidos">
            <img src="/logo.png" alt="Fútbol LPZ" className="h-10 w-10 rounded-full" />
          </Link>
          <div className="flex-1 leading-tight">
            <p className="font-bold">Fútbol LPZ</p>
            <p className="text-xs text-suave">Hola, {perfil?.nombre ?? '...'}</p>
          </div>
          <BotonTema />
          <button onClick={salir}>Salir</button>
        </div>
        <nav className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-3 pb-3">
          {tabs.map(([ruta, texto]) => (
            <NavLink
              key={ruta}
              to={ruta}
              className={({ isActive }) => `btn whitespace-nowrap ${isActive ? 'btn-activo' : ''}`}
            >
              {texto}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-xl p-4">
        <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<Navigate to="/partidos" replace />} />
          <Route path="/partidos" element={<Partidos />} />
          <Route path="/partidos/:partidoId" element={<DetallePartido />} />
          <Route path="/partidos/:partidoId/reservar" element={<ReservarForm perfil={perfil} />} />
          <Route path="/pago/:grupoId" element={<PantallaPago nombreJugador={perfil?.nombre ?? ''} />} />
          <Route path="/reservas" element={<MisReservas perfilId={usuarioId} />} />

          {esEncargado && <Route path="/a-cargo" element={<MisPartidos perfilId={usuarioId} />} />}
          {esEncargado && (
            <Route path="/a-cargo/:partidoId" element={<PanelRuta perfilId={usuarioId} volverA="/a-cargo" />} />
          )}

          {esSuperadmin && <Route path="/admin" element={<Navigate to="/admin/partidos" replace />} />}
          {esSuperadmin && (
            <Route path="/admin/partidos/:partidoId" element={<PanelRuta perfilId={usuarioId} volverA="/admin/partidos" />} />
          )}
          {esSuperadmin && <Route path="/admin/:seccion" element={<Admin />} />}

          <Route path="*" element={<Navigate to="/partidos" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}

export default App