import { useState } from 'react'
import { Check, Type } from 'lucide-react'
import { NIVELES, aplicarTexto, textoActual } from './texto'

const TAMANOS = [16, 21, 27] // tamaño de la muestra "Aa", independiente del nivel elegido

export default function TamanoTexto({ compacto = false }) {
  const [nivel, setNivel] = useState(textoActual())

  function elegir(n) {
    aplicarTexto(n)
    setNivel(n)
  }

  if (compacto) {
    const i = NIVELES.findIndex(([id]) => id === nivel)
    const siguiente = NIVELES[(i + 1) % NIVELES.length][0]
    return (
      <button
        type="button"
        onClick={() => elegir(siguiente)}
        aria-label={`Tamaño del texto: ${NIVELES[i][1]}. Toca para cambiarlo`}
        className="btn gap-1.5"
      >
        <Type size={18} />
        <span className="font-bold">{nivel === 'normal' ? 'A' : nivel === 'grande' ? 'A+' : 'A++'}</span>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamaño del texto">
        {NIVELES.map(([id, nombre], i) => {
          const activo = nivel === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => elegir(id)}
              className={`relative flex h-auto flex-col items-center gap-1 py-3 ${
                activo ? 'border-verde bg-verde/10 text-verde' : ''
              }`}
            >
              <span className="font-bold leading-none" style={{ fontSize: TAMANOS[i] }}>Aa</span>
              <span className="text-xs font-semibold">{nombre}</span>
              {activo && <Check size={16} className="pop absolute right-1.5 top-1.5" />}
            </button>
          )
        })}
      </div>
      <p className="rounded-xl bg-borde/40 p-3">
        Así se verán los textos de la app. Si te cuesta leer, elige un tamaño más grande.
      </p>
    </div>
  )
}