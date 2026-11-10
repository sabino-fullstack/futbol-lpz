import { useState } from 'react'
import { Check, Copy, Minus, RefreshCw, Search, X } from 'lucide-react'
import Rueda from './Rueda'
import { actualizarServicio, diagnosticar } from './push'

function revisiones(r) {
  const l = []
  l.push(
    r.clave.ok
      ? ['ok', 'Clave de avisos de la app', 'Correcta.']
      : ['mal', 'Clave de avisos de la app',
         `Falta o está mal copiada: mide ${r.clave.largo} caracteres y debe medir 87 y empezar con B. Corrige VITE_VAPID_PUBLIC_KEY en Vercel y haz Redeploy.`]
  )
  if (!r.soporte) {
    l.push(['mal', 'Este navegador', 'No permite avisos. En iPhone hay que instalar la app en la pantalla de inicio.'])
  }
  l.push(
    r.permiso === 'granted' ? ['ok', 'Permiso del navegador', 'Permitido.']
    : r.permiso === 'denied' ? ['mal', 'Permiso del navegador', 'Bloqueado: actívalo en los ajustes del sitio o de la app.']
    : ['info', 'Permiso del navegador', 'Todavía no lo diste: toca "Activar avisos".']
  )
  if (r.soporte) {
    if (!r.sw) {
      l.push(['mal', 'Servicio de la app', 'No hay un servicio activo. Abre la versión publicada (no localhost), recarga y prueba otra vez.'])
    } else {
      l.push(
        r.swResponde
          ? ['ok', 'Servicio de la app', 'Es la versión nueva, preparada para mostrar avisos.']
          : ['mal', 'Servicio de la app', 'Es una versión anterior y no puede mostrar avisos. Toca "Actualizar la app ahora".']
      )
      if (r.sw.esperando) {
        l.push(['mal', 'Actualización pendiente', 'Hay una versión nueva esperando para activarse.'])
      }
    }
    if (r.suscripcion) {
      l.push(['ok', 'Este celular en el servicio de notificaciones', `Conectado (${r.suscripcion.servicio}).`])
      if (!r.suscripcion.claveCorrecta) {
        l.push(['mal', 'Clave de la suscripción', 'Se creó con otra clave. Toca "Desactivar" y vuelve a "Activar avisos".'])
      }
    } else {
      l.push(['info', 'Este celular en el servicio de notificaciones', 'Todavía no está suscrito: toca "Activar avisos".'])
    }
  }
  l.push(
    r.servidor === null ? ['info', 'Servidor', 'No se pudo consultar.']
    : r.servidor > 0 ? ['ok', 'Servidor', `Tienes ${r.servidor} celular(es) registrado(s).`]
    : ['mal', 'Servidor', 'No tiene ningún celular registrado para tu cuenta: toca "Activar avisos".']
  )
  return l
}

const ICONO = {
  ok: [Check, 'bg-verde/15 text-verde'],
  mal: [X, 'bg-rojo/15 text-rojo'],
  info: [Minus, 'bg-borde text-suave'],
}

export default function DiagnosticoPush() {
  const [res, setRes] = useState(null)
  const [revisando, setRevisando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function revisar() {
    setRevisando(true)
    setCopiado(false)
    setRes(await diagnosticar())
    setRevisando(false)
  }

  const lista = res ? revisiones(res) : []
  const hayProblema = lista.some(([e]) => e === 'mal')
  const necesitaActualizar = res && res.sw && (!res.swResponde || res.sw.esperando)

  async function copiar() {
    const texto = lista.map(([e, t, d]) => `[${e}] ${t}: ${d}`).join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch { /* se puede seleccionar a mano */ }
  }

  return (
    <details className="tarjeta">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        <Search size={18} className="shrink-0 text-verde" />
        <span className="flex-1">¿No te llegan los avisos?</span>
      </summary>
      <div className="space-y-3 pt-3">
        <p className="text-sm text-suave">
          Revisa cada paso por qué un aviso puede no llegar a este celular.
        </p>
        <button onClick={revisar} disabled={revisando}>
          {revisando ? <><Rueda size={16} /> Revisando...</> : <><Search size={16} /> Revisar ahora</>}
        </button>

        {res && (
          <>
            <ul className="space-y-2.5">
              {lista.map(([estado, titulo, detalle]) => {
                const [Icono, tono] = ICONO[estado]
                return (
                  <li key={titulo + detalle} className="flex items-start gap-2.5">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tono}`}>
                      <Icono size={15} />
                    </span>
                    <span className="min-w-0 text-sm">
                      <strong className="block">{titulo}</strong>
                      <span className="text-suave">{detalle}</span>
                    </span>
                  </li>
                )
              })}
            </ul>

            {!hayProblema && (
              <p className="aviso aviso-ok text-sm">
                Todo se ve bien en este celular. Si aun así no llegan, revisa los ajustes de notificaciones
                del teléfono (que no estén silenciadas) y el ahorro de batería.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {necesitaActualizar && (
                <button className="btn btn-activo" onClick={actualizarServicio}>
                  <RefreshCw size={16} /> Actualizar la app ahora
                </button>
              )}
              <button onClick={copiar}>
                {copiado ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar resultado</>}
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  )
}