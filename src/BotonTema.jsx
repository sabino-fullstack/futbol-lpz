import { useState } from 'react'

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
    <button onClick={alternar} aria-label="Cambiar entre modo oscuro y claro">
      {oscuro ? '☀️' : '🌙'}
    </button>
  )
}