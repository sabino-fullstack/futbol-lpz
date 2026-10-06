import { useState } from 'react'
import { supabase } from './supabaseClient'
import { reducirImagen } from './imagen'

async function subirFoto(archivo) {
  const blob = await reducirImagen(archivo)
  const ruta = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('canchas')
    .upload(ruta, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error('No se pudo subir la foto: ' + error.message)
  return supabase.storage.from('canchas').getPublicUrl(ruta).data.publicUrl
}

async function borrarFoto(url) {
  if (!url || !url.includes('/canchas/')) return
  const ruta = url.split('/canchas/')[1]
  const { data, error } = await supabase.storage.from('canchas').remove([ruta])
  if (error || !data?.length) console.warn('No se pudo borrar la foto', error, ruta)
}

const enlaceValido = (texto) => texto === '' || /^https:\/\//i.test(texto)
const nn = (s) => (s.trim() === '' ? null : s.trim())

function FormCancha({ inicial, conFoto, textoBoton, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    nombre: inicial?.nombre ?? '',
    enlace: inicial?.enlace_maps ?? '',
    direccion: inicial?.direccion ?? '',
    referencia: inicial?.referencia ?? '',
    recomendaciones: inicial?.recomendaciones ?? '',
  })
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (campo) => (e) => setF({ ...f, [campo]: e.target.value })

  async function guardar() {
    setError(null)
    if (!f.nombre.trim()) return setError('Escribe el nombre de la cancha')
    if (!enlaceValido(f.enlace.trim())) return setError('El enlace debe empezar con https://')
    setGuardando(true)
    const msg = await onGuardar(
      {
        nombre: f.nombre.trim(),
        enlace_maps: nn(f.enlace),
        direccion: nn(f.direccion),
        referencia: nn(f.referencia),
        recomendaciones: nn(f.recomendaciones),
      },
      archivo
    )
    setGuardando(false)
    if (msg) setError(msg)
  }

  return (
    <div className="space-y-2">
      <input
        placeholder="Nombre (ej. Munaypata)"
        value={f.nombre}
        onChange={set('nombre')}
        disabled={!!inicial}
      />
      <input placeholder="Enlace de Google Maps (opcional)" value={f.enlace} onChange={set('enlace')} />
      <input
        placeholder="Dirección escrita (ej. Av. ... esquina ...)"
        maxLength={200}
        value={f.direccion}
        onChange={set('direccion')}
      />
      <input
        placeholder="Referencia (ej. frente a la plaza, a una cuadra del mercado)"
        maxLength={200}
        value={f.referencia}
        onChange={set('referencia')}
      />
      <textarea
        rows={4}
        maxLength={600}
        placeholder="Recomendaciones de la cancha: parqueo, vestuarios, qué llevar..."
        value={f.recomendaciones}
        onChange={set('recomendaciones')}
      />
      {conFoto && (
        <label className="block">
          Foto (opcional):{' '}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setArchivo(e.target.files[0] ?? null)}
          />
        </label>
      )}
      {error && <p className="aviso aviso-error">{error}</p>}
      <div className="flex gap-2">
        <button disabled={guardando} onClick={guardar}>
          {guardando ? 'Guardando...' : textoBoton}
        </button>
        {onCancelar && <button onClick={onCancelar}>Cancelar</button>}
      </div>
    </div>
  )
}

export default function Canchas({ canchas, onCambio }) {
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [clave, setClave] = useState(0) // reinicia el formulario de nueva cancha

  async function crear(d, archivo) {
    let foto_url = null
    try {
      foto_url = archivo ? await subirFoto(archivo) : null
      const { error } = await supabase.from('canchas').insert({ ...d, foto_url })
      if (error) {
        await borrarFoto(foto_url)
        return error.code === '23505' ? 'Ya existe una cancha con ese nombre' : error.message
      }
      setClave(clave + 1)
      onCambio()
      return null
    } catch (err) {
      return err.message
    }
  }

  async function guardarEdicion(id, d) {
    const { data, error } = await supabase.from('canchas').update(d).eq('id', id).select('id')
    if (error) return error.code === '23505' ? 'Ya existe una cancha con ese nombre' : error.message
    if (!data?.length) return 'No se pudo guardar el cambio'
    setEditandoId(null)
    onCambio()
    return null
  }

  async function cambiarFoto(c, archivoNuevo) {
    if (!archivoNuevo) return
    setError(null)
    setTrabajando(true)
    try {
      const nueva = await subirFoto(archivoNuevo)
      const { data, error } = await supabase
        .from('canchas').update({ foto_url: nueva }).eq('id', c.id).select('id')
      if (error || !data?.length) {
        await borrarFoto(nueva)
        throw new Error(error?.message ?? 'No se pudo guardar la foto')
      }
      await borrarFoto(c.foto_url) // el orden importa: borrar la vieja al final
      onCambio()
    } catch (err) {
      setError(err.message)
    }
    setTrabajando(false)
  }

  async function eliminar(c) {
    if (!window.confirm(
      `¿Eliminar la cancha "${c.nombre}"? Los partidos ya creados conservarán el nombre, pero perderán la foto y el enlace.`
    )) return
    setError(null)
    const { data, error } = await supabase
      .from('canchas').delete().eq('id', c.id).select('id')
    if (error) return setError(error.message)
    if (!data?.length) return setError('No se pudo eliminar')
    await borrarFoto(c.foto_url)
    onCambio()
  }

  return (
    <div className="space-y-4">
      {error && <p className="aviso aviso-error">{error}</p>}
      {trabajando && <p className="text-suave">Procesando...</p>}

      <div className="tarjeta space-y-2">
        <h4 className="font-bold">Nueva cancha</h4>
        <FormCancha key={clave} conFoto textoBoton="Crear cancha" onGuardar={crear} />
      </div>

      <h4 className="font-bold">Canchas creadas</h4>
      {canchas.length === 0 && <p className="text-suave">Todavía no hay canchas.</p>}

      {canchas.map((c) =>
        editandoId === c.id ? (
          <div key={c.id} className="tarjeta">
            <FormCancha
              inicial={c}
              textoBoton="Guardar cambios"
              onGuardar={(d) => guardarEdicion(c.id, d)}
              onCancelar={() => setEditandoId(null)}
            />
          </div>
        ) : (
          <div key={c.id} className="tarjeta space-y-2">
            <strong className="text-lg">{c.nombre}</strong>
            {c.foto_url
              ? <img src={c.foto_url} alt={c.nombre} className="w-56 max-w-full rounded-lg" />
              : <p className="text-suave">Sin foto</p>}
            {c.direccion && <p className="break-words">📍 {c.direccion}</p>}
            {c.referencia && <p className="break-words text-sm text-suave">{c.referencia}</p>}
            {c.recomendaciones && (
              <p className="whitespace-pre-line break-words text-sm">{c.recomendaciones}</p>
            )}
            {c.enlace_maps
              ? <a href={c.enlace_maps} target="_blank" rel="noreferrer">Ver en Google Maps</a>
              : <p className="text-sm text-suave">Sin enlace de Maps</p>}
            <div className="flex flex-wrap gap-2">
              <button disabled={trabajando} onClick={() => setEditandoId(c.id)}>Editar datos</button>
              <label className="btn cursor-pointer">
                Cambiar foto
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={trabajando}
                  onChange={(e) => {
                    cambiarFoto(c, e.target.files[0])
                    e.target.value = ''
                  }}
                />
              </label>
              <button disabled={trabajando} onClick={() => eliminar(c)}>Eliminar</button>
            </div>
          </div>
        )
      )}
    </div>
  )
}