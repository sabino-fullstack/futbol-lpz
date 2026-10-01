export default function Contador({ valor, min = 0, max = 10, onCambio, etiqueta }) {
  return (
    <div>
      {etiqueta && <span>{etiqueta} </span>}
      <button
        aria-label="Disminuir"
        onClick={() => onCambio(Math.max(min, valor - 1))}
        disabled={valor <= min}
      >
        −
      </button>
      <strong> {valor} </strong>
      <button
        aria-label="Aumentar"
        onClick={() => onCambio(Math.min(max, valor + 1))}
        disabled={valor >= max}
      >
        +
      </button>
    </div>
  )
}