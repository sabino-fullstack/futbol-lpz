import { supabase } from './supabaseClient'

// Dominio inventado para armar el correo interno. Se cambia tras la prueba.
const DOMINIO = 'futbollpz.app'

// Acepta "71234567" o "59171234567" y devuelve siempre "59171234567"
export function normalizarNumero(texto) {
  const d = texto.replace(/\D/g, '')
  if (d.length === 8) return '591' + d
  if (d.length === 11 && d.startsWith('591')) return d
  return null
}

const aCorreo = (numero) => `${numero}@${DOMINIO}`

export async function registrar({ nombre, apellido, apodo, numero, contrasena }) {
  const n = normalizarNumero(numero)
  if (!n) return { error: { message: 'Escribe tu número de 8 dígitos' } }
  return supabase.auth.signUp({
    email: aCorreo(n),
    password: contrasena,
    options: {
      data: {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        apodo: apodo.trim(),
        whatsapp: n,
      },
    },
  })
}
export async function entrar({ numero, contrasena }) {
  const n = normalizarNumero(numero)
  if (!n) return { error: { message: 'Escribe un número de 8 dígitos' } }
  return supabase.auth.signInWithPassword({
    email: aCorreo(n),
    password: contrasena,
  })
}

export const salir = () => supabase.auth.signOut()