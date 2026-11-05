import { useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from './supabaseClient'
import Rueda from './Rueda'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const POSICIONES = [['jugador', 'Jugador de campo'], ['arquero', 'Arquero'], ['ambos', 'Ambos']]
const ORIGENES = [
  ['grupo_whatsapp', 'Grupo de WhatsApp'], ['amigo', 'Un amigo o conocido'],
  ['redes', 'Redes sociales'], ['otro', 'Otro'],
]

function partes(fecha) {
  if (!fecha) return { dia: '', mes: '', anio: '' }
  const [a, m, d] = fecha.split('-')
  return { dia: String(Number(d)), mes: String(Number(m)), anio: a }
}

export default function PerfilForm({ inicial, zonas, onGuardado }) {
  const f0 = partes(inicial?.fecha_nacimiento)
  const [zona, setZona] = useState(inicial?.zona_id ?? (inicial?.zona_otra ? '__otra' : ''))
  const [otra, setOtra] = useState(inicial?.zona_otra ?? '')
  const [dia, setDia] = useState(f0.dia)
  const [mes, setMes] = useState(f0.mes)
  const [anio, setAnio] = useState(f0.anio)
  const [posicion, setPosicion] = useState(inicial?.posicion_habitual ?? '')
  const [origen, setOrigen] = useState(inicial?.como_se_entero ?? '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [ok, setOk] = useState(false)

  const anioActual = new Date().getFullYear()
  const anios = Array.from({ length: 96 }, (_, i) => anioActual - 5 - i)

  // Zonas activas (y la que la persona ya tenía, aunque ahora esté oculta)
  const visibles = zonas.filter((z) => z.activa || z.id === inicial?.zona_id)
  const ordenar = (a, b) => a.nombre.localeCompare(b.nombre, 'es')
  const normales = visibles.filter((z) => z.orden < 900).sort(ordenar)
  const especiales = visibles.filter((z) => z.orden >= 900).sort(ordenar)

  async function guardar() {
    setError(null)
    setOk(false)
    let nacimiento = null
    if (dia || mes || anio) {
      if (!dia || !mes || !anio) {
        return setError('Completa el día, el mes y el año de tu fecha de nacimiento.')
      }
      const d = Number(dia), m = Number(mes), a = Number(anio)
      const t = new Date(Date.UTC(a, m - 1, d))
      if (t.getUTCFullYear() !== a || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) {
        return setError('Esa fecha no existe. Revisa el día y el mes.')
      }
      nacimiento = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
    const otraTxt = zona === '__otra' ? otra.trim() : ''
    if (zona === '__otra' && otraTxt.length < 2) return setError('Escribe el nombre de tu zona.')

    setGuardando(true)
    const { error } = await supabase.rpc('guardar_mi_perfil', {
      p_zona: zona && zona !== '__otra' ? zona : null,
      p_zona_otra: zona === '__otra' ? otraTxt : null,
      p_nacimiento: nacimiento,
      p_posicion: posicion || null,
      p_origen: origen || null,
    })
    setGuardando(false)
    if (error) return setError(error.message)
    setOk(true)
    onGuardado?.()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="font-semibold">¿En qué zona vives?</p>
        <select className="w-full" value={zona} onChange={(e) => setZona(e.target.value)}>
          <option value="">Prefiero no decirlo</option>
          {normales.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          {especiales.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
          <option value="__otra">Otra (escribirla)</option>
        </select>
        {zona === '__otra' && (
          <input
            className="w-full"
            placeholder="Escribe tu zona"
            maxLength={60}
            value={otra}
            onChange={(e) => setOtra(e.target.value)}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <p className="font-semibold">Fecha de nacimiento</p>
        <div className="flex gap-2">
          <select aria-label="Día" value={dia} onChange={(e) => setDia(e.target.value)} className="w-20">
            <option value="">Día</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select aria-label="Mes" value={mes} onChange={(e) => setMes(e.target.value)} className="min-w-0 flex-1">
            <option value="">Mes</option>
            {MESES.map((nombre, i) => <option key={nombre} value={i + 1}>{nombre}</option>)}
          </select>
          <select aria-label="Año" value={anio} onChange={(e) => setAnio(e.target.value)} className="w-24">
            <option value="">Año</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="font-semibold">¿Cómo juegas normalmente?</p>
        <div className="flex flex-wrap gap-2">
          {POSICIONES.map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={posicion === id}
              onClick={() => setPosicion(posicion === id ? '' : id)}
              className={posicion === id ? 'border-transparent bg-verde text-sobre-verde' : ''}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="font-semibold">¿Cómo te enteraste de Fútbol LPZ?</p>
        <select className="w-full" value={origen} onChange={(e) => setOrigen(e.target.value)}>
          <option value="">Prefiero no decirlo</option>
          {ORIGENES.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
        </select>
      </div>

      <p className="text-sm text-suave">
        Usamos estas respuestas solo para decidir en qué zonas abrir más partidos y cómo organizarlos.
        Los demás jugadores y los encargados no las ven; el organizador solo ve conteos generales.
        Puedes cambiarlas o borrarlas cuando quieras.
      </p>

      {error && <p className="aviso aviso-error">{error}</p>}
      {ok && (
        <p className="aviso aviso-ok flex items-center gap-2">
          <Check size={18} /> Guardado. ¡Gracias!
        </p>
      )}

      <button onClick={guardar} disabled={guardando} className="btn btn-primario">
        {guardando ? <><Rueda /> Guardando...</> : 'Guardar'}
      </button>
    </div>
  )
}