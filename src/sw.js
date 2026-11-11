import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

const VERSION_SW = 'avisos-1'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Cualquier dirección de la app abre su pantalla principal, salvo los archivos del propio servicio.
// Si esto fallara, el servicio igual debe instalarse (los avisos no dependen de ello).
try {
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('index.html'), {
      denylist: [/^\/sw\.js$/, /^\/workbox-/, /^\/manifest\.webmanifest$/, /^\/registerSW\.js$/],
    })
  )
} catch (e) {
  console.warn('No se pudo preparar la navegación de la app', e)
}

// Actualización de la app y respuesta al diagnóstico de la pantalla de avisos
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data && event.data.type === 'PING' && event.source) {
    event.source.postMessage({ type: 'PONG', push: true, version: VERSION_SW })
  }
})

// Llega un aviso: se muestra SIEMPRE una notificación (los navegadores lo exigen)
self.addEventListener('push', (event) => {
  let datos = {}
  try {
    datos = event.data ? event.data.json() : {}
  } catch {
    datos = {}
  }
  event.waitUntil(
    self.registration.showNotification(datos.titulo || 'Fútbol LPZ', {
      body: datos.cuerpo || 'Tienes un aviso nuevo.',
      icon: '/icon-192.png',
      tag: datos.tag || 'aviso',
      renotify: true,
      data: { url: datos.url || '/avisos' },
    })
  )
})

// Tocar el aviso abre la app en la pantalla correcta
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL(
    (event.notification.data && event.notification.data.url) || '/avisos',
    self.location.origin
  ).href

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const v of ventanas) {
        if (new URL(v.url).origin !== self.location.origin) continue
        try {
          await v.focus()
          if ('navigate' in v) {
            await v.navigate(destino)
            return
          }
        } catch {
          /* se intenta abrir una ventana nueva */
        }
      }
      await self.clients.openWindow(destino)
    })()
  )
})