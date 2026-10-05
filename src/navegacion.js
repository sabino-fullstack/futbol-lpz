import { useLocation, useNavigate } from 'react-router'

export function useVolver(destinoPorDefecto) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    // 'default' = la primera pantalla de la sesión (no hay historial dentro de la app)
    if (location.key === 'default') navigate(destinoPorDefecto, { replace: true })
    else navigate(-1)
  }
}