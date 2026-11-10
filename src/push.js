import { supabase } from './supabaseClient'

const CLAVE_PUBLICA = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim()

export const hayClave = () => CLAVE_PUBLICA !== ''

export const soportaPush = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

export const instalada = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

// Este celular ya se activó para esta cuenta
const clave = (userId) => `push_ok:${userId}`
const activadoAqui = (userId) => {
  try { return localStorage.getItem(clave(userId)) === '1' } catch { return false }
}
const marcar = (userId, valor) => {
  try {
    if (valor) localStorage.setItem(clave(userId), '1')
    else localStorage.removeItem(clave(userId))
  } catch { /* sin almacenamiento */ }
}

function aBytes(base64Url) {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  const bruto = atob(base64)
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)))
}

// La clave pública de avisos debe medir 65 bytes (87 caracteres) y empezar con la letra B
export function revisarClave() {
  try {
    const b = aBytes(CLAVE_PUBLICA)
    return { ok: b.length === 65 && b[0] === 4, largo: CLAVE_PUBLICA.length }
  } catch {
    return { ok: false, largo: CLAVE_PUBLICA.length }
  }
}

// En la versión de desarrollo no hay servicio activo: se espera un poco y se avisa
function swListo(ms = 4000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('sw')), ms)),
  ])
}

export function explicarError(e) {
  const nombre = e?.name ?? ''
  const msg = e?.message ?? ''
  if (nombre === 'AbortError' || /push service error/i.test(msg)) {
    return 'Tu navegador no pudo conectarse con el servicio de notificaciones. Prueba con otra red (por ejemplo, datos móviles). Si usas Brave, activa "Usar los servicios de Google para mensajes push" en Ajustes → Privacidad. En celulares sin servicios de Google (como algunos Huawei) los avisos no funcionan.'
  }
  if (nombre === 'InvalidAccessError') {
    return 'La clave de avisos de la app no es válida. Revisa VITE_VAPID_PUBLIC_KEY.'
  }
  if (nombre === 'NotAllowedError') {
    return 'El permiso de notificaciones no está permitido en este navegador.'
  }
  return msg || 'No se pudo activar los avisos.'
}

// ¿La suscripción del celular se creó con la clave actual?
function mismaClave(sub) {
  const k = sub?.options?.applicationServerKey
  if (!k) return false
  const a = new Uint8Array(k)
  const b = aBytes(CLAVE_PUBLICA)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

// Reutiliza la suscripción si es de la clave actual; si no, la reemplaza
async function suscribir(reg) {
  let sub = await reg.pushManager.getSubscription()
  if (sub && !mismaClave(sub)) {
    await sub.unsubscribe()
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: aBytes(CLAVE_PUBLICA),
    })
  }
  return sub
}

// 'sin-clave' | 'ios-instalar' | 'no-soportado' | 'bloqueado' | 'inactivo' | 'activo'
export async function estadoPush(userId) {
  if (!hayClave()) return 'sin-clave'
  if (esIOS() && !instalada()) return 'ios-instalar'
  if (!soportaPush()) return 'no-soportado'
  if (Notification.permission === 'denied') return 'bloqueado'
  if (Notification.permission === 'granted' && activadoAqui(userId)) {
    try {
      const reg = await swListo()
      const sub = await reg.pushManager.getSubscription()
      if (sub && mismaClave(sub)) return 'activo'
    } catch { /* se ofrece activar de nuevo */ }
  }
  return 'inactivo'
}

// ¿Conviene invitar a activar los avisos? (para la pista junto a "Avísame")
export function pushPendiente() {
  if (!hayClave()) return false
  if (esIOS() && !instalada()) return true
  return soportaPush() && Notification.permission === 'default'
}

async function registrar(sub) {
  const j = sub.toJSON()
  const { error } = await supabase.rpc('guardar_suscripcion_push', {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
    p_agente: navigator.userAgent.slice(0, 200),
  })
  if (error) throw new Error(error.message)
}

// Debe llamarse directamente desde un toque del usuario (así lo exigen los navegadores)
export async function activarPush(userId) {
  if (!hayClave() || !soportaPush()) throw new Error('Este navegador no permite avisos.')
  if (!revisarClave().ok) {
    throw new Error(
      'La clave de avisos de la app está mal copiada: debe medir 87 caracteres y empezar con la letra B. Revisa VITE_VAPID_PUBLIC_KEY en Vercel.'
    )
  }
  const permiso = await Notification.requestPermission()
  if (permiso === 'denied') throw new Error('bloqueado')
  if (permiso !== 'granted') throw new Error('No diste el permiso. Toca el botón otra vez cuando quieras.')

  let reg
  try {
    reg = await swListo(6000)
  } catch {
    throw new Error('La app todavía se está preparando. Ciérrala, ábrela de nuevo y prueba otra vez.')
  }

  let sub
  try {
    sub = await suscribir(reg)
  } catch (e) {
    throw new Error(`${explicarError(e)} (Detalle: ${e?.name}: ${e?.message})`)
  }
  await registrar(sub)
  marcar(userId, true)
}

export async function desactivarPush(userId) {
  try {
    const reg = await swListo(3000)
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.rpc('quitar_suscripcion_push', { p_endpoint: sub.endpoint })
      await sub.unsubscribe()
    }
  } catch { /* igual se marca como desactivado */ }
  marcar(userId, false)
}

// Al cerrar sesión: este celular deja de recibir los avisos de esa cuenta
export async function desvincularDispositivo() {
  try {
    if (!soportaPush()) return
    const reg = await swListo(1500)
    const sub = await reg.pushManager.getSubscription()
    if (sub) await supabase.rpc('quitar_suscripcion_push', { p_endpoint: sub.endpoint })
  } catch { /* si falla, no se bloquea el cierre de sesión */ }
}

// Al entrar: si esta cuenta ya había activado los avisos en este celular, se reconecta sola
export async function sincronizarPush(userId) {
  try {
    if (!hayClave() || !soportaPush() || Notification.permission !== 'granted') return
    if (!activadoAqui(userId) || !revisarClave().ok) return
    const reg = await swListo(8000)
    await registrar(await suscribir(reg))
  } catch { /* se reintenta en la próxima entrada */ }
}

export async function probarPush() {
  const { error } = await supabase.rpc('probar_push')
  if (error) throw new Error(error.message)
}

// Revisa cada pieza y devuelve qué está bien y qué no
export async function diagnosticar() {
  const r = {
    clave: revisarClave(),
    soporte: soportaPush(),
    ios: esIOS(),
    instalada: instalada(),
    permiso: soportaPush() ? Notification.permission : 'no disponible',
    sw: null,
    swResponde: false,
    suscripcion: null,
    servidor: null,
  }
  if (soportaPush()) {
    try {
      const reg = await swListo(3000)
      r.sw = { script: reg.active?.scriptURL?.split('/').pop() ?? null, esperando: !!reg.waiting }
      // El servicio nuevo responde a este mensaje; el viejo no
      r.swResponde = await new Promise((resolver) => {
        const alRecibir = (ev) => {
          if (ev.data?.type === 'PONG') {
            clearTimeout(espera)
            navigator.serviceWorker.removeEventListener('message', alRecibir)
            resolver(true)
          }
        }
        const espera = setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', alRecibir)
          resolver(false)
        }, 1500)
        navigator.serviceWorker.addEventListener('message', alRecibir)
        reg.active?.postMessage({ type: 'PING' })
      })
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        r.suscripcion = { servicio: new URL(sub.endpoint).host, claveCorrecta: mismaClave(sub) }
      }
    } catch { /* sw queda en null */ }
  }
  const { data } = await supabase.rpc('mis_dispositivos_push')
  r.servidor = typeof data === 'number' ? data : null
  return r
}

// Instala la versión nueva de la app si existe. Devuelve qué pasó.
export async function actualizarServicio() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 'sin-servicio'
  if (!reg.waiting) {
    try { await reg.update() } catch { return 'sin-conexion' }
    const nuevo = reg.installing
    if (nuevo) {
      await new Promise((resolver) => {
        const fin = () => {
          if (['installed', 'activated', 'redundant'].includes(nuevo.state)) resolver()
        }
        nuevo.addEventListener('statechange', fin)
        fin()
        setTimeout(resolver, 8000)
      })
    }
  }
  if (!reg.waiting) return 'sin-cambios'
  await new Promise((resolver) => {
    navigator.serviceWorker.addEventListener('controllerchange', resolver, { once: true })
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(resolver, 6000)
  })
  window.location.reload()
  return 'actualizada'
}

// Borra el servicio de la app y su memoria, y lo instala de cero.
// Los avisos hay que volver a activarlos después.
export async function repararServicio() {
  try {
    const registros = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registros.map((r) => r.unregister()))
    if ('caches' in window) {
      const nombres = await caches.keys()
      await Promise.all(nombres.map((n) => caches.delete(n)))
    }
  } catch { /* igual se recarga */ }
  window.location.reload()
}