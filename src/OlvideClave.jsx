import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { WHATSAPP_AYUDA } from './contacto'

const numeroValido = /^591\d{8}$/.test(WHATSAPP_AYUDA)

export default function OlvideClave() {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="border-0 bg-transparent text-sm text-suave underline"
      >
        ¿Olvidaste tu contraseña?
      </button>
      {abierto && (
        <div className="mt-2 space-y-2 rounded-xl border border-borde bg-tarjeta p-3 text-left text-sm">
          <p>
            Escríbele al organizador por WhatsApp <strong>desde el mismo número con el que te
            registraste</strong>. Te dará una contraseña temporal y la app te pedirá crear una nueva.
          </p>
          {numeroValido ? (
            <a
              className="btn btn-activo w-full"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${WHATSAPP_AYUDA}?text=${encodeURIComponent(
                'Hola, olvidé mi contraseña de Fútbol LPZ. Mi nombre es: '
              )}`}
            >
              <MessageCircle size={16} /> Escribir al organizador
            </a>
          ) : (
            <p className="text-suave">Pídele al organizador que te restablezca la contraseña.</p>
          )}
        </div>
      )}
    </div>
  )
}