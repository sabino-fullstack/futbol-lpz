import { useEffect, useState } from 'react'
import { Bell, CalendarClock, CalendarPlus, Check, ChevronLeft, Megaphone, Settings } from 'lucide-react'
import { supabase } from './supabaseClient'
import ActivarAvisos from './ActivarAvisos'
import DiagnosticoPush from './DiagnosticoPush'
import Interruptor from './Interruptor'
import Cargando from './Cargando'
import { useVolver } from './navegacion'

const OPCIONES = [
  ['cambios', 'Cambios y cancelaciones', 'Si cambia la hora o se cancela un partido en el que tienes cupo.', CalendarClock],
  ['nuevos_partidos', 'Partidos nuevos', 'Cuando se habilitan los partidos de la semana.', CalendarPlus],
  ['organizador', 'Mensajes del organizador', 'Avisos importantes sobre los partidos o el grupo.', Megaphone],
]

function Fila({ Icono, titulo, texto, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-verde/15 text-verde">
        <Icono size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight">{titulo}</span>
        <span className="block text-sm text-suave">{texto}</span>
      </span>
      {children}
    </div>
  )
}

export default function Configuracion({ perfil }) {
  const volver = useVolver('/perfil')
  const [prefs, setPrefs] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('preferencias_avisos')
      .select('cambios, nuevos_partidos, organizador').maybeSingle()
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setPrefs(data ?? { cambios: true, nuevos_partidos: true, organizador: true })
      })
  }, [])

  async function cambiar(clave, valor) {
    setError(null)
    const antes = prefs
    const nuevas = { ...prefs, [clave]: valor }
    setPrefs(nuevas)
    const { error } = await supabase.rpc('guardar_preferencias_avisos', {
      p_cambios: nuevas.cambios,
      p_nuevos: nuevas.nuevos_partidos,
      p_organizador: nuevas.organizador,
    })
    if (error) {
      setPrefs(antes)
      setError(error.message)
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>

      <header className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-verde text-sobre-verde">
          <Settings size={26} />
        </span>
        <div>
          <h2>Configuración</h2>
          <p className="text-suave">Cómo quieres recibir los avisos.</p>
        </div>
      </header>

      {error && <p className="aviso aviso-error">{error}</p>}

      {perfil && <ActivarAvisos userId={perfil.id} />}

      <section className="tarjeta space-y-4">
        <h3>Qué avisos quiero recibir</h3>
        {!prefs && !error && <Cargando />}
        {prefs && (
          <>
            <Fila
              Icono={Bell}
              titulo="Cupos que se liberan"
              texto='Solo si tocas "Avísame" en un partido lleno.'
            >
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-verde">
                <Check size={14} /> Siempre
              </span>
            </Fila>
            {OPCIONES.map(([clave, titulo, texto, Icono]) => (
              <Fila key={clave} Icono={Icono} titulo={titulo} texto={texto}>
                <Interruptor activo={prefs[clave]} onCambio={(v) => cambiar(clave, v)} />
              </Fila>
            ))}
            <p className="text-xs text-suave">
              Si apagas un tipo de aviso, tampoco lo verás en la campana. Los avisos de tu lista de
              espera no se pueden apagar desde aquí: se quitan apagando el interruptor "Avísame" del partido.
            </p>
          </>
        )}
      </section>

      <DiagnosticoPush />
    </div>
  )
}