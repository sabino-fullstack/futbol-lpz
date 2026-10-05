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
export const fechaCorta = (fecha) =>
  new Date(fecha + 'T00:00:00').toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  export const nombreCompleto = (p) => {
  if (!p) return ''
  const base = [p.nombre, p.apellido].filter(Boolean).join(' ')
  return p.apodo ? `${base} (${p.apodo})` : base
}
const TZ = 'America/La_Paz'

export const hoyBolivia = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: TZ })

// Bolivia no cambia de horario: siempre es UTC-4
export const inicioPartido = (p) => new Date(`${p.fecha}T${p.hora}-04:00`)

const aUTC = (f) => {
  const [y, m, d] = f.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function etiquetaDia(fecha) {
  const dias = Math.round((aUTC(fecha) - aUTC(hoyBolivia())) / 86400000)
  const d = new Date(aUTC(fecha))
  const semana = d.toLocaleDateString('es-BO', { weekday: 'long', timeZone: 'UTC' })
  const fechaTxt = d.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)

  if (dias === 0) return { titulo: 'Hoy', detalle: `${semana} ${fechaTxt}` }
  if (dias === 1) return { titulo: 'Mañana', detalle: `${semana} ${fechaTxt}` }
  return { titulo: cap(semana), detalle: fechaTxt }
}
// Un partido termina en su hora de fin; si no la tiene, 3 horas después del inicio
export const finPartido = (p) =>
  p.hora_fin
    ? new Date(`${p.fecha}T${p.hora_fin}-04:00`)
    : new Date(inicioPartido(p).getTime() + 3 * 3600 * 1000)  
// "Chino" si tiene apodo; si no, "Carlos P."
export const nombreCorto = (p) => {
  if (!p) return ''
  if (p.apodo) return p.apodo
  return p.apellido ? `${p.nombre} ${p.apellido.charAt(0)}.` : p.nombre
}

// WhatsApp del encargado con un mensaje de consulta ya escrito
export function enlaceConsulta(whatsapp, partido) {
  const mensaje =
    `Hola, tengo una consulta sobre el partido en ${partido.cancha}, ` +
    `${fechaCorta(partido.fecha)} a las ${hhmm(partido.hora)}.`
  return `https://wa.me/${String(whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
}

// Compartir el partido por WhatsApp (el enlace lleva directo a su detalle)
export function enlaceCompartir(partido) {
  const url = `${window.location.origin}/partidos/${partido.id}`
  const mensaje =
    `⚽ ${partido.cancha}, ${fechaCorta(partido.fecha)} a las ${hhmm(partido.hora)}. ` +
    `Mira los cupos y reserva aquí 👇\n${url}`
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
}