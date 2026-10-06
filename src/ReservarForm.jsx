import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from './supabaseClient'
import Contador from './Contador'
import { bs, inicioPartido } from './formato'
import { useVolver } from './navegacion'

export default function ReservarForm({ perfil }) {
  const { partidoId } = useParams()
  const navigate = useNavigate()
  const volver = useVolver('/partidos')

  const [datos, setDatos] = useState(null) // null = cargando
  const [cantidad, setCantidad] = useState(1)
  const [nombres, setNombres] = useState([])
  const [yoArquero, setYoArquero] = useState(false)
  const [arqueros, setArqueros] = useState([])
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [p, lj, la, t, lim] = await Promise.all([
        supabase.from('partidos').select('*').eq('id', partidoId).maybeSingle(),
        supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'jugador' }),
        supabase.rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'arquero' }),
        supabase.rpc('tengo_cupo', { p_partido: partidoId }),
        supabase.from('limites_cuenta').select('max_cupos, max_grupos')
          .eq('nivel', perfil?.nivel ?? 'nuevo').single(),
      ])
      if (p.error || lj.error || t.error || !p.data) {
        return setDatos({ fallo: 'No encontramos ese partido.' })
      }
      setDatos({
        partido: p.data,
        libresJug: lj.data ?? 0,
        libresArq: p.data.cupos_arco > 0 ? (la.data ?? 0) : 0,
        yaTengo: t.data === true,
        limite: lim.data ?? null,
      })
    }
    cargar()
  }, [partidoId])

  if (!datos) return <p className="text-suave">Cargando...</p>
  if (datos.fallo) {
    return (
      <div className="space-y-3">
        <p>{datos.fallo}</p>
        <button onClick={volver}>← Volver</button>
      </div>
    )
  }

  const { partido, libresJug, libresArq, yaTengo, limite } = datos
  if (partido.estado !== 'abierto' || inicioPartido(partido).getTime() <= Date.now()) {
    return (
      <div className="space-y-3">
        <p>Este partido ya no acepta reservas.</p>
        <button onClick={volver}>← Volver</button>
      </div>
    )
  }

  const hayArco = partido.cupos_arco > 0
  const max = Math.min(5, libresJug + libresArq, limite?.max_cupos ?? 5)

  // Con cupo propio, todos los nombres son de acompañantes; si no, uno de los cupos es el mío
  const faltanNombres = yaTengo ? cantidad : cantidad - 1
  const marcasAcomp = Array.from({ length: faltanNombres }, (_, i) => arqueros[i] === true)
  const nArq = (!yaTengo && yoArquero ? 1 : 0) + marcasAcomp.filter(Boolean).length
  const nJug = cantidad - nArq
  // Total estimado: el precio real lo calcula y guarda la base de datos
  const total = nJug * partido.cuota + nArq * partido.cuota_arquero

  function cambiarNombre(i, texto) {
    const copia = [...nombres]
    copia[i] = texto
    setNombres(copia)
  }
  function cambiarArquero(i, valor) {
    const copia = [...arqueros]
    copia[i] = valor
    setArqueros(copia)
  }

  async function reservar() {
    setError(null)
    const lista = Array.from({ length: faltanNombres }, (_, i) => (nombres[i] ?? '').trim())
    if (lista.some((n) => n === '')) {
      return setError('Escribe el nombre de cada acompañante')
    }
    if (nJug > libresJug) return setError(`Solo quedan ${libresJug} cupo(s) de jugador`)
    if (nArq > libresArq) return setError(`Solo quedan ${libresArq} cupo(s) de arquero`)

    setEnviando(true)
    const { data, error } = await supabase.rpc('reservar_cupo', {
      p_partido: partido.id,
      p_incluirme: !yaTengo,
      p_invitados: lista,
      p_yo_arquero: !yaTengo && yoArquero,
      p_invitados_arquero: marcasAcomp,
    })
    setEnviando(false)
    if (error) return setError(error.message)
    navigate(`/pago/${data}`, { replace: true })
  }

 return (
  <div className="space-y-4">
    <button onClick={volver}>← Volver</button>

    <div>
      <h2 className="text-xl font-bold">{yaTengo ? 'Agregar acompañantes' : 'Reservar cupo'}</h2>
      <p className="text-suave">
        {partido.cancha}{partido.modalidad && ` · ${partido.modalidad}`}
      </p>
    </div>

    {perfil?.nivel === 'nuevo' && limite && (
      <p className="aviso aviso-alerta text-sm">
        Tu cuenta es nueva: puedes tener hasta {limite.max_cupos} cupo(s) sin confirmar a la vez.
        Cuando se confirme tu primer pago, el límite sube.
      </p>
    )}
    {perfil?.en_revision && (
  <p className="aviso aviso-error">
    🔎 Tu cuenta está en revisión por inasistencias. Habla con un encargado para poder reservar de nuevo.
  </p>
)}
<p className="text-sm text-suave">
  Si no vienes a un partido confirmado, queda registrada una falta. Con 2 faltas en 90 días,
  tu cuenta queda en revisión. Si no puedes ir, cancela a tiempo.
</p>
    {yaTengo && (
      <p className="aviso">Ya tienes un cupo en este partido. Aquí puedes sumar a otras personas.</p>
    )}

    <div className="tarjeta space-y-3">
      <Contador
        etiqueta={yaTengo ? 'Acompañantes' : 'Cupos'}
        valor={cantidad}
        min={1}
        max={Math.max(1, max)}
        onCambio={setCantidad}
      />

      {!yaTengo && (
        <div>
          <p className="font-semibold">Tu cupo</p>
          {hayArco && (
            <label className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={yoArquero}
                onChange={(e) => setYoArquero(e.target.checked)}
              />
              Soy arquero ({bs(partido.cuota_arquero)} Bs)
            </label>
          )}
        </div>
      )}

      {Array.from({ length: faltanNombres }, (_, i) => (
        <div key={i} className="space-y-1">
          <input
            className="w-full"
            placeholder={`Nombre del acompañante ${i + 1}`}
            value={nombres[i] ?? ''}
            onChange={(e) => cambiarNombre(i, e.target.value)}
          />
          {hayArco && (
            <label className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={arqueros[i] === true}
                onChange={(e) => cambiarArquero(i, e.target.checked)}
              />
              Es arquero
            </label>
          )}
        </div>
      ))}
    </div>

    <div className="tarjeta flex items-baseline justify-between">
      <span>Total a pagar</span>
      <span className="text-2xl font-bold text-verde">{bs(total)} Bs</span>
    </div>
    {nArq > 0 && (
      <p className="text-sm text-suave">{nJug} de jugador y {nArq} de arquero</p>
    )}

    {error && <p className="aviso aviso-error">{error}</p>}

    <button onClick={reservar} disabled={enviando || max < 1 || perfil?.en_revision} className="btn btn-primario">
      {enviando ? 'Reservando...' : 'Reservar'}
    </button>
  </div>
)
}