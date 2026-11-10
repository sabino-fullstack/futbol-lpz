import { useState } from 'react'
import { Link } from 'react-router'
import { CircleHelp, X } from 'lucide-react'

export const ayudaVista = () => {
  try { return localStorage.getItem('ayuda_vista') === '1' } catch { return false }
}

export default function AyudaInicial({ perfil }) {
  const [oculto, setOculto] = useState(ayudaVista)
  if (oculto || perfil?.nivel !== 'nuevo') return null

  function cerrar() {
    try { localStorage.setItem('ayuda_vista', '1') } catch { /* sin almacenamiento */ }
    setOculto(true)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-verde/50 bg-verde/10 p-2.5 text-sm">
      <CircleHelp size={22} className="shrink-0 text-verde" />
      <p className="min-w-0 flex-1 font-semibold">¿Primera vez? Mira cómo reservar en 1 minuto</p>
      <Link to="/ayuda" className="btn btn-activo min-h-9 shrink-0 px-3">Ver</Link>
      <button aria-label="Cerrar" className="btn btn-icono shrink-0" onClick={cerrar}>
        <X size={16} />
      </button>
    </div>
  )
}