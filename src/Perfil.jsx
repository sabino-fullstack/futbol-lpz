import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import PerfilForm from './PerfilForm'
import { nombreCompleto } from './formato'
import { useVolver } from './navegacion'

export default function Perfil({ perfil }) {
  const volver = useVolver('/partidos')
  const [datos, setDatos] = useState(undefined) // undefined = cargando, null = sin datos
  const [zonas, setZonas] = useState([])
  const [apodo, setApodo] = useState(perfil?.apodo ?? '')
  const [msgApodo, setMsgApodo] = useState(null)
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
    const v = apodo.trim()
    const { error } = await supabase
      .from('perfiles').update({ apodo: v === '' ? null : v }).eq('id', perfil.id)
    setMsgApodo(error ? 'No se pudo guardar el apodo.' : 'Apodo guardado.')
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

  return (
    <div className="space-y-4">
      <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>
      <h2>Mi perfil</h2>
      {error && <p className="aviso aviso-error">{error}</p>}

      <section className="tarjeta space-y-3">
        <h3>Tu cuenta</h3>
        <p><span className="text-suave">Nombre: </span><strong>{nombreCompleto({ nombre: perfil?.nombre, apellido: perfil?.apellido })}</strong></p>
        <p><span className="text-suave">WhatsApp: </span><strong>{perfil?.whatsapp}</strong></p>
        <div className="space-y-1.5">
          <p className="font-semibold">Apodo (opcional)</p>
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1"
              maxLength={30}
              placeholder="Cómo te dicen en el grupo"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
            />
            <button onClick={guardarApodo}>Guardar</button>
          </div>
          {msgApodo && <p className="text-sm text-suave">{msgApodo}</p>}
          <p className="text-xs text-suave">
            Los otros jugadores ven tu apodo en las listas. Si no tienes, ven tu nombre y la inicial de tu apellido.
          </p>
        </div>
        <p className="text-xs text-suave">
          Para cambiar tu nombre o tu número, escríbele al organizador.
        </p>
      </section>

      <section className="tarjeta space-y-3">
        <h3>Sobre ti (opcional)</h3>
        {datos === undefined && !error && <Cargando />}
        {datos !== undefined && (
          <PerfilForm
            key={`${version}-${datos?.updated_at ?? 'nuevo'}`}
            inicial={datos}
            zonas={zonas}
            onGuardado={cargar}
          />
        )}
        {datos?.completado_en && (
          <button onClick={borrar}><Trash2 size={16} /> Borrar mis respuestas</button>
        )}
      </section>

      <p className="text-center text-sm"><Link to="/reglas">Reglas y condiciones</Link></p>
    </div>
  )
}