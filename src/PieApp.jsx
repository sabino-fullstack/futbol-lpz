import { Link } from 'react-router'
import FranjaAuspiciantes from './FranjaAuspiciantes'

export default function PieApp() {
  return (
    <footer className="space-y-3">
      <FranjaAuspiciantes />
      <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-2 text-sm">
        <Link to="/ayuda">Cómo funciona</Link>
        <Link to="/reglas">Reglas y condiciones</Link>
      </p>
    </footer>
  )
}