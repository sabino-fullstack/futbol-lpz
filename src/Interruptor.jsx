export default function Interruptor({ activo, onCambio, etiqueta, disabled = false }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        disabled={disabled}
        onClick={() => onCambio(!activo)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          padding: 2,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: activo ? '#16a34a' : '#9ca3af',
          display: 'flex',
          justifyContent: activo ? 'flex-end' : 'flex-start',
        }}
      >
        <span
          style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block' }}
        />
      </button>
      {etiqueta && <span>{etiqueta}</span>}
    </div>
  )
}