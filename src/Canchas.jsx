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

export default function Canchas({ canchas, onCambio }) {
  const [nombre, setNombre] = useState('')
  const [enlace, setEnlace] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [clave, setClave] = useState(0) // para vaciar el selector de archivo
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  async function crear() {
    setError(null)
    const n = nombre.trim()
    const e = enlace.trim()
    if (!n) return setError('Escribe el nombre de la cancha')
    if (!enlaceValido(e)) return setError('El enlace debe empezar con https://')

    setTrabajando(true)
    try {
      const foto_url = archivo ? await subirFoto(archivo) : null
      const { error } = await supabase
        .from('canchas')
        .insert({ nombre: n, enlace_maps: e || null, foto_url })
      if (error) {
        await borrarFoto(foto_url) // no dejar fotos huérfanas
        throw new Error(
          error.code === '23505' ? 'Ya existe una cancha con ese nombre' : error.message
        )
      }
      setNombre('')
      setEnlace('')
      setArchivo(null)
      setClave(clave + 1)
      onCambio()
    } catch (err) {
      setError(err.message)
    }
    setTrabajando(false)
  }

  async function actualizar(id, cambios) {
    setError(null)
    const { data, error } = await supabase
      .from('canchas').update(cambios).eq('id', id).select('id')
    if (error) return setError(error.message)
    if (!data?.length) return setError('No se pudo guardar el cambio')
    onCambio()
  }

  async function editarEnlace(c) {
    const texto = window.prompt(
      'Enlace de Google Maps (déjalo vacío para quitarlo):',
      c.enlace_maps ?? ''
    )
    if (texto === null) return
    const e = texto.trim()
    if (!enlaceValido(e)) return setError('El enlace debe empezar con https://')
    await actualizar(c.id, { enlace_maps: e || null })
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
    <div>
      {error && <p>{error}</p>}
      {trabajando && <p>Procesando...</p>}

      <h4>Nueva cancha</h4>
      <input placeholder="Nombre (ej. Munaypata)" value={nombre}
        onChange={(e) => setNombre(e.target.value)} />
      <input placeholder="Enlace de Google Maps (opcional)" value={enlace}
        onChange={(e) => setEnlace(e.target.value)} />
      <label>
        Foto (opcional):{' '}
        <input
          key={clave}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setArchivo(e.target.files[0] ?? null)}
        />
      </label>
      <button disabled={trabajando} onClick={crear}>Crear cancha</button>

      <h4>Canchas creadas</h4>
      {canchas.length === 0 && <p>Todavía no hay canchas.</p>}
      {canchas.map((c) => (
        <div key={c.id}>
          <strong>{c.nombre}</strong>
          {c.foto_url
            ? <div><img src={c.foto_url} alt={c.nombre} width="220" /></div>
            : <p>Sin foto</p>}
          {c.enlace_maps
            ? <p><a href={c.enlace_maps} target="_blank" rel="noreferrer">Ver en Google Maps</a></p>
            : <p>Sin enlace de Maps</p>}
          <button disabled={trabajando} onClick={() => editarEnlace(c)}>Editar enlace</button>{' '}
          <label>
            Cambiar foto:{' '}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={trabajando}
              onChange={(e) => {
                cambiarFoto(c, e.target.files[0])
                e.target.value = ''
              }}
            />
          </label>{' '}
          <button disabled={trabajando} onClick={() => eliminar(c)}>Eliminar</button>
          <hr />
        </div>
      ))}
    </div>
  )
}