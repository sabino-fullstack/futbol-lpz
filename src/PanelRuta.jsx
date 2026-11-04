import { useParams } from 'react-router'
import PanelPartido from './PanelPartido'
import { useVolver } from './navegacion'

export default function PanelRuta({ perfilId, esSuperadmin, volverA }) {
  const { partidoId } = useParams()
  const volver = useVolver(volverA)
  return (
    <PanelPartido
      key={partidoId}
      partidoId={partidoId}
      perfilId={perfilId}
      esSuperadmin={esSuperadmin}
      onVolver={volver}
    />
  )
}