import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Bell, BellRing, CalendarClock, CalendarDays, CalendarPlus, CalendarX, ChevronLeft, ChevronRight,
  Megaphone, Settings,
} from 'lucide-react'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import { pushPendiente } from './push'
import { haceCuanto } from './formato'
import { useVolver } from './navegacion'

const ICONO = {
  cupo_liberado: Bell,
  partido_cancelado: CalendarX,
  partido_cambiado: CalendarClock,
  partidos_nuevos: CalendarPlus,
  aviso: Megaphone,
}

export default function Avisos() {
  const volver = useVolver('/partidos')
  const [lista, setLista] = useState(null)
  const [nuevos, setNuevos] = useState(new Set())
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data, error } = await supabase
        .from('notificaciones')
        .select('id, tipo, titulo, cuerpo, url, leida, created_at')
        .order('created_at', { ascending: false })
        .limit(50)
      if (!vivo) return
      if (error) return setError(error.message)
      setNuevos(new Set(data.filter((x) => !x.leida).map((x) => x.id)))
      setLista(data)
      if (data.some((x) => !x.leida)) {
        await supabase.rpc('marcar_avisos_leidos')
        window.dispatchEvent(new Event('avisos-cambio'))
      }
    })()
    return () => { vivo = false }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>
        <Link to="/configuracion" aria-label="Configuración de avisos" className="btn btn-icono">
          <Settings size={18} />
        </Link>
      </div>

      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-verde text-sobre-verde">
          <BellRing size={26} />
        </span>
        <h2>Avisos</h2>
      </header>

      {pushPendiente() && (
        <Link
          to="/configuracion"
          className="flex items-center gap-2 rounded-xl border border-verde/50 bg-verde/10 p-2.5 text-sm font-semibold text-verde no-underline"
        >
          <BellRing size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">Activa las notificaciones para recibirlos con la app cerrada</span>
          <ChevronRight size={16} className="shrink-0" />
        </Link>
      )}

      {error && <p className="aviso aviso-error">{error}</p>}
      {!lista && !error && <Cargando />}

      {lista && lista.length === 0 && (
        <div className="tarjeta space-y-3 py-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-borde text-suave">
            <Bell size={28} />
          </span>
          <p className="font-semibold">Todavía no tienes avisos</p>
          <p className="text-sm text-suave">
            Aquí verás los cupos que se liberen y los cambios de tus partidos.
          </p>
          <Link to="/partidos" className="btn btn-activo">
            <CalendarDays size={18} /> Ver partidos
          </Link>
        </div>
      )}

      {lista?.map((a) => {
        const nuevo = nuevos.has(a.id)
        const Icono = ICONO[a.tipo] ?? Bell
        const contenido = (
          <>
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${
                nuevo ? 'bg-verde text-sobre-verde' : 'bg-borde text-suave'
              }`}
            >
              <Icono size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-bold">{a.titulo}</span>
                {nuevo && (
                  <span className="shrink-0 rounded-full bg-verde px-2 py-0.5 text-[0.65rem] font-bold uppercase text-sobre-verde">
                    Nuevo
                  </span>
                )}
              </span>
              <span className="block text-sm text-suave">{a.cuerpo}</span>
              <span className="block text-xs text-suave">{haceCuanto(a.created_at)}</span>
            </span>
            {a.url && <ChevronRight size={18} className="shrink-0 text-suave" />}
          </>
        )
        const clase = `tarjeta flex items-start gap-3 border-l-4 text-texto no-underline ${
          nuevo ? 'border-l-verde' : 'border-l-borde'
        }`
        return a.url && a.url.startsWith('/') ? (
          <Link key={a.id} to={a.url} className={clase}>{contenido}</Link>
        ) : (
          <div key={a.id} className={clase}>{contenido}</div>
        )
      })}
    </div>
  )
}