import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

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
  <div className="rounded-xl border border-borde bg-tarjeta p-2.5 text-sm">
    <div className="flex items-center gap-2">
      <Download size={18} className="shrink-0 text-verde" />
      <p className="flex-1 font-semibold">Instala la app en tu celular</p>
      {evento ? (
        <button className="btn btn-activo" onClick={instalar}>Instalar</button>
      ) : (
        <button onClick={() => setVerPasos(!verPasos)}>{verPasos ? 'Ocultar' : 'Cómo'}</button>
      )}
      <button aria-label="Cerrar" onClick={cerrar} className="btn btn-icono">
        <X size={16} />
      </button>
    </div>
    {!evento && verPasos && (
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>
          Si abriste esta página desde WhatsApp, ábrela primero en <strong>Safari</strong>{' '}
          (con el menú ••• o el ícono de brújula).
        </li>
        <li>Toca el botón <strong>Compartir</strong> (el cuadrado con la flecha).</li>
        <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
      </ol>
    )}
  </div>
)
}