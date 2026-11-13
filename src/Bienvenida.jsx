import { useEffect, useState } from 'react'
import { ArrowRight, Check, Users } from 'lucide-react'
import { supabase } from './supabaseClient'
import PerfilForm from './PerfilForm'
import QrGrupo from './QrGrupo'
import Cargando from './Cargando'
import { useGrupo } from './useGrupo'

function Opcion({ activo, Icono, texto, onClick }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activo}
      onClick={onClick}
      className={`relative flex h-auto min-h-[4.5rem] flex-col items-center justify-center gap-1 px-2 py-2.5 text-center ${
        activo ? 'border-verde bg-verde/10 text-verde' : ''
      }`}
    >
      <Icono size={24} />
      <span className="font-semibold leading-tight">{texto}</span>
      {activo && <Check size={14} className="pop absolute right-1.5 top-1.5" />}
    </button>
  )
}

export default function Bienvenida({ perfil, onListo }) {
  const { enlace, listo } = useGrupo()
  const [paso, setPaso] = useState(1)
  const [enGrupo, setEnGrupo] = useState(null)
  const [zonas, setZonas] = useState([])

  useEffect(() => {
    supabase.from('zonas').select('id, nombre, orden, activa').then(({ data }) => setZonas(data ?? []))
  }, [])

  function terminar() {
    try { localStorage.setItem(`bienvenida:${perfil.id}`, 'hecho') } catch { /* sin almacenamiento */ }
    onListo()
  }

  async function omitir() {
    await supabase.rpc('recordar_perfil_despues', { p_dias: 7 })
    terminar()
  }

  if (!listo) return <Cargando pantalla />

  const total = enlace ? 2 : 1
  const actual = enlace ? paso : 1
  const fase = enlace && paso === 1 ? 'grupo' : 'datos'

  return (
    <div className="mx-auto min-h-screen max-w-sm space-y-5 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src="/icon-192.png" alt="" className="h-20 w-20 rounded-full" />
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide">
          ¡Bienvenido, <span className="text-verde">{perfil?.nombre}</span>!
        </h1>
        <p className="text-suave">Tu cuenta ya está lista. Solo faltan {total === 2 ? 'dos' : 'un'} detalle{total === 2 ? 's' : ''}.</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex gap-2">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i < actual ? 'bg-verde' : 'bg-borde'}`} />
          ))}
        </div>
        <p className="text-sm text-suave">Paso {actual} de {total}</p>
      </div>

      {fase === 'grupo' && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2>¿Ya estás en el grupo de WhatsApp?</h2>
            <p className="text-suave">Ahí se avisan los partidos de la semana y se resuelven las dudas.</p>
          </div>

          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="¿Ya estás en el grupo?">
            <Opcion activo={enGrupo === true} Icono={Check} texto="Sí, ya estoy" onClick={() => setEnGrupo(true)} />
            <Opcion activo={enGrupo === false} Icono={Users} texto="Todavía no" onClick={() => setEnGrupo(false)} />
          </div>

          {enGrupo === false && (
            <div className="tarjeta">
              <QrGrupo enlace={enlace} />
            </div>
          )}

          <button
            onClick={() => setPaso(2)}
            disabled={enGrupo === null}
            className="btn btn-primario"
          >
            Continuar <ArrowRight size={20} />
          </button>
        </section>
      )}

      {fase === 'datos' && (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2>Sobre ti</h2>
            <p className="text-suave">
              Es opcional: nos ayuda a decidir en qué zonas abrir más partidos. Puedes omitirlo y
              completarlo después desde "Mi perfil".
            </p>
          </div>

          <div className="tarjeta">
            <PerfilForm inicial={null} zonas={zonas} onGuardado={() => setTimeout(terminar, 800)} />
          </div>

          <button onClick={omitir} className="w-full">Omitir por ahora</button>
        </section>
      )}
    </div>
  )
}