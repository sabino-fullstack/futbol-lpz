import { salir } from './auth'

export default function CuentaSuspendida() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <img src="/logo.png" alt="Fútbol LPZ" className="h-24 w-24 rounded-full" />
      <h1 className="text-xl font-bold">Tu cuenta está suspendida</h1>
      <p className="text-suave">
        Por ahora no puedes hacer reservas. Si crees que es un error, habla con el
        organizador por WhatsApp.
      </p>
      <button onClick={salir}>Salir</button>
    </div>
  )
}