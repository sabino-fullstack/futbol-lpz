import { useEffect, useRef, useState } from 'react'
import {
  Banknote, CalendarDays, Check, ChevronDown, Clock, Hand, ListChecks, MapPin, Minus, Plus, Repeat,
  Trophy, UserPlus, Users,
} from 'lucide-react'
import { supabase } from './supabaseClient'
import Rueda from './Rueda'
import { fechaCorta, hhmm, siguienteSemana, sumarDias } from './formato'

const MODALIDADES = ['Fútbol 11', 'Fútbol 9', 'Fútbol 8', 'Fútbol 7', 'Fútbol 6', 'Fútbol 5', 'Futsal']
const hh = (t) => (t ? t.slice(0, 5) : '')
const nn = (s) => (s.trim() === '' ? null : s.trim())

// origen: el partido que se edita o se duplica. Al duplicar, la fecha pasa a la próxima semana.
function valoresIniciales(p, duplicando) {
  if (!p) {
    return {
      cancha_id: '', modalidad: 'Fútbol 11', modalidad_otra: '',
      fecha: '', hora: '', hora_fin: '', cuota: '',
      cupos: 18, cupos_arco: 0, cuota_arquero: '', equipos: 0,
      formato_juego: '', premio: '', premio_para: '', notas: '',
    }
  }
  const enLista = MODALIDADES.includes(p.modalidad)
  return {
    cancha_id: p.cancha_id ?? '',
    modalidad: p.modalidad ? (enLista ? p.modalidad : '__otra') : 'Fútbol 11',
    modalidad_otra: p.modalidad && !enLista ? p.modalidad : '',
    fecha: duplicando ? siguienteSemana(p.fecha) : p.fecha,
    hora: hh(p.hora), hora_fin: hh(p.hora_fin),
    cuota: String(p.cuota), cupos: p.cupos, cupos_arco: p.cupos_arco,
    cuota_arquero: String(p.cuota_arquero), equipos: p.equipos ?? 0,
    formato_juego: p.formato_juego ?? '', premio: p.premio ?? '',
    premio_para: p.premio_para ?? '', notas: p.notas ?? '',
  }
}

function Icono3({ Icono }) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-verde/15 text-verde">
      <Icono size={15} />
    </span>
  )
}

function Bloque({ Icono, titulo, children }) {
  return (
    <section className="space-y-2.5 rounded-xl border border-borde p-3">
      <p className="flex items-center gap-2 font-semibold"><Icono3 Icono={Icono} /> {titulo}</p>
      {children}
    </section>
  )
}

function Plegable({ Icono, titulo, resumen, abierto = false, children }) {
  return (
    <details open={abierto} className="group rounded-xl border border-borde">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 font-semibold [&::-webkit-details-marker]:hidden">
        <Icono3 Icono={Icono} />
        <span className="min-w-0 flex-1">
          <span className="block">{titulo}</span>
          {resumen && <span className="block truncate text-xs font-normal text-suave">{resumen}</span>}
        </span>
        <ChevronDown size={18} className="shrink-0 text-suave transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2.5 border-t border-borde p-3">{children}</div>
    </details>
  )
}

function Etiqueta({ texto, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-suave">{texto}</span>
      {children}
    </label>
  )
}

function Mas({ onClick, disabled, etiqueta }) {
  return (
    <button type="button" aria-label={etiqueta} disabled={disabled} onClick={onClick} className="h-10 w-10 shrink-0 rounded-full p-0">
      <Plus size={16} className="mx-auto" />
    </button>
  )
}
function Menos({ onClick, disabled, etiqueta }) {
  return (
    <button type="button" aria-label={etiqueta} disabled={disabled} onClick={onClick} className="h-10 w-10 shrink-0 rounded-full p-0">
      <Minus size={16} className="mx-auto" />
    </button>
  )
}

// Contador compacto: cabe tres en una fila
function Paso({ Icono, etiqueta, valor, min, max, onCambio, vacio }) {
  return (
    <div className="rounded-xl border border-borde p-2">
      <p className="flex items-center justify-center gap-1 text-xs font-semibold text-suave">
        <Icono size={13} /> {etiqueta}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <Menos etiqueta={`Menos ${etiqueta}`} disabled={valor <= min} onClick={() => onCambio(Math.max(min, valor - 1))} />
        <span className="text-lg font-bold tabular-nums">{vacio !== undefined && valor === 0 ? vacio : valor}</span>
        <Mas etiqueta={`Más ${etiqueta}`} disabled={valor >= max} onClick={() => onCambio(Math.min(max, valor + 1))} />
      </div>
    </div>
  )
}

export default function FormularioPartido({
  canchas, partido, base, perfiles = [], acuerdoBase = null, textoBoton, onGuardar, onCancelar,
}) {
  const origen = partido ?? base ?? null
  const [v, setV] = useState(() => valoresIniciales(origen, !!base))
  const [plantillas, setPlantillas] = useState({})
  const [formatoTocado, setFormatoTocado] = useState(!!origen?.formato_juego)
  const [semanas, setSemanas] = useState(0)
  const [copiar, setCopiar] = useState(true)
  const [org, setOrg] = useState({
    activo: !!acuerdoBase,
    id: acuerdoBase?.organizador_id ?? '',
    fija: String(acuerdoBase?.tarifa_fija ?? 20),
    pct: String(acuerdoBase?.tarifa_pct ?? 0),
    cancelado: acuerdoBase?.cobrar_si_cancelado ?? false,
  })
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const errorRef = useRef(null)

  useEffect(() => {
    supabase.from('formatos_plantilla').select('equipos, texto').then(({ data }) => {
      const m = {}
      ;(data ?? []).forEach((x) => { m[x.equipos] = x.texto })
      setPlantillas(m)
      setV((prev) =>
        !formatoTocado && prev.formato_juego === '' && m[prev.equipos]
          ? { ...prev, formato_juego: m[prev.equipos] }
          : prev
      )
    })
  }, [])

  // Si hay un error, se lleva a la pantalla aunque estés abajo del formulario
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  const cambiar = (campo) => (e) => setV({ ...v, [campo]: e.target.value })

  function cambiarEquipos(n) {
    setV((prev) => {
      const sig = { ...prev, equipos: n }
      // Mientras no hayas escrito el formato a mano, sigue a la plantilla
      if (!formatoTocado) sig.formato_juego = plantillas[n] ?? ''
      return sig
    })
  }

  async function guardar() {
    setError(null)
    const cancha = canchas.find((c) => c.id === v.cancha_id)
    if (!cancha || !v.fecha || !v.hora || !v.cuota || !v.cupos) {
      return setError('Completa la cancha, la fecha, la hora y la cuota')
    }
    if (v.hora_fin && v.hora_fin <= v.hora) {
      return setError('La hora de fin debe ser posterior a la de inicio')
    }
    // Bolivia no cambia de horario: siempre es UTC-4
    if (!partido && new Date(`${v.fecha}T${v.hora}-04:00`).getTime() <= Date.now()) {
      return setError('La fecha y la hora ya pasaron')
    }
    const modalidad = v.modalidad === '__otra' ? v.modalidad_otra.trim() : v.modalidad
    if (!modalidad) return setError('Escribe la modalidad del partido')
    if (modalidad.length > 30) return setError('La modalidad es demasiado larga (máximo 30 letras)')
    const cuota = Number(String(v.cuota).replace(',', '.'))
    if (Number.isNaN(cuota) || cuota <= 0) return setError('La cuota debe ser un número mayor que 0')
    if (v.cuota_arquero !== '' && (Number.isNaN(Number(String(v.cuota_arquero).replace(',', '.'))) || Number(String(v.cuota_arquero).replace(',', '.')) < 0)) {
      return setError('La cuota de arquero no es válida')
    }

    let acuerdo = null
    if (!partido && org.activo) {
      const fija = Number(String(org.fija).replace(',', '.'))
      const porc = Number(String(org.pct).replace(',', '.'))
      if (!org.id) return setError('Elige al organizador del partido')
      if (org.fija === '' || Number.isNaN(fija) || fija < 0 || fija > 9999) {
        return setError('La tarifa fija debe ser un número entre 0 y 9999')
      }
      if (org.pct === '' || Number.isNaN(porc) || porc < 0 || porc > 100) {
        return setError('El porcentaje debe estar entre 0 y 100')
      }
      acuerdo = { organizador_id: org.id, fija, pct: porc, cobrar_cancelado: org.cancelado }
    }

    const premio = nn(v.premio)
    setGuardando(true)
    const mensaje = await onGuardar(
      {
        cancha_id: cancha.id,
        cancha: cancha.nombre,
        modalidad,
        fecha: v.fecha,
        hora: v.hora,
        hora_fin: v.hora_fin || null,
        cuota,
        cupos: Number(v.cupos),
        cupos_arco: Number(v.cupos_arco),
        cuota_arquero: v.cuota_arquero === '' ? null : Number(String(v.cuota_arquero).replace(',', '.')),
        equipos: v.equipos > 0 ? v.equipos : null,
        formato_juego: nn(v.formato_juego),
        premio,
        premio_para: premio ? nn(v.premio_para) : null,
        notas: nn(v.notas),
      },
      { semanas, copiarEncargados: !!base && copiar, acuerdo }
    )
    setGuardando(false)
    if (mensaje) setError(mensaje)
  }

  const canchaElegida = canchas.find((c) => c.id === v.cancha_id)
  const modalidadTxt = v.modalidad === '__otra' ? v.modalidad_otra.trim() : v.modalidad
  const resumen = canchaElegida && v.fecha && v.hora
    ? [
        canchaElegida.nombre,
        modalidadTxt,
        `${fechaCorta(v.fecha)} · ${hhmm(v.hora)}${v.hora_fin ? `–${hhmm(v.hora_fin)}` : ''}`,
        `${v.cupos}${v.cupos_arco > 0 ? ` + ${v.cupos_arco} de arco` : ''} cupos`,
        v.cuota ? `${v.cuota} Bs` : null,
      ].filter(Boolean).join(' · ')
    : null

  const porDefecto = v.equipos >= 3 ? 'Equipo con más victorias' : 'Equipo ganador'
  const tieneOpcionales = !!(origen?.formato_juego || origen?.premio || origen?.notas)

  return (
    <div className="space-y-3">
      <h3>{partido ? 'Editar partido' : base ? 'Duplicar partido' : 'Nuevo partido'}</h3>

      {partido && (
        <p className="aviso aviso-alerta text-sm">
          Si cambias la fecha, la hora o la cancha, quienes tengan cupo reciben un aviso automático.
          Los cambios de cuota solo afectan reservas nuevas.
        </p>
      )}
      {base && (
        <p className="aviso text-sm">
          Se copiaron los datos del partido original. Revisa la fecha y la hora antes de crearlo.
        </p>
      )}
      {canchas.length === 0 && (
        <p className="aviso aviso-alerta text-sm">Primero crea una cancha en la pestaña "Canchas".</p>
      )}

      <Bloque Icono={MapPin} titulo="Dónde y cuándo">
        <select className="w-full" value={v.cancha_id} onChange={cambiar('cancha_id')}>
          <option value="">Elegir cancha...</option>
          {canchas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>

        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Modalidad">
          {[...MODALIDADES, '__otra'].map((m) => {
            const activo = v.modalidad === m
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => setV({ ...v, modalidad: m })}
                className={`min-h-9 px-3 text-sm ${activo ? 'border-verde bg-verde/10 text-verde' : ''}`}
              >
                {m === '__otra' ? 'Otra…' : m}
              </button>
            )
          })}
        </div>
        {v.modalidad === '__otra' && (
          <input
            className="w-full"
            placeholder="Ej. Fútbol 8 mixto"
            maxLength={30}
            value={v.modalidad_otra}
            onChange={cambiar('modalidad_otra')}
          />
        )}

        <Etiqueta texto="Fecha">
          <input type="date" className="w-full" value={v.fecha} onChange={cambiar('fecha')} />
        </Etiqueta>
        <div className="grid grid-cols-2 gap-2">
          <Etiqueta texto="Inicio">
            <input type="time" className="w-full" value={v.hora} onChange={cambiar('hora')} />
          </Etiqueta>
          <Etiqueta texto="Fin (opcional)">
            <input type="time" className="w-full" value={v.hora_fin} onChange={cambiar('hora_fin')} />
          </Etiqueta>
        </div>

        {!partido && (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-borde p-2">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Repeat size={16} className="shrink-0 text-verde" /> Repetir cada semana
              </span>
              <span className="flex items-center gap-2">
                <Menos etiqueta="Menos semanas" disabled={semanas <= 0} onClick={() => setSemanas(Math.max(0, semanas - 1))} />
                <span className="min-w-14 text-center text-sm font-bold tabular-nums">
                  {semanas === 0 ? 'No' : `+${semanas} sem.`}
                </span>
                <Mas etiqueta="Más semanas" disabled={semanas >= 8} onClick={() => setSemanas(Math.min(8, semanas + 1))} />
              </span>
            </div>
            {semanas > 0 && v.fecha && (
              <p className="text-xs text-suave">
                Se crearán {semanas + 1} partidos, uno por semana, el mismo día y a la misma hora:
                del {fechaCorta(v.fecha)} al {fechaCorta(sumarDias(v.fecha, 7 * semanas))}.
              </p>
            )}
          </>
        )}
      </Bloque>

      <Bloque Icono={Users} titulo="Cupos y cuota">
        <div className={v.cupos_arco > 0 ? 'grid grid-cols-2 gap-2' : ''}>
          <Etiqueta texto="Cuota (Bs)">
            <input className="w-full" inputMode="decimal" placeholder="Ej. 7" value={v.cuota} onChange={cambiar('cuota')} />
          </Etiqueta>
          {v.cupos_arco > 0 && (
            <Etiqueta texto="Cuota arquero (vacío = mitad)">
              <input className="w-full" inputMode="decimal" value={v.cuota_arquero} onChange={cambiar('cuota_arquero')} />
            </Etiqueta>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Paso Icono={Users} etiqueta="Jugadores" valor={v.cupos} min={2} max={40} onCambio={(n) => setV({ ...v, cupos: n })} />
          <Paso Icono={Hand} etiqueta="Arqueros" valor={v.cupos_arco} min={0} max={6} onCambio={(n) => setV({ ...v, cupos_arco: n })} />
          <Paso Icono={Banknote} etiqueta="Equipos" valor={v.equipos} min={0} max={8} vacio="—" onCambio={cambiarEquipos} />
        </div>
        {v.equipos > 0 && v.cupos % v.equipos !== 0 && (
          <p className="text-sm text-amarillo-texto">
            Ojo: {v.cupos} cupos no se dividen exactamente entre {v.equipos} equipos.
          </p>
        )}
      </Bloque>

      <Plegable
        Icono={ListChecks}
        titulo="Detalles opcionales"
        resumen="Cómo se juega, premio y notas"
        abierto={tieneOpcionales}
      >
        <Etiqueta texto="Cómo se juega">
          <textarea
            rows={4}
            maxLength={1000}
            placeholder="Tiempos, rotación, desempate..."
            value={v.formato_juego}
            onChange={(e) => { setV({ ...v, formato_juego: e.target.value }); setFormatoTocado(true) }}
          />
        </Etiqueta>
        {plantillas[v.equipos] && v.formato_juego !== plantillas[v.equipos] && (
          <button
            type="button"
            onClick={() => { setV({ ...v, formato_juego: plantillas[v.equipos] }); setFormatoTocado(false) }}
          >
            Usar la plantilla de {v.equipos} equipos
          </button>
        )}

        <Etiqueta texto="Premio">
          <span className="relative block">
            <Trophy size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amarillo" />
            <input
              className="w-full pl-9"
              placeholder="Ej. Coca de 2 litros"
              maxLength={80}
              value={v.premio}
              onChange={cambiar('premio')}
            />
          </span>
        </Etiqueta>
        {v.premio.trim() !== '' && (
          <Etiqueta texto={`¿Quién lo gana? (vacío = "${porDefecto}")`}>
            <input className="w-full" maxLength={60} value={v.premio_para} onChange={cambiar('premio_para')} />
          </Etiqueta>
        )}

        <Etiqueta texto="Notas de este partido">
          <textarea
            rows={2}
            maxLength={500}
            placeholder="Ej. Traer camiseta clara y oscura."
            value={v.notas}
            onChange={cambiar('notas')}
          />
        </Etiqueta>
      </Plegable>

      {!partido && (
        <Plegable
          Icono={UserPlus}
          titulo="Quién organiza"
          resumen={org.activo ? 'De un organizador' : 'Propio: tú cobras'}
          abierto={org.activo}
        >
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Quién organiza">
            {[
              [false, 'Propio', 'Tú cobras', Banknote],
              [true, 'De un organizador', 'Tú cobras una tarifa', UserPlus],
            ].map(([valor, nombre, detalle, Icono]) => {
              const activo = org.activo === valor
              return (
                <button
                  key={nombre}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setOrg({ ...org, activo: valor })}
                  className={`relative flex h-auto flex-col gap-0.5 py-2.5 ${activo ? 'border-verde bg-verde/10 text-verde' : ''}`}
                >
                  <Icono size={20} />
                  <span className="text-sm font-semibold leading-tight">{nombre}</span>
                  <span className="text-[0.7rem] font-normal text-suave">{detalle}</span>
                  {activo && <Check size={14} className="pop absolute right-1.5 top-1.5" />}
                </button>
              )
            })}
          </div>

          {org.activo && (
            <>
              <select className="w-full" value={org.id} onChange={(e) => setOrg({ ...org, id: e.target.value })}>
                <option value="">Elegir organizador...</option>
                {perfiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.apellido ?? ''} ({p.whatsapp})</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <Etiqueta texto="Tarifa fija (Bs)">
                  <input className="w-full" inputMode="decimal" value={org.fija}
                    onChange={(e) => setOrg({ ...org, fija: e.target.value })} />
                </Etiqueta>
                <Etiqueta texto="+ Porcentaje (%)">
                  <input className="w-full" inputMode="decimal" value={org.pct}
                    onChange={(e) => setOrg({ ...org, pct: e.target.value })} />
                </Etiqueta>
              </div>
              <label className="flex items-center gap-3 py-1 text-sm">
                <input type="checkbox" checked={org.cancelado}
                  onChange={(e) => setOrg({ ...org, cancelado: e.target.checked })} />
                Cobrar la tarifa aunque el partido se cancele
              </label>
              <p className="text-xs text-suave">
                El organizador cobra a los jugadores con su propio QR y tú solo registras tu tarifa. Queda
                asignado como encargado del partido, y no podrás asignarte como encargado en él.
              </p>
            </>
          )}

          {base && !org.activo && (
            <label className="flex items-center gap-3 py-1 text-sm">
              <input type="checkbox" checked={copiar} onChange={(e) => setCopiar(e.target.checked)} />
              Copiar los encargados y su QR
            </label>
          )}
        </Plegable>
      )}

      {resumen && (
        <p className="flex items-start gap-2 rounded-xl bg-borde/40 p-2.5 text-sm">
          <CalendarDays size={16} className="mt-0.5 shrink-0 text-verde" />
          <span className="min-w-0 break-words">{resumen}</span>
        </p>
      )}

      {error && <p ref={errorRef} className="aviso aviso-error">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-activo" disabled={guardando} onClick={guardar}>
          {guardando ? <><Rueda size={16} /> Guardando...</> : <><Check size={18} /> {textoBoton}</>}
        </button>
        <button onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}