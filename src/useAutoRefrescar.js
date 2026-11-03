import { useEffect, useRef } from 'react'

// Llama a `funcion` cada `ms` mientras la pantalla está visible y hay conexión,
// y también al volver a la pantalla. Nunca hace dos llamadas a la vez.
export function useAutoRefrescar(funcion, ms = 30000) {
  const ref = useRef(funcion)
  useEffect(() => { ref.current = funcion })

  useEffect(() => {
    let enCurso = false
    const refrescar = async () => {
      if (enCurso || document.visibilityState !== 'visible' || !navigator.onLine) return
      enCurso = true
      try { await ref.current() } finally { enCurso = false }
    }
    const id = setInterval(refrescar, ms)
    document.addEventListener('visibilitychange', refrescar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refrescar)
    }
  }, [ms])
}