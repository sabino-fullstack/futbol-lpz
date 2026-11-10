import { useEffect, useState } from 'react'
import { Camera, ExternalLink, Info, MapPin, Navigation, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { supabase } from './supabaseClient'
import Rueda from './Rueda'
import { reducirImagen } from './imagen'

const CACHE = '31536000' // los archivos tienen nombre único: el navegador puede guardarlos un año

async function subir(blob, ruta) {
  const { error } = await supabase.storage
    .from('canchas')
    .upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: CACHE })
  if (error) throw new Error('No se pudo subir la foto: ' + error.message)
  return supabase.storage.from('canchas').getPublicUrl(ruta).data.publicUrl
}

async function borrarFotos(...urls) {
  const rutas = urls.filter((u) => u && u.includes('/canchas/')).map((u) => u.split('/canchas/')[1])
  if (rutas.length === 0) return
  const { data, error } = await supabase.storage.from('canchas').remove(rutas)
  if (error || (data?.length ?? 0) < rutas.length) {
    console.warn('No se pudieron borrar todas las fotos', error, rutas)
  }
}

// Sube la foto grande y la miniatura
async function subirFotos(archivo) {
  const base = crypto.randomUUID()
  const grande = await reducirImagen(archivo, 960, 0.75)
  const mini = await reducirImagen(archivo, 480, 0.7)
  const foto_url = await subir(grande, `${base}.jpg`)
  try {
    const foto_mini_url = await subir(mini, `${base}-mini.jpg`)
    return { foto_url, foto_mini_url }
  } catch (e) {
    await borrarFotos(foto_url)
    throw e
  }
}

const enlaceValido = (texto) => texto === '' || /^https:\/\//i.test(texto)
const nn = (s) => (s.trim() === '' ? null : s.trim())

function Campo({ Icono, etiqueta, children }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        <Icono size={15} className="text-verde" /> {etiqueta}
      </span>
      {children}
    </label>
  )
}

function FormCancha({ inicial, conFoto, textoBoton, onGuardar, onCancelar }) {
  const [f, setF] = useState({
    nombre: inicial?.nombre ?? '',
    enlace: inicial?.enlace_maps ?? '',
    direccion: inicial?.direccion ?? '',
    referencia: inicial?.referencia ?? '',
    recomendaciones: inicial?.recomendaciones ?? '',
  })
  const [archivo, setArchivo] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (campo) => (e) => setF({ ...f, [campo]: e.target.value })

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])

  function elegir(e) {
    const a = e.target.files[0] ?? null
    setArchivo(a)
    setPrevia(a ? URL.createObjectURL(a) : null)
  }

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
    <div className="space-y-3">
      <Campo Icono={MapPin} etiqueta="Nombre de la cancha">
        <input
          className="w-full"
          placeholder="Ej. Munaypata"
          value={f.nombre}
          onChange={set('nombre')}
          disabled={!!inicial}
        />
      </Campo>
      <Campo Icono={ExternalLink} etiqueta="Enlace de Google Maps (opcional)">
        <input className="w-full" placeholder="https://maps.app.goo.gl/..." value={f.enlace} onChange={set('enlace')} />
      </Campo>
      <Campo Icono={Navigation} etiqueta="Dirección escrita">
        <input
          className="w-full"
          placeholder="Ej. Av. ... esquina ..."
          maxLength={200}
          value={f.direccion}
          onChange={set('direccion')}
        />
      </Campo>
      <Campo Icono={Navigation} etiqueta="Referencia">
        <input
          className="w-full"
          placeholder="Ej. frente a la plaza, a una cuadra del mercado"
          maxLength={200}
          value={f.referencia}
          onChange={set('referencia')}
        />
      </Campo>
      <Campo Icono={Info} etiqueta="Recomendaciones">
        <textarea
          rows={4}
          maxLength={600}
          placeholder="Parqueo, vestuarios, qué llevar..."
          value={f.recomendaciones}
          onChange={set('recomendaciones')}
        />
      </Campo>

      {conFoto && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-borde p-3">
          {previa ? (
            <img src={previa} alt="Vista previa" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-borde text-suave">
              <Camera size={26} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{previa ? 'Cambiar la foto' : 'Elegir una foto'}</span>
            <span className="block text-xs text-suave">Opcional. Se reduce sola para que cargue rápido.</span>
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={elegir}
          />
        </label>
      )}

      {error && <p className="aviso aviso-error">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-activo" disabled={guardando} onClick={guardar}>
          {guardando ? <><Rueda size={16} /> Guardando...</> : textoBoton}
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
  const [migrando, setMigrando] = useState(null) // { hecho, total }

  const sinMini = canchas.filter((c) => c.foto_url && !c.foto_mini_url)

  async function crear(d, archivo) {
    let fotos = { foto_url: null, foto_mini_url: null }
    try {
      if (archivo) fotos = await subirFotos(archivo)
      const { error } = await supabase.from('canchas').insert({ ...d, ...fotos })
      if (error) {
        await borrarFotos(fotos.foto_url, fotos.foto_mini_url)
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
      const nuevas = await subirFotos(archivoNuevo)
      const { data, error } = await supabase.from('canchas').update(nuevas).eq('id', c.id).select('id')
      if (error || !data?.length) {
        await borrarFotos(nuevas.foto_url, nuevas.foto_mini_url)
        throw new Error(error?.message ?? 'No se pudo guardar la foto')
      }
      await borrarFotos(c.foto_url, c.foto_mini_url) // el orden importa: borrar las viejas al final
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
    const { data, error } = await supabase.from('canchas').delete().eq('id', c.id).select('id')
    if (error) return setError(error.message)
    if (!data?.length) return setError('No se pudo eliminar')
    await borrarFotos(c.foto_url, c.foto_mini_url)
    onCambio()
  }

  // Crea la miniatura de las fotos que se subieron antes de que existieran
  async function crearMiniaturas() {
    setError(null)
    const lista = sinMini
    let fallos = 0
    setMigrando({ hecho: 0, total: lista.length })
    for (let i = 0; i < lista.length; i++) {
      const c = lista[i]
      try {
        const resp = await fetch(c.foto_url)
        if (!resp.ok) throw new Error('No se pudo leer la foto')
        const mini = await reducirImagen(await resp.blob(), 480, 0.7)
        const url = await subir(mini, `${crypto.randomUUID()}-mini.jpg`)
        const { data, error } = await supabase
          .from('canchas').update({ foto_mini_url: url }).eq('id', c.id).select('id')
        if (error || !data?.length) {
          await borrarFotos(url)
          throw new Error('No se pudo guardar')
        }
      } catch {
        fallos += 1
      }
      setMigrando({ hecho: i + 1, total: lista.length })
    }
    setMigrando(null)
    if (fallos > 0) {
      setError(`No se pudieron crear ${fallos} miniatura(s). Usa "Cambiar foto" en esas canchas.`)
    }
    onCambio()
  }

  return (
    <div className="space-y-4">
      {error && <p className="aviso aviso-error">{error}</p>}
      {trabajando && (
        <p className="flex items-center gap-2 text-sm text-suave"><Rueda size={16} /> Procesando la foto...</p>
      )}

      {sinMini.length > 0 && (
        <div className="aviso aviso-alerta flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm">
            {sinMini.length} cancha(s) tienen foto sin miniatura. Crearlas hace que la lista de partidos
            cargue más rápido.
          </p>
          <button disabled={migrando !== null} onClick={crearMiniaturas}>
            {migrando ? (
              <><Rueda size={16} /> {migrando.hecho} de {migrando.total}</>
            ) : (
              <><RefreshCw size={16} /> Crear miniaturas</>
            )}
          </button>
        </div>
      )}

      <div className="tarjeta space-y-3">
        <h3>Nueva cancha</h3>
        <FormCancha key={clave} conFoto textoBoton="Crear cancha" onGuardar={crear} />
      </div>

      <h3>Canchas creadas</h3>
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
          <div key={c.id} className="tarjeta space-y-3">
            <div className="flex gap-3">
              {c.foto_mini_url || c.foto_url ? (
                <img
                  src={c.foto_mini_url ?? c.foto_url}
                  alt={c.nombre}
                  className="h-24 w-24 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-borde text-suave">
                  <Camera size={28} />
                </span>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-display text-2xl font-bold uppercase leading-tight">{c.nombre}</p>
                {c.direccion && (
                  <p className="flex items-start gap-1.5 text-sm">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-verde" />
                    <span className="break-words">{c.direccion}</span>
                  </p>
                )}
                {c.referencia && <p className="break-words text-sm text-suave">{c.referencia}</p>}
                {c.enlace_maps ? (
                  <a href={c.enlace_maps} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm">
                    <ExternalLink size={14} /> Ver en Google Maps
                  </a>
                ) : (
                  <p className="text-xs text-suave">Sin enlace de Maps</p>
                )}
              </div>
            </div>

            {c.recomendaciones && (
              <p className="whitespace-pre-line break-words rounded-lg bg-borde/40 p-2.5 text-sm">
                {c.recomendaciones}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                disabled={trabajando}
                onClick={() => setEditandoId(c.id)}
                className="flex h-auto flex-col gap-0.5 py-2 text-xs"
              >
                <Pencil size={18} /> Editar
              </button>
              <label className={`btn h-auto cursor-pointer flex-col gap-0.5 py-2 text-xs ${trabajando ? 'opacity-50' : ''}`}>
                <Camera size={18} /> Cambiar foto
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
              <button
                disabled={trabajando}
                onClick={() => eliminar(c)}
                className="btn-peligro flex h-auto flex-col gap-0.5 py-2 text-xs"
              >
                <Trash2 size={18} /> Eliminar
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}