import { supabase } from './supabaseClient'

function armarEnlaceWhatsApp(encargado, jugador, partido) {
  const fecha = new Date(partido.fecha + 'T00:00:00').toLocaleDateString('es-BO', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const hora = partido.hora.slice(0, 5)

  const mensaje =
    `Hola, soy ${jugador.nombre}. ` +
    `Pagué ${partido.cuota} Bs para el partido en ${partido.cancha}, ` +
    `${fecha} a las ${hora}.`

  const numero = encargado.whatsapp.replace(/\D/g, '')
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
}

export default function PantallaPago({ partido, jugador, reserva, encargados }) {
  async function registrarAviso(encargado) {
    // Se registra en la base de datos; no esperamos la respuesta
    // para no bloquear la apertura de WhatsApp
    const { error } = await supabase.from('pagos').insert({
      reserva_id: reserva.id,
      metodo: 'qr',
      monto: partido.cuota,
      estado: 'por_verificar',
      pagar_a: encargado.id,
    })
    if (error) console.error('No se pudo registrar el aviso:', error.message)
  }

  return (
    <div>
      <h2>Paga tu cupo: {partido.cuota} Bs</h2>
      <p>Paga con el QR de cualquiera de los encargados y avísale por WhatsApp.</p>

      {encargados.map((enc) => (
        <div key={enc.id}>
          <h3>{enc.nombre}</h3>
          <img src={enc.qr_url} alt={`QR de ${enc.nombre}`} width="220" />
          <a
            href={armarEnlaceWhatsApp(enc, jugador, partido)}
            target="_blank"
            rel="noreferrer"
            onClick={() => registrarAviso(enc)}
          >
            Ya pagué, avisar a {enc.nombre}
          </a>
        </div>
      ))}
    </div>
  )
}