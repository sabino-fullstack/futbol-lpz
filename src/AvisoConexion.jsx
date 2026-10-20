import { useEffect, useState } from 'react'

export default function AvisoConexion() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine)

  useEffect(() => {
    const conectar = () => setEnLinea(true)
    const desconectar = () => setEnLinea(false)
    window.addEventListener('online', conectar)
    window.addEventListener('offline', desconectar)
    return () => {
      window.removeEventListener('online', conectar)
      window.removeEventListener('offline', desconectar)
    }
  }, [])

  if (enLinea) return null
  return (
    <p className="aviso aviso-alerta mx-auto max-w-xl text-center text-sm">
      Sin conexión. Reconéctate para reservar y ver los cupos al día.
    </p>
  )
}