import { useState } from 'react'
import { Download } from 'lucide-react'
import Rueda from './Rueda'
import { sinTildes } from './formato'

const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export default function DescargarQR({ url, nombre }) {
  const [trabajando, setTrabajando] = useState(false)
  const [aviso, setAviso] = useState(null)

  async function descargar() {
    setAviso(null)
    setTrabajando(true)
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error('No se pudo obtener la imagen')
      const original = await resp.blob()
      const tipo = original.type.startsWith('image/') ? original.type : 'image/png'
      const blob = new Blob([original], { type: tipo })
      const base = sinTildes(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pago'
      const archivo = `qr-${base}.${EXT[tipo] ?? 'png'}`

      // iPhone: el menú de compartir permite "Guardar imagen" directo en Fotos
      if (esIOS() && navigator.canShare) {
        const file = new File([blob], archivo, { type: tipo })
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file] })
          } catch (e) {
            if (e.name !== 'AbortError') throw e // cerrar el menú no es un error
          }
          return
        }
      }

      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = archivo
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 10000)
    } catch {
      setAviso('No pudimos descargarlo. Mantén presionado el QR y elige "Guardar imagen".')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="space-y-1">
      <button onClick={descargar} disabled={trabajando} className="btn w-full">
        {trabajando ? <><Rueda size={16} /> Preparando...</> : <><Download size={18} /> Descargar QR</>}
      </button>
      {aviso && <p className="text-sm text-suave">{aviso}</p>}
    </div>
  )
}