import { enlaceConsulta, nombreCorto } from './formato'

export default function ConsultarEncargado({ encargados, partido }) {
  const con = (encargados ?? []).filter((e) => e.perfiles?.whatsapp)
  if (con.length === 0) return null
  return (
    <div className="space-y-1">
      {con.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2">
          <span className="text-sm text-suave">Encargado: {nombreCorto(e.perfiles)}</span>
          <a
            href={enlaceConsulta(e.perfiles.whatsapp, partido)}
            target="_blank"
            rel="noreferrer"
            className="btn"
          >
            💬 Consultar
          </a>
        </div>
      ))}
    </div>
  )
}