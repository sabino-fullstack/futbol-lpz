import { useEffect } from 'react'
import { Link } from 'react-router'
import {
  BadgeCheck, Banknote, CalendarDays, ChevronDown, ChevronLeft, CircleHelp, FileText,
  Hourglass, KeyRound, MessageCircle, QrCode, RotateCcw, Smartphone, Ticket, UserX, Users,Bell
} from 'lucide-react'
import BarraCupos from './BarraCupos'
import Etiqueta from './EtiquetaEstado'

import { WHATSAPP_AYUDA } from './contacto'
import { nombreCompleto } from './formato'
import { useVolver } from './navegacion'
import { useGrupo } from './useGrupo'

const TONOS = {
  verde: 'bg-verde/15 text-verde',
  amarillo: 'bg-amarillo/15 text-amarillo-texto',
}

const PASOS = [
  { Icono: CalendarDays, tono: 'verde', titulo: 'Elige tu partido',
    texto: 'Mira los partidos de la semana. La barra de colores te dice cuántos cupos quedan.' },
  { Icono: Ticket, tono: 'verde', titulo: 'Reserva tu cupo',
    texto: 'Toca "Reservar cupo". Si vienes con amigos, anótalos: cada persona es un cupo.' },
  { Icono: QrCode, tono: 'amarillo', titulo: 'Paga con el QR',
    texto: 'Tienes unos minutos (normalmente 10) para pagar. Escanea el QR del encargado o descárgalo.' },
  { Icono: MessageCircle, tono: 'amarillo', titulo: 'Avisa por WhatsApp',
    texto: 'Toca "Ya pagué" y envía la captura de tu pago. El mensaje ya viene escrito.' },
  { Icono: BadgeCheck, tono: 'verde', titulo: '¡Cupo confirmado!',
    texto: 'Cuando el encargado revisa tu pago, tu cupo queda asegurado. Míralo en "Mis reservas".' },
]

const COLORES = [
  ['confirmado', 'Tu cupo está asegurado.'],
  ['por_verificar', 'Avisaste tu pago y el encargado lo está revisando.'],
  ['reservado', 'Reservaste pero falta pagar: el reloj sigue corriendo.'],
  ['jug_cancha', 'El encargado autorizó que pagues en la cancha.'],
  ['rechazado', 'No se pudo verificar tu pago: revísalo y avísalo de nuevo.'],
]

function Burbuja({ Icono, tono = 'verde', chica = false }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${TONOS[tono]} ${chica ? 'h-9 w-9' : 'h-11 w-11'}`}
    >
      <Icono size={chica ? 18 : 22} />
    </span>
  )
}

function Pregunta({ Icono, pregunta, children }) {
  return (
    <details className="tarjeta group p-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 font-semibold [&::-webkit-details-marker]:hidden">
        <Burbuja Icono={Icono} chica />
        <span className="min-w-0 flex-1">{pregunta}</span>
        <ChevronDown size={18} className="shrink-0 text-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-borde px-3 py-3 text-suave">{children}</div>
    </details>
  )
}

const numeroValido = /^591\d{8}$/.test(WHATSAPP_AYUDA)

export default function Ayuda({ perfil }) {
  const volver = useVolver('/partidos')
  const { enlace: grupo } = useGrupo()

  // Quien ya vio la ayuda no vuelve a ver la invitación de la lista
  useEffect(() => {
    try { localStorage.setItem('ayuda_vista', '1') } catch { /* sin almacenamiento */ }
  }, [])

  const mensaje = `Hola, necesito ayuda con Fútbol LPZ.${perfil ? ` Mi nombre es ${nombreCompleto(perfil)}.` : ''}`

  return (
    <div className="space-y-5">
      <button onClick={volver} className="btn"><ChevronLeft size={18} /> Volver</button>

      <header className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-verde text-sobre-verde">
          <CircleHelp size={30} />
        </span>
        <div>
          <h2>¿Cómo funciona?</h2>
          <p className="text-suave">Reservar tu cupo toma menos de 2 minutos.</p>
        </div>
      </header>


      <section className="tarjeta space-y-4">
        <h3>Paso a paso</h3>
        <ol>
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="relative flex gap-3 pb-5 last:pb-0">
              {i < PASOS.length - 1 && (
                <span aria-hidden="true" className="absolute left-[1.375rem] top-11 bottom-0 w-0.5 -translate-x-1/2 bg-borde" />
              )}
              <Burbuja Icono={p.Icono} tono={p.tono} />
              <div className="min-w-0 pt-0.5">
                <p className="text-xs font-bold uppercase tracking-wide text-suave">Paso {i + 1}</p>
                <p className="text-lg font-bold leading-tight">{p.titulo}</p>
                <p className="text-suave">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="tarjeta space-y-4">
        <h3>Qué significan los colores</h3>

        <div className="space-y-3">
          <p className="font-semibold">Los cupos del partido</p>
          <BarraCupos titulo="Hay lugar" libres={8} total={10} />
          <BarraCupos titulo="A la mitad" libres={4} total={10} />
          <BarraCupos titulo="Casi lleno" libres={1} total={10} />
        </div>

        <div className="space-y-3">
          <p className="font-semibold">El estado de tu reserva</p>
          {COLORES.map(([clave, texto]) => (
            <div key={clave} className="space-y-1">
              <Etiqueta clave={clave} />
              <p className="text-sm text-suave">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3>Preguntas frecuentes</h3>

        <Pregunta Icono={Hourglass} pregunta="¿Qué pasa si no pago a tiempo?">
          <p>
            Tu reserva se libera para que otra persona tome el cupo. Si ya pagaste y se te pasó el
            tiempo, escríbele al encargado por WhatsApp.
          </p>
        </Pregunta>

        <Pregunta Icono={RotateCcw} pregunta="¿Puedo cancelar mi cupo?">
          <p>
            Sí, desde "Mis reservas", hasta cierto plazo antes del partido (normalmente 24 horas; cada
            partido muestra su plazo). Si ya pagaste y cancelas a tiempo, el encargado coordina tu
            devolución por WhatsApp. Fuera de plazo no hay devolución.
          </p>
        </Pregunta>

        <Pregunta Icono={Banknote} pregunta="¿Puedo pagar en la cancha?">
          <p>
            Solo si el encargado lo autoriza antes. Escríbele con el botón "Consultar" de la tarjeta
            del partido.
          </p>
        </Pregunta>

        <Pregunta Icono={Users} pregunta="¿Cómo reservo para mis amigos?">
          <p>
            Al reservar, sube la cantidad de cupos y escribe el nombre de cada acompañante. Pagas todo
            junto, y si alguien no va, puedes cancelar solo su cupo.
          </p>
        </Pregunta>
        <Pregunta Icono={Bell} pregunta="El partido está lleno, ¿qué hago?">
  <p>
    Toca "Avísame si se libera un cupo". Cuando alguien cancele o no pague a tiempo, verás un aviso en
    la campana de arriba. El primero en reservar se queda con el cupo, así que entra rápido.
  </p>
</Pregunta>

        <Pregunta Icono={UserX} pregunta="¿Qué pasa si no voy?">
          <p>
            Si no vienes a un partido confirmado, el encargado puede registrar una falta. Con 2 faltas
            en 90 días tu cuenta queda en revisión: no podrás reservar hasta que un encargado la
            apruebe. Si no puedes ir, cancela a tiempo.
          </p>
        </Pregunta>


        <Pregunta Icono={KeyRound} pregunta="Olvidé mi contraseña">
          <p>
            Escríbele al organizador por WhatsApp desde el mismo número con el que te registraste. Te
            dará una contraseña temporal y la app te pedirá crear una nueva.
          </p>
        </Pregunta>

        <Pregunta Icono={Smartphone} pregunta="¿Cómo instalo la app en mi celular?">
          <p>
            <strong className="text-texto">Android:</strong> en Chrome toca el menú ⋮ y luego "Instalar
            app" (o el botón "Instalar" que aparece arriba de la lista de partidos).
          </p>
          <p>
            <strong className="text-texto">iPhone:</strong> abre la página en Safari (no en el
            navegador de WhatsApp), toca el botón Compartir y luego "Añadir a pantalla de inicio".
          </p>
        </Pregunta>
      </section>

{grupo && (
  <section className="tarjeta space-y-3">
    <h3 className="flex items-center gap-2"><Users size={20} className="text-verde" /> Grupo de WhatsApp</h3>
    <p className="text-suave">Ahí se avisan los partidos de la semana y se resuelven las dudas.</p>
    <a className="btn btn-primario" href={grupo} target="_blank" rel="noreferrer">
      <MessageCircle size={20} /> Unirme al grupo
    </a>
  </section>
)}

      <section className="tarjeta space-y-3">
        <h3>¿Necesitas ayuda?</h3>
        {numeroValido ? (
          <a
            className="btn btn-primario"
            target="_blank"
            rel="noreferrer"
            href={`https://wa.me/${WHATSAPP_AYUDA}?text=${encodeURIComponent(mensaje)}`}
          >
            <MessageCircle size={20} /> Escribir por WhatsApp
          </a>
        ) : (
          <p className="text-suave">Pídele ayuda al organizador en el grupo de WhatsApp.</p>
        )}
        <Link to="/reglas" className="btn w-full">
          <FileText size={18} /> Ver las reglas completas
        </Link>
      </section>
    </div>
  )
}