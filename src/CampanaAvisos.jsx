import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Bell } from 'lucide-react'
import { supabase } from './supabaseClient'
import { useAutoRefrescar } from './useAutoRefrescar'

export default function CampanaAvisos() {
  const [n, setN] = useState(0)

  async function cargar() {
    const { count, error } = await supabase
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('leida', false)
    if (!error) setN(count ?? 0)
  }

  useEffect(() => {
    cargar()
    window.addEventListener('avisos-cambio', cargar)
    return () => window.removeEventListener('avisos-cambio', cargar)
  }, [])
  useAutoRefrescar(cargar, 60000)

  return (
    <Link
      to="/avisos"
      aria-label={n > 0 ? `Avisos: ${n} sin leer` : 'Avisos'}
      className="btn btn-icono relative shrink-0"
    >
      <Bell size={18} />
      {n > 0 && (
        <span className="pop absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rojo px-1 text-[0.65rem] font-bold leading-5 text-white">
          {n > 9 ? '9+' : n}
        </span>
      )}
    </Link>
  )
}