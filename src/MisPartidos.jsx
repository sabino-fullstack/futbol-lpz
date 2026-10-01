import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function MisPartidos({ perfilId }) {
  const [asignaciones, setAsignaciones] = useState([])
  const [error, setError] = useState(null)
  const [subiendo, setSubiendo] = useState(null) // id de la asignación en curso

  async function cargar() {
    const { data, error } = await supabase
      .from('encargados')
      .select('id, qr_url, cuota_bonificada, partidos(cancha, fecha, hora, cuota, estado)')
      .eq('perfil_id', perfilId)
    if (error) return setError(error.message)
    setAsignaciones(data.filter((a) => a.partidos?.estado !== 'cancelado'))
  }

  useEffect(() => { cargar() }, [])

  async function subirQR(asignacion, archivo) {
    if (!archivo) return
    setError(null)
    setSubiendo(asignacion.id)

    const ext = archivo.name.split('.').pop().toLowerCase()
    const ruta = `${perfilId}/${asignacion.id}-${Date.now()}.${ext}`

    const { error: errSubida } = await supabase.storage
      .from('qrs')
      .upload(ruta, archivo, { contentType: archivo.type })
    if (errSubida) {
      setSubiendo(null)
      return setError('No se pudo subir: ' + errSubida.message)
    }

    const { data } = supabase.storage.from('qrs').getPublicUrl(ruta)
    const { error: errGuardar } = await supabase
      .from('encargados')
      .update({ qr_url: data.publicUrl })
      .eq('id', asignacion.id)
    if (errGuardar) {
      setSubiendo(null)
      return setError('Se subió, pero no se guardó: ' + errGuardar.message)
    }

    // Borra el QR anterior para no acumular archivos
if (asignacion.qr_url?.includes('/qrs/')) {
  const rutaVieja = asignacion.qr_url.split('/qrs/')[1]
  const { data: borrados, error: errBorrar } = await supabase.storage
    .from('qrs')
    .remove([rutaVieja])
  if (errBorrar || !borrados?.length) {
    console.warn('No se pudo borrar el QR anterior', errBorrar, rutaVieja)
  }
}

    setSubiendo(null)
    cargar()
  }

  return (
    <div>
      <h2>Mis partidos a cargo</h2>
      {error && <p>{error}</p>}
      {asignaciones.length === 0 && <p>No tienes partidos asignados.</p>}

      {asignaciones.map((a) => (
        <div key={a.id}>
          <h3>{a.partidos.cancha} · {a.partidos.fecha} · {a.partidos.hora.slice(0, 5)}</h3>
          <p>Cuota: {a.partidos.cuota} Bs</p>

          {a.qr_url ? (
            <img src={a.qr_url} alt="Tu QR" width="200" />
          ) : (
            <p>Aún no subiste tu QR. Los jugadores no podrán pagarte hasta que lo subas.</p>
          )}

          <label>
            {a.qr_url ? 'Cambiar QR: ' : 'Subir QR: '}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={subiendo === a.id}
              onChange={(e) => subirQR(a, e.target.files[0])}
            />
          </label>
          {subiendo === a.id && <p>Subiendo...</p>}
        </div>
      ))}
    </div>
  )
}