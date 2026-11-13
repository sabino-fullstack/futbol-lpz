import { useEffect, useState } from 'react'
import { Check, Copy, Users } from 'lucide-react'

export default function QrGrupo({ enlace }) {
  const [imagen, setImagen] = useState(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vivo = true
    import('qrcode')
      .then((m) => (m.default ?? m).toDataURL(enlace, { width: 320, margin: 2, errorCorrectionLevel: 'M' }))
      .then((url) => { if (vivo) setImagen(url) })
      .catch(() => {})
    return () => { vivo = false }
  }, [enlace])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* se puede copiar a mano */ }
  }

  return (
    <div className="space-y-3">
      <a className="btn btn-primario" href={enlace} target="_blank" rel="noreferrer">
        <Users size={20} /> Unirme al grupo
      </a>
      <div className="space-y-2 text-center">
        {imagen ? (
          <img src={imagen} alt="Código QR del grupo de WhatsApp" className="mx-auto h-48 w-48 rounded-xl bg-white p-2" />
        ) : (
          <div className="mx-auto h-48 w-48 rounded-xl bg-borde motion-safe:animate-pulse" />
        )}
        <p className="text-sm text-suave">
          Si estás en otro dispositivo, escanea este código con la cámara del celular.
        </p>
      </div>
      <button onClick={copiar} className="w-full">
        {copiado ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar enlace</>}
      </button>
    </div>
  )
}