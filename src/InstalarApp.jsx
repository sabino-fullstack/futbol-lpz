import { useEffect, useState } from 'react'

const CLAVE = 'instalar_oculto_hasta'

const yaInstalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

function ocultoAun() {
  try { return Number(localStorage.getItem(CLAVE) ?? 0) > Date.now() } catch { return false }
}
function ocultarPor(dias) {
  try { localStorage.setItem(CLAVE, String(Date.now() + dias * 86400000)) } catch { /* sin almacenamiento */ }
}

export default function InstalarApp() {
  const [evento, setEvento] = useState(null)
  const [oculto, setOculto] = useState(() => yaInstalada() || ocultoAun())
  const [verPasos, setVerPasos] = useState(false)

  useEffect(() => {
    const alOfrecer = (e) => { e.preventDefault(); setEvento(e) }
    const alInstalar = () => setOculto(true)
    window.addEventListener('beforeinstallprompt', alOfrecer)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alOfrecer)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  if (oculto) return null
  const ios = esIOS()
  if (!evento && !ios) return null // sin soporte de instalación: no mostramos nada

  async function instalar() {
    if (!evento) return
    evento.prompt()
    const { outcome } = await evento.userChoice
    if (outcome !== 'accepted') ocultarPor(14)
    setEvento(null)
    setOculto(true)
  }
  function cerrar() { ocultarPor(14); setOculto(true) }

  return (
    <div className="tarjeta space-y-2">
      <p className="font-semibold">📲 Instala la app en tu celular</p>
      <p className="text-sm text-suave">
        Ábrela desde su ícono, como cualquier app, sin buscar el enlace en WhatsApp.
      </p>
      {evento ? (
        <div className="flex gap-2">
          <button className="btn btn-activo" onClick={instalar}>Instalar</button>
          <button onClick={cerrar}>Ahora no</button>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setVerPasos(!verPasos)}>
            {verPasos ? 'Ocultar pasos' : 'Ver cómo instalarla'}
          </button>
          {verPasos && (
            <ol className="list-decimal space-y-1 pl-6 text-sm">
              <li>
                Si abriste esta página desde WhatsApp, ábrela primero en <strong>Safari</strong>{' '}
                (con el menú ••• o el ícono de brújula).
              </li>
              <li>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha).</li>
              <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
            </ol>
          )}
          <button onClick={cerrar}>No mostrar por ahora</button>
        </div>
      )}
    </div>
  )
}