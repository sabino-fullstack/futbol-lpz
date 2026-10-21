import Balon from './Balon'

export default function Cargando({ texto = 'Cargando...', pantalla = false }) {
  return (
    <div className={`carga ${pantalla ? 'carga-pantalla' : ''}`} role="status" aria-live="polite">
      <div className="carga-balon"><Balon /></div>
      <p className="text-sm text-suave">{texto}</p>
    </div>
  )
}