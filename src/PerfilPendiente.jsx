import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { User } from 'lucide-react'
import { supabase } from './supabaseClient'

export default function PerfilPendiente() {
  const [mostrar, setMostrar] = useState(false)

  useEffect(() => {
    supabase.from('perfiles_datos').select('completado_en, recordar_despues').maybeSingle()
      .then(({ data, error }) => {
        if (error) return
        const completo = !!data?.completado_en
        const pospuesto = data?.recordar_despues && new Date(data.recordar_despues).getTime() > Date.now()
        setMostrar(!completo && !pospuesto)
      })
  }, [])

  if (!mostrar) return null

  async function despues() {
    setMostrar(false)
    await supabase.rpc('recordar_perfil_despues', { p_dias: 7 })
  }

  return (
    <section className="tarjeta space-y-2.5">
      <p className="flex items-center gap-1.5 font-semibold">
        <User size={18} className="shrink-0 text-verde" /> Completa tu perfil en 30 segundos
      </p>
      <p className="text-sm text-suave">
        Nos ayuda a decidir en qué zonas abrir más partidos. Es opcional y los demás jugadores no lo ven.
      </p>
      <div className="flex gap-2">
        <Link to="/perfil" className="btn btn-activo">Completar</Link>
        <button onClick={despues}>Ahora no</button>
      </div>
    </section>
  )
}