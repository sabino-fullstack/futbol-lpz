import { useRegisterSW } from 'virtual:pwa-register/react'

export default function ActualizarApp() {
  const {
    needRefresh: [hayNueva, setHayNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return
      const buscar = () => {
        if (navigator.onLine) registro.update().catch(() => {})
      }
      // Cada hora, y cada vez que la app vuelve a primer plano
      setInterval(buscar, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') buscar()
      })
    },
  })

  if (!hayNueva) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 p-3">
      <div className="tarjeta mx-auto flex max-w-xl items-center justify-between gap-3 shadow-lg">
        <span>Hay una versión nueva de la app.</span>
        <div className="flex gap-2">
          <button className="btn btn-activo" onClick={() => updateServiceWorker(true)}>
            Actualizar
          </button>
          <button onClick={() => setHayNueva(false)}>Luego</button>
        </div>
      </div>
    </div>
  )
}