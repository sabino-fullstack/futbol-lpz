import { Link } from 'react-router'
import FranjaAuspiciantes from './FranjaAuspiciantes'

export default function PieApp() {
  return (
    <footer className="space-y-3">
      <FranjaAuspiciantes />
      <p className="pb-2 text-center text-sm">
        <Link to="/reglas">Reglas y condiciones</Link>
      </p>
    </footer>
  )
}