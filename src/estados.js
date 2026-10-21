// Estado de pago de un cupo, según su reserva y el último pago de su grupo
export function claveCupo(r, pago, ahora = Date.now()) {
  if (r.estado === 'cancelado') return 'cancelado'
  if (r.estado === 'confirmado') {
    if (pago?.metodo === 'bonificado') return 'bonificado'
    if (pago?.metodo === 'cancha') return r.cobrado_en ? 'cancha_cobrado' : 'cancha_debe'
    return 'qr'
  }
  if (pago?.estado === 'por_verificar') return 'por_verificar'
  if (new Date(r.vencimiento).getTime() <= ahora) return 'vencido'
  return pago?.estado === 'rechazado' ? 'rechazado' : 'reservado'
}