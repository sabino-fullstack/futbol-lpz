import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// dentro de plugins: [ react(), tailwindcss(), ... ]


export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
  registerType: 'prompt',
  includeAssets: ['apple-touch-icon.png', 'favicon.png'],
  manifest: {
    name: 'Fútbol LPZ',
    short_name: 'Fútbol LPZ',
    description: 'Reserva tu cupo en los partidos de Fútbol LPZ',
    lang: 'es',
    start_url: '/partidos',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0d10',
    theme_color: '#0b0d10',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: { cleanupOutdatedCaches: true },
}),],
})
// https://vite.dev/config/

