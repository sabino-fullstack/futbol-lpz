import { useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { supabase } from './supabaseClient'
import Interruptor from './Interruptor'
import Rueda from './Rueda'

export default function AvisarCupo({ partidoId, jugador, arquero, espera, onCambio }) {
  const [trabajando, setTrabajando] = useState(null)
  const [error, setError] = useState(null)

  async function cambiar(posicion, activar) {
    setError(null)
    setTrabajando(posicion)
    const { error } = await supabase.rpc(activar ? 'unirse_lista_espera' : 'salir_lista_espera', {
      p_partido: partidoId,
      p_posicion: posicion,
    })
    setTrabajando(null)
    if (error) return setError(error.message)
    onCambio?.()
  }

  const filas = [
    jugador && ['jugador', 'jugador de campo'],
    arquero && ['arquero', 'arquero'],
  ].filter(Boolean)
  if (filas.length === 0) return null

  return (
    <div className="space-y-2 rounded-xl border border-borde bg-borde/30 p-2.5">
      {filas.map(([pos, nombre]) => {
        const dato = espera?.[pos]
        const yo = dato?.yo === true
        return (
          <label key={pos} className="flex cursor-pointer items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                yo ? 'bg-verde text-sobre-verde' : 'bg-amarillo/15 text-amarillo-texto'
              }`}
            >
              {yo ? <BellRing size={18} className="pop" /> : <Bell size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">
                {yo
                  ? `Te avisaremos si se libera un cupo de ${nombre}`
                  : `Avísame si se libera un cupo de ${nombre}`}
              </span>
              {dato?.esperando > 0 && (
                <span className="text-xs text-suave">
                  {dato.esperando} {dato.esperando === 1 ? 'persona esperando' : 'personas esperando'}
                </span>
              )}
            </span>
            {trabajando === pos ? (
              <Rueda />
            ) : (
              <Interruptor activo={yo} onCambio={(v) => cambiar(pos, v)} />
            )}
          </label>
        )
      })}
      {error && <p className="text-sm text-rojo">{error}</p>}
    </div>
  )
}