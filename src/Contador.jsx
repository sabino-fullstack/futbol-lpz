export default function Contador({ valor, min = 0, max = 10, onCambio, etiqueta }) {
  return (
    <div className="flex items-center justify-between gap-3">
      {etiqueta && <span className="font-medium">{etiqueta}</span>}
      <div className="flex items-center gap-3">
        <button
          aria-label="Disminuir"
          onClick={() => onCambio(Math.max(min, valor - 1))}
          disabled={valor <= min}
          className="h-12 w-12 rounded-full p-0 text-2xl font-bold"
        >
          −
        </button>
        <span className="min-w-8 text-center text-xl font-bold">{valor}</span>
        <button
          aria-label="Aumentar"
          onClick={() => onCambio(Math.min(max, valor + 1))}
          disabled={valor >= max}
          className="h-12 w-12 rounded-full p-0 text-2xl font-bold"
        >
          +
        </button>
      </div>
    </div>
  )
}