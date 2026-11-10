import { supabase } from './supabaseClient'

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const hayClave = () => !!CLAVE_PUBLICA

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

// En la versión de desarrollo no hay servicio activo: se espera un poco y se avisa
function swListo(ms = 4000) {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('sw')), ms)),
  ])
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
      if (await reg.pushManager.getSubscription()) return 'activo'
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
  const permiso = await Notification.requestPermission()
  if (permiso === 'denied') throw new Error('bloqueado')
  if (permiso !== 'granted') throw new Error('No diste el permiso. Toca el botón otra vez cuando quieras.')

  let reg
  try {
    reg = await swListo(6000)
  } catch {
    throw new Error('La app todavía se está preparando. Ciérrala, ábrela de nuevo y prueba otra vez.')
  }
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: aBytes(CLAVE_PUBLICA),
    })
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
    if (!activadoAqui(userId)) return
    const reg = await swListo(8000)
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: aBytes(CLAVE_PUBLICA),
      })
    }
    await registrar(sub)
  } catch { /* se reintenta en la próxima entrada */ }
}

export async function probarPush() {
  const { error } = await supabase.rpc('probar_push')
  if (error) throw new Error(error.message)
}