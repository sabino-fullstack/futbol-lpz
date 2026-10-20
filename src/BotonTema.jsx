import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function BotonTema() {
  const [oscuro, setOscuro] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  function alternar() {
    const nuevo = !oscuro
    document.documentElement.classList.toggle('dark', nuevo)
    try { localStorage.setItem('tema', nuevo ? 'oscuro' : 'claro') } catch { /* sin almacenamiento */ }
    setOscuro(nuevo)
  }

  return (
    <button
      onClick={alternar}
      aria-label="Cambiar entre modo oscuro y claro"
      className="btn btn-icono"
    >
      {oscuro ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}