import { ChevronLeft, Lock, RotateCcw, User, UserCheck, Wallet } from 'lucide-react'
import { SECCIONES_REGLAS, ACTUALIZADO } from './reglass'
import { useVolver } from './navegacion'

const ICONOS = { reservas: Wallet, cancelaciones: RotateCcw, asistencia: UserCheck, cuenta: User, datos: Lock }

export default function Reglas() {
  const volver = useVolver('/partidos')
  return (
    <div className="space-y-4">
      <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>
      <h2>Reglas y condiciones</h2>
      <p className="text-sm text-suave">Actualizado en {ACTUALIZADO}.</p>
      {SECCIONES_REGLAS.map((s) => {
        const Icono = ICONOS[s.clave] ?? Wallet
        return (
          <section key={s.clave} className="tarjeta space-y-2">
            <h3 className="flex items-center gap-2 text-xl">
              <Icono size={20} className="text-verde" /> {s.titulo}
            </h3>
            <ul className="list-disc space-y-1.5 pl-5">
              {s.puntos.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </section>
        )
      })}
    </div>
  )
}