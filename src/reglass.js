// BORRADOR: revísalo y ajústalo a tus reglas reales.
// Si cambias un número (plazo de cancelación, faltas, minutos de reserva), cámbialo también aquí.
export const ACTUALIZADO = 'octubre de 2026'

export const SECCIONES_REGLAS = [
  {
    clave: 'reservas',
    titulo: 'Reservas y pagos',
    puntos: [
      'Cada cupo se reserva desde la app. Al reservar tienes unos minutos (normalmente 10) para pagar y avisar tu pago; si no lo haces, el cupo se libera para otras personas.',
      'Pagas con el QR de un encargado, tocas "Ya pagué" y envías la captura de tu pago por WhatsApp. Tu cupo queda confirmado cuando el encargado verifica el pago.',
      'Si el encargado no puede verificar tu pago, tendrás otra oportunidad para volver a avisarlo.',
      'El pago en cancha solo existe si el encargado lo autoriza antes del partido. No es una opción que puedas elegir tú.',
      'Los arqueros pagan una cuota distinta cuando el partido tiene cupos de arco. La cuota de cada partido se muestra antes de reservar.',
    ],
  },
  {
    clave: 'cancelaciones',
    titulo: 'Cancelaciones y devoluciones',
    puntos: [
      'Puedes cancelar tu cupo desde "Mis reservas" hasta cierto plazo antes del partido (normalmente 24 horas; cada partido muestra su plazo en la pantalla de pago).',
      'Si cancelas dentro del plazo y ya habías pagado, el encargado coordina la devolución contigo por WhatsApp. La app no mueve dinero: la devolución se hace por transferencia o por el medio que acuerden.',
      'Si cancelas fuera del plazo, no corresponde devolución. Puedes hablar con el encargado para conseguir un reemplazo.',
      'Si el partido se cancela por parte de la organización, se devuelve el dinero de los cupos pagados.',
    ],
  },
  {
    clave: 'asistencia',
    titulo: 'Asistencia',
    puntos: [
      'Si no vienes a un partido en el que tenías un cupo confirmado, el encargado puede registrarte una falta.',
      'Con 2 faltas en 90 días tu cuenta queda en revisión: no podrás reservar hasta que un encargado la apruebe.',
      'Las faltas de las personas que anotes como acompañantes no cuentan contra tu cuenta, pero el encargado las ve.',
    ],
  },
  {
    clave: 'cuenta',
    titulo: 'Tu cuenta',
    puntos: [
      'Usa tu nombre y apellido reales: sirven para identificar tu pago.',
      'Las cuentas nuevas tienen límites menores de cupos sin confirmar; suben cuando se confirma tu primer pago.',
      'Podemos suspender cuentas por mal uso, como reservar sin intención de pagar o dar datos falsos.',
    ],
  },
  {
    clave: 'datos',
    titulo: 'Tus datos',
    puntos: [
      'Guardamos tu nombre, apellido, apodo (si lo pones) y número de WhatsApp para organizar los partidos.',
      'En la lista de un partido, los demás jugadores ven tu apodo o tu nombre con la inicial del apellido. Los encargados y el organizador ven tu nombre completo y tu WhatsApp para gestionar pagos.',
      'Si quieres corregir o borrar tus datos, escríbele al organizador.',
    ],
  },
]