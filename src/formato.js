export const bs = (n) => {
  const x = Number(n)
  return Number.isInteger(x) ? String(x) : x.toFixed(2)
}

export const hhmm = (t) => (t ? t.slice(0, 5) : '')

// "17:45 – 19:45" si hay hora de fin; si no, solo "17:45"
export const rangoHora = (p) =>
  p.hora_fin ? `${hhmm(p.hora)} – ${hhmm(p.hora_fin)}` : hhmm(p.hora)

// "3 equipos de 8 jugadores" si los cupos se dividen exacto; si no, "3 equipos"
export function textoEquipos(p) {
  if (!p.equipos) return null
  if (p.cupos % p.equipos === 0) {
    return `${p.equipos} equipos de ${p.cupos / p.equipos} jugadores`
  }
  return `${p.equipos} equipos`
}