import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from './supabaseClient'
import Cargando from './Cargando'
import Zonas from './Zonas'
import { mesActual, nombreMes, rangoMes, sumarMeses } from './formato'

const ORDEN_EDAD = ['Menos de 18', '18 a 24', '25 a 34', '35 a 44', '45 o más', 'Sin dato']
const num = (v) => Number(v ?? 0)

function Bloque({ titulo, filas, fijo, limite = 100 }) {
  const [todas, setTodas] = useState(false)
  const orden = fijo
    ? [...filas].sort((a, b) => fijo.indexOf(a.categoria) - fijo.indexOf(b.categoria))
    : [...filas].sort((a, b) =>
        (a.categoria === 'Sin dato') - (b.categoria === 'Sin dato') ||
        b.cuentas - a.cuentas || a.categoria.localeCompare(b.categoria, 'es'))
  const visibles = todas ? orden : orden.slice(0, limite)
  const max = Math.max(1, ...orden.map((f) => f.cuentas))

  return (
    <section className="tarjeta space-y-2.5">
      <h3>{titulo}</h3>
      {visibles.map((f) => (
        <div key={f.categoria} className="space-y-0.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className={`truncate ${f.categoria === 'Sin dato' ? 'text-suave' : ''}`}>{f.categoria}</span>
            <span className="shrink-0 tabular-nums text-suave">
              <strong className="text-texto">{f.cuentas}</strong> cuentas · {f.activos} jugaron
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-borde"
            role="img"
            aria-label={`${f.categoria}: ${f.cuentas} cuentas`}
          >
            <div
              className={`h-full rounded-full ${f.categoria === 'Sin dato' ? 'bg-suave/50' : 'bg-verde'}`}
              style={{ width: `${(f.cuentas / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {orden.length > limite && (
        <button onClick={() => setTodas(!todas)}>
          {todas ? 'Mostrar menos' : `Mostrar las ${orden.length} categorías`}
        </button>
      )}
    </section>
  )
}

export default function Analisis() {
  const [mes, setMes] = useState(mesActual())
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState(null)
  const pedido = useRef(0)

  async function cargar() {
    const id = ++pedido.current
    const { desde, hasta } = rangoMes(mes)
    const { data, error } = await supabase.rpc('analisis_perfiles', { p_desde: desde, p_hasta: hasta })
    if (id !== pedido.current) return // se cambió de mes mientras cargaba
    if (error) return setError(error.message)
    setError(null)
    setFilas(data)
  }

  useEffect(() => { setFilas(null); cargar() }, [mes])

  const por = (dim) => (filas ?? []).filter((f) => f.dimension === dim)
  const resumen = Object.fromEntries(por('resumen').map((f) => [f.categoria, f]))
  const cuentas = num(resumen.cuentas?.cuentas)
  const jugaron = num(resumen.cuentas?.activos)
  const conPerfil = num(resumen.con_perfil?.cuentas)
  const menores = num(por('edad').find((f) => f.categoria === 'Menos de 18')?.cuentas)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button aria-label="Mes anterior" className="btn btn-icono" onClick={() => setMes(sumarMeses(mes, -1))}>
          <ChevronLeft size={18} />
        </button>
        <h3 className="text-center text-xl first-letter:uppercase">{nombreMes(mes)}</h3>
        <button aria-label="Mes siguiente" className="btn btn-icono" onClick={() => setMes(sumarMeses(mes, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      {error && <p className="aviso aviso-error">{error}</p>}
      {!filas && !error && <Cargando />}

      {filas && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Cuentas activas', cuentas],
              ['Jugaron este mes', jugaron],
              ['Con perfil', cuentas > 0 ? `${Math.round((conPerfil / cuentas) * 100)} %` : '—'],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="tarjeta space-y-0.5 p-3 text-center">
                <p className="text-xs text-suave">{etiqueta}</p>
                <p className="font-display text-2xl font-bold tabular-nums">{valor}</p>
              </div>
            ))}
          </div>

          <p className="text-sm text-suave">
            "Cuentas" son todas las activas (incluidas las de encargados). "Jugaron" son las que tuvieron
            un cupo confirmado propio en un partido del mes. Solo se ven conteos, nunca los datos de una persona.
            {cuentas < 30 && ' Con pocas cuentas, los porcentajes pueden engañar: úsalos como una pista, no como una conclusión.'}
          </p>

          {menores > 0 && (
            <p className="aviso aviso-alerta text-sm">
              Hay {menores} cuenta(s) de menores de 18. Cuando tengas más datos, decide tu política
              (por ejemplo, que el pago lo haga un adulto).
            </p>
          )}

          <Bloque titulo="Por zona" filas={por('zona')} limite={12} />
          <Bloque titulo="Por edad" filas={por('edad')} fijo={ORDEN_EDAD} />
          <Bloque titulo="Posición habitual" filas={por('posicion')} />
          <Bloque titulo="Cómo se enteraron" filas={por('origen')} />
        </>
      )}

      <Zonas onCambio={cargar} />
    </div>
  )
}