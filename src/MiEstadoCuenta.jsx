import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { supabase } from './supabaseClient'
import Rueda from './Rueda'
import { bs, diaMes, mesActual, nombreMes, rangoMes, sumarMeses } from './formato'

const num = (v) => Number(v ?? 0)

export default function MiEstadoCuenta() {
  const [mes, setMes] = useState(mesActual())
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const pedido = useRef(0)

  useEffect(() => {
    const id = ++pedido.current
    setFilas(null)
    const { desde, hasta } = rangoMes(mes)
    supabase.rpc('mi_estado_cuenta', { p_desde: desde, p_hasta: hasta }).then(({ data, error }) => {
      if (id !== pedido.current) return
      if (error) return setError(error.message)
      setError(null)
      setFilas(data)
    })
  }, [mes])

  const lista = filas ?? []
  const total = lista.reduce((s, f) => s + num(f.tarifa), 0)
  const cobrado = lista.filter((f) => f.cobrada).reduce((s, f) => s + num(f.tarifa), 0)

  return (
    <details className="tarjeta">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        <Receipt size={18} className="shrink-0 text-verde" />
        <span className="flex-1">Mi acuerdo con la organización</span>
      </summary>
      <div className="space-y-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <button aria-label="Mes anterior" className="btn btn-icono" onClick={() => setMes(sumarMeses(mes, -1))}>
            <ChevronLeft size={18} />
          </button>
          <p className="font-semibold first-letter:uppercase">{nombreMes(mes)}</p>
          <button aria-label="Mes siguiente" className="btn btn-icono" onClick={() => setMes(sumarMeses(mes, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>

        {error && <p className="aviso aviso-error">{error}</p>}
        {!filas && !error && <p className="flex items-center gap-2 text-sm text-suave"><Rueda size={16} /> Cargando...</p>}
        {filas && lista.length === 0 && <p className="text-suave">No tienes partidos con acuerdo este mes.</p>}

        {lista.length > 0 && (
          <>
            <ul className="divide-y divide-borde text-sm">
              {lista.map((f) => (
                <li key={f.id_partido} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate">{diaMes(f.fecha)} · {f.cancha}</span>
                    <span className="text-xs text-suave">
                      Tus partidos movieron {bs(num(f.movimiento))} Bs
                      {f.estado === 'cancelado' && ' · cancelado'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">{bs(num(f.tarifa))} Bs</span>
                    <span className={`text-xs font-semibold ${f.cobrada ? 'text-verde' : 'text-amarillo-texto'}`}>
                      {f.cobrada ? 'cobrada' : 'pendiente'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Total de tarifas: <strong>{bs(total)} Bs</strong> · Pagado: <strong>{bs(cobrado)} Bs</strong> ·
              Saldo: <strong>{bs(total - cobrado)} Bs</strong>
            </p>
            <p className="text-xs text-suave">
              La tarifa se acuerda y se paga por fuera de la app. La organización la marca como cobrada.
            </p>
          </>
        )}
      </div>
    </details>
  )
}