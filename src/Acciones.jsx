import { Children } from 'react'
import { Link } from 'react-router'

// Un botón de la cuadrícula: puede ser botón, enlace interno (to) o enlace externo (href)
export function Accion({ Icono, texto, onClick, to, href, tono, disabled, ...resto }) {
  const clase = `accion ${tono === 'peligro' ? 'accion-peligro' : tono === 'activo' ? 'accion-activo' : ''}`
  const contenido = (
    <>
      {Icono && <Icono size={20} />}
      <span>{texto}</span>
    </>
  )
  if (to) return <Link to={to} className={clase} {...resto}>{contenido}</Link>
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={clase} {...resto}>{contenido}</a>
  return (
    <button type="button" className={clase} onClick={onClick} disabled={disabled} {...resto}>
      {contenido}
    </button>
  )
}

// Reparte los botones en 1, 2 o 3 columnas parejas
export function Acciones({ children, columnas }) {
  const n = columnas ?? Children.toArray(children).length
  const cols = n <= 1 ? 'grid-cols-1' : n === 3 || n >= 5 ? 'grid-cols-3' : 'grid-cols-2'
  return <div className={`grid ${cols} gap-2`}>{children}</div>
}