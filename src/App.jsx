import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router'
import { CalendarDays, ClipboardList, LogOut, Settings, Ticket } from 'lucide-react'
import { supabase } from './supabaseClient'
import { salir } from './auth'
import Partidos from './Partidos'
import DetallePartido from './DetallePartido'
import ReservarForm from './ReservarForm'
import PantallaPago from './PantallaPago'
import MisReservas from './MisReservas'
import MisPartidos from './MisPartidos'
import PanelRuta from './PanelRuta'
import Admin from './Admin'
import PantallaAcceso from './PantallaAcceso'
import CuentaSuspendida from './CuentaSuspendida'
import BotonTema from './BotonTema'
import AvisoConexion from './AvisoConexion'
import ActualizarApp from './ActualizarApp'
import ErrorBoundary from './ErrorBoundary'
import CintaAvisos from './CintaAvisos'
import Cargando from './Cargando'
import Reglas from './Reglas'
import CambiarClave from './CambiarClave'
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
  const [recarga, setRecarga] = useState(0)

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
  }, [usuarioId, recarga])

if (cargando) return <Cargando pantalla />
if (!sesion) {
  return pathname === '/reglas'
    ? <div className="mx-auto max-w-xl p-4"><Reglas /></div>
    : <PantallaAcceso />
}
if (!verificado) return <Cargando pantalla />
  if (perfil && perfil.activo === false) return <CuentaSuspendida />
  if (perfil?.cambiar_clave) {
  return <CambiarClave onListo={() => setRecarga((n) => n + 1)} />
}


  const esSuperadmin = perfil?.rol === 'superadmin'
  const tabs = [
    ['/partidos', 'Partidos', CalendarDays],
    ['/reservas', 'Mis reservas', Ticket],
    (esEncargado || esSuperadmin) && ['/a-cargo', 'A mi cargo', ClipboardList],
    esSuperadmin && ['/admin', 'Admin', Settings],
  ].filter(Boolean)

  // La cinta (y cualquier publicidad) no aparece en pago ni en los paneles
  const sinCinta = ['/pago', '/admin', '/a-cargo'].some((r) => pathname.startsWith(r))

  return (
    <div className="min-h-screen">
      <ScrollArriba />
      {!sinCinta && <CintaAvisos />}

      <header className="border-b border-borde bg-fondo">
        <div className="mx-auto flex max-w-xl items-center gap-2.5 px-3 py-2">
          <Link to="/partidos" className="flex flex-1 items-center gap-2.5 no-underline">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-full" />
            <span className="font-display text-xl font-extrabold uppercase leading-none tracking-wide text-texto">
              Fútbol <span className="text-verde">LPZ</span>
            </span>
          </Link>
          <span className="hidden text-sm text-suave min-[400px]:inline">
            Hola, {perfil?.nombre ?? ''}
          </span>
          <BotonTema />
          <button onClick={salir} aria-label="Cerrar sesión" className="btn btn-icono">
            <LogOut size={18} />
          </button>
        </div>
        <AvisoConexion />
      </header>

      <main className="mx-auto max-w-xl px-3 pb-28 pt-3">
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<Navigate to="/partidos" replace />} />
            <Route path="/partidos" element={<Partidos />} />
            <Route path="/partidos/:partidoId" element={<DetallePartido />} />
            <Route path="/partidos/:partidoId/reservar" element={<ReservarForm perfil={perfil} />} />
            <Route path="/pago/:grupoId" element={<PantallaPago nombreJugador={perfil?.nombre ?? ''} />} />
            <Route path="/reservas" element={<MisReservas perfilId={usuarioId} />} />
            <Route path="/reglas" element={<Reglas />} />

{(esEncargado || esSuperadmin) && (
  <Route path="/a-cargo" element={<MisPartidos perfilId={usuarioId} esSuperadmin={esSuperadmin} />} />
)}
{(esEncargado || esSuperadmin) && (
  <Route path="/a-cargo/:partidoId" element={<PanelRuta perfilId={usuarioId} volverA="/a-cargo" />} />
)}

{esSuperadmin && <Route path="/admin" element={<Navigate to="/admin/partidos" replace />} />}
{esSuperadmin && <Route path="/admin/:seccion" element={<Admin />} />}

            <Route path="*" element={<Navigate to="/partidos" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-tarjeta/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-xl pb-[env(safe-area-inset-bottom)]">
          {tabs.map(([ruta, texto, Icono]) => (
            <NavLink
              key={ruta}
              to={ruta}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold no-underline ${
                  isActive ? 'text-verde' : 'text-suave'
                }`
              }
            >
              <Icono size={22} />
              {texto}
            </NavLink>
          ))}
        </div>
      </nav>

      <ActualizarApp />
    </div>
  )
}

export default App