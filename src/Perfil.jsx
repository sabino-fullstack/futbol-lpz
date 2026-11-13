import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  BadgeCheck, Check, ChevronLeft, CircleHelp, FileText, LogOut, Phone, Settings, Sparkles, Trash2,
} from 'lucide-react'
import { supabase } from './supabaseClient'
import { salir } from './auth'
import Cargando from './Cargando'
import Rueda from './Rueda'
import PerfilForm from './PerfilForm'
import { nombreCompleto } from './formato'
import { useVolver } from './navegacion'

export default function Perfil({ perfil }) {
  const volver = useVolver('/partidos')
  const [datos, setDatos] = useState(undefined) // undefined = cargando, null = sin datos
  const [zonas, setZonas] = useState([])
  const [apodo, setApodo] = useState(perfil?.apodo ?? '')
  const [msgApodo, setMsgApodo] = useState(null)
  const [guardandoApodo, setGuardandoApodo] = useState(false)
  const [error, setError] = useState(null)
  const [version, setVersion] = useState(0)

  async function cargar() {
    const [d, z] = await Promise.all([
      supabase.from('perfiles_datos').select('*').maybeSingle(),
      supabase.from('zonas').select('id, nombre, orden, activa'),
    ])
    if (d.error || z.error) return setError((d.error || z.error).message)
    setDatos(d.data ?? null)
    setZonas(z.data)
  }

  useEffect(() => { cargar() }, [])

  async function guardarApodo() {
    setMsgApodo(null)
    setGuardandoApodo(true)
    const v = apodo.trim()
    const { error } = await supabase
      .from('perfiles').update({ apodo: v === '' ? null : v }).eq('id', perfil.id)
    setGuardandoApodo(false)
    setMsgApodo(error ? { ok: false, texto: 'No se pudo guardar el apodo.' } : { ok: true, texto: 'Apodo guardado.' })
  }

  async function borrar() {
    if (!window.confirm(
      '¿Borrar tu zona, fecha de nacimiento, posición y respuesta? No te los volveremos a pedir por 30 días.'
    )) return
    setError(null)
    const { error } = await supabase.rpc('borrar_mis_datos_perfil')
    if (error) return setError(error.message)
    setVersion((v) => v + 1)
    cargar()
  }

  const iniciales = [perfil?.nombre, perfil?.apellido]
    .filter(Boolean).map((t) => t[0]).join('').toUpperCase().slice(0, 2)
  const confiable = perfil?.nivel === 'confiable'

  return (
    <div className="space-y-4">
      <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>

      <section className="tarjeta flex items-center gap-3">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-verde/15 font-display text-3xl font-bold text-verde">
          {iniciales || '?'}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate text-2xl">
            {nombreCompleto({ nombre: perfil?.nombre, apellido: perfil?.apellido })}
          </h2>
          <p className="flex items-center gap-1.5 text-suave">
            <Phone size={14} className="shrink-0" /> {perfil?.whatsapp}
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
              confiable ? 'border-verde/40 bg-verde/10 text-verde' : 'border-borde bg-borde/40 text-suave'
            }`}
          >
            {confiable ? <BadgeCheck size={13} /> : <Sparkles size={13} />}
            {confiable ? 'Cuenta confiable' : 'Cuenta nueva'}
          </span>
        </div>
      </section>

      {error && <p className="aviso aviso-error">{error}</p>}

      <div className="grid grid-cols-3 gap-2">
        <Link to="/configuracion" className="btn h-auto flex-col gap-1 py-3 text-xs">
          <Settings size={24} className="text-verde" /> Configuración
        </Link>
        <Link to="/ayuda" className="btn h-auto flex-col gap-1 py-3 text-xs">
          <CircleHelp size={24} className="text-verde" /> Cómo funciona
        </Link>
        <Link to="/reglas" className="btn h-auto flex-col gap-1 py-3 text-xs">
          <FileText size={24} className="text-verde" /> Reglas
        </Link>
      </div>

      <section className="tarjeta space-y-2.5">
        <h3>Apodo</h3>
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1"
            maxLength={30}
            placeholder="Cómo te dicen en el grupo (opcional)"
            value={apodo}
            onChange={(e) => setApodo(e.target.value)}
          />
          <button onClick={guardarApodo} disabled={guardandoApodo}>
            {guardandoApodo ? <Rueda size={16} /> : 'Guardar'}
          </button>
        </div>
        {msgApodo && (
          <p className={`flex items-center gap-1.5 text-sm ${msgApodo.ok ? 'text-verde' : 'text-rojo'}`}>
            {msgApodo.ok && <Check size={15} className="pop" />} {msgApodo.texto}
          </p>
        )}
        <p className="text-xs text-suave">
          Los otros jugadores ven tu apodo en las listas. Si no tienes, ven tu nombre y la inicial de tu apellido.
          Para cambiar tu nombre o tu número, escríbele al organizador.
        </p>
      </section>

      <section className="tarjeta space-y-3">
        <h3>Sobre ti (opcional)</h3>
        {datos === undefined && !error && <Cargando />}
        {datos !== undefined && (
          <PerfilForm key={version} inicial={datos} zonas={zonas} onGuardado={cargar} />
        )}
        {datos?.completado_en && (
          <button onClick={borrar} className="btn-peligro">
            <Trash2 size={16} /> Borrar mis respuestas
          </button>
        )}
      </section>

      <button onClick={salir} className="btn btn-peligro w-full">
        <LogOut size={18} /> Cerrar sesión
      </button>
    </div>
  )
}