import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from './supabaseClient'

export default function MisPartidos({ perfilId }) {
  const [asignaciones, setAsignaciones] = useState([])
  const [cargado, setCargado] = useState(false)
  const [error, setError] = useState(null)
  const [subiendo, setSubiendo] = useState(null)

  async function cargar() {
    const { data, error } = await supabase
      .from('encargados')
      .select('id, partido_id, qr_url, cuota_bonificada, partidos(cancha, fecha, hora, cuota, estado)')
      .eq('perfil_id', perfilId)
    if (error) return setError(error.message)
    setAsignaciones(data.filter((a) => a.partidos?.estado !== 'cancelado'))
    setCargado(true)
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

  if (!cargado && !error) return <p className="text-suave">Cargando...</p>

 return (
  <div className="space-y-4">
    <h2 className="text-xl font-bold">Mis partidos a cargo</h2>
    {error && <p className="aviso aviso-error">{error}</p>}
    {cargado && asignaciones.length === 0 && (
      <p className="text-suave">No tienes partidos asignados.</p>
    )}

    {asignaciones.map((a) => (
      <div key={a.id} className="tarjeta space-y-3">
        <div>
          <h3 className="text-lg font-bold">{a.partidos.cancha}</h3>
          <p className="text-suave">{a.partidos.fecha} · {a.partidos.hora.slice(0, 5)}</p>
        </div>

        {a.qr_url ? (
          <img src={a.qr_url} alt="Tu QR" className="mx-auto w-56 max-w-full rounded-lg bg-white p-2" />
        ) : (
          <p className="aviso aviso-alerta">
            Aún no subiste tu QR. Los jugadores no podrán pagarte hasta que lo subas.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <label className="btn cursor-pointer">
            {subiendo === a.id ? 'Subiendo...' : a.qr_url ? 'Cambiar QR' : 'Subir QR'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={subiendo === a.id}
              onChange={(e) => subirQR(a, e.target.files[0])}
            />
          </label>
          <Link to={`/a-cargo/${a.partido_id}`} className="btn btn-activo">Gestionar lista</Link>
        </div>
      </div>
    ))}
  </div>
)
}