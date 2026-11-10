import { useEffect, useState } from 'react'
import { BellOff, BellRing, Check, Info, Send, Share, Smartphone } from 'lucide-react'
import Rueda from './Rueda'
import { activarPush, desactivarPush, estadoPush, probarPush } from './push'

const TONOS = {
  verde: 'bg-verde/15 text-verde',
  amarillo: 'bg-amarillo/15 text-amarillo-texto',
  gris: 'bg-borde text-suave',
}
const BORDES = { verde: 'border-l-verde', amarillo: 'border-l-amarillo', gris: 'border-l-borde' }

function Caja({ tono = 'gris', Icono, titulo, children }) {
  return (
    <section className={`tarjeta space-y-3 border-l-4 ${BORDES[tono]}`}>
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${TONOS[tono]}`}>
          <Icono size={22} />
        </span>
        <h3 className="min-w-0 flex-1 text-xl leading-tight">{titulo}</h3>
      </div>
      {children}
    </section>
  )
}

function Paso({ n, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-verde text-sm font-bold text-sobre-verde">
        {n}
      </span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  )
}

export default function ActivarAvisos({ userId }) {
  const [estado, setEstado] = useState(null) // null = revisando
  const [trabajando, setTrabajando] = useState(null)
  const [msg, setMsg] = useState(null)

  async function revisar() {
    setEstado(await estadoPush(userId))
  }
  useEffect(() => { revisar() }, [userId])

  async function activar() {
    setMsg(null)
    setTrabajando('activar')
    try {
      await activarPush(userId)
      setMsg({ ok: true, texto: '¡Listo! Ya recibirás los avisos en este celular.' })
    } catch (e) {
      if (e.message !== 'bloqueado') setMsg({ ok: false, texto: e.message })
    }
    setTrabajando(null)
    await revisar()
  }

  async function probar() {
    setMsg(null)
    setTrabajando('probar')
    try {
      await probarPush()
      setMsg({
        ok: true,
        texto: 'Enviado. En unos segundos debe llegarte un aviso. Si no llega, revisa que el celular no esté en "No molestar".',
      })
    } catch (e) {
      setMsg({ ok: false, texto: e.message })
    }
    setTrabajando(null)
  }

  async function desactivar() {
    setMsg(null)
    setTrabajando('desactivar')
    await desactivarPush(userId)
    setTrabajando(null)
    await revisar()
  }

  if (estado === 'sin-clave') return null
  if (estado === null) {
    return <p className="flex items-center gap-2 text-sm text-suave"><Rueda size={16} /> Revisando los avisos...</p>
  }

  if (estado === 'ios-instalar') {
    return (
      <Caja tono="amarillo" Icono={Smartphone} titulo="Para recibir avisos en iPhone, instala la app">
        <p className="text-sm text-suave">
          Apple solo permite avisos a las apps que están en la pantalla de inicio. Son 4 pasos:
        </p>
        <ol className="space-y-2">
          <Paso n={1}>Abre esta página en <strong>Safari</strong> (no en el navegador de WhatsApp).</Paso>
          <Paso n={2}>
            Toca el botón <strong>Compartir</strong> <Share size={14} className="inline align-[-2px]" /> (el cuadrado con la flecha).
          </Paso>
          <Paso n={3}>Elige <strong>Añadir a pantalla de inicio</strong>.</Paso>
          <Paso n={4}>Abre la app desde su <strong>ícono</strong> y vuelve a esta pantalla para activar los avisos.</Paso>
        </ol>
      </Caja>
    )
  }

  if (estado === 'no-soportado') {
    return (
      <Caja Icono={Info} titulo="Avisos al celular no disponibles">
        <p className="text-sm text-suave">
          Este navegador no permite recibir avisos con la app cerrada. No te preocupes: los verás en la
          campana cuando abras la app.
        </p>
      </Caja>
    )
  }

  if (estado === 'bloqueado') {
    return (
      <Caja tono="amarillo" Icono={BellOff} titulo="Los avisos están bloqueados">
        <p className="text-sm text-suave">
          Antes tocaste "No permitir". Para activarlos otra vez hay que cambiarlo en el celular:
        </p>
        <ol className="space-y-2">
          <Paso n={1}>
            En el navegador: toca el <strong>candado</strong> (o el ícono ⓘ) junto a la dirección, entra a
            <strong> Permisos</strong> y pon <strong>Notificaciones: Permitir</strong>.
          </Paso>
          <Paso n={2}>
            En la app instalada: abre los <strong>Ajustes del celular</strong>, busca <strong>Fútbol LPZ</strong> y activa
            las <strong>Notificaciones</strong>.
          </Paso>
        </ol>
        <button onClick={revisar}><Check size={16} /> Ya lo permití, revisar</button>
      </Caja>
    )
  }

  if (estado === 'activo') {
    return (
      <Caja tono="verde" Icono={BellRing} titulo="Avisos activados en este celular">
        <p className="text-sm text-suave">
          Te avisamos aunque tengas la app cerrada cuando se libere un cupo que esperas.
        </p>
        {msg && (
          <p className={`aviso text-sm ${msg.ok ? 'aviso-ok' : 'aviso-error'}`}>{msg.texto}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={trabajando !== null}
            onClick={probar}
            className="flex h-auto flex-col gap-1 py-3 text-sm"
          >
            {trabajando === 'probar' ? <Rueda size={20} /> : <Send size={20} className="text-verde" />}
            Enviar aviso de prueba
          </button>
          <button
            disabled={trabajando !== null}
            onClick={desactivar}
            className="btn-peligro flex h-auto flex-col gap-1 py-3 text-sm"
          >
            {trabajando === 'desactivar' ? <Rueda size={20} /> : <BellOff size={20} />}
            Desactivar
          </button>
        </div>
      </Caja>
    )
  }

  // 'inactivo'
  return (
    <Caja tono="verde" Icono={BellRing} titulo="Recibe los avisos en tu celular">
      <p className="text-sm text-suave">
        Cuando se libere un cupo que esperas, te avisamos aunque tengas la app cerrada. Es gratis y lo
        puedes desactivar cuando quieras.
      </p>
      {msg && !msg.ok && <p className="aviso aviso-error text-sm">{msg.texto}</p>}
      <button onClick={activar} disabled={trabajando !== null} className="btn btn-primario">
        {trabajando === 'activar' ? <><Rueda /> Activando...</> : <><BellRing size={20} /> Activar avisos</>}
      </button>
    </Caja>
  )
}