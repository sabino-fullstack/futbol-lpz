// Prueba de carga: varias cuentas reservan el mismo partido al mismo instante.
// Uso (necesita Node 20.6 o superior):
//   node --env-file=.env scripts/prueba-carga.mjs ID_PARTIDO 40
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const partidoId = process.argv[2]
const N = Number(process.argv[3] ?? 40)

if (!url || !key || !partidoId || !(N > 0)) {
  console.error('Uso: node --env-file=.env scripts/prueba-carga.mjs ID_PARTIDO [CUENTAS]')
  process.exit(1)
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms))
const percentil = (lista, p) => {
  const s = [...lista].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
}

// 1. Cuentas de prueba, creadas de a una para no chocar con los límites de registro
const clientes = []
for (let i = 1; i <= N; i++) {
  const numero = `59179900${String(i).padStart(3, '0')}`
  const email = `${numero}@futbollpz.app`
  const password = 'prueba123'
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) {
    const r = await c.auth.signUp({
      email, password,
      options: { data: { nombre: `Carga${i}`, apellido: 'Prueba', whatsapp: numero } },
    })
    if (r.error) {
      console.log(`Cuenta ${i}: ${r.error.message}`)
      await pausa(1500)
      continue
    }
    if (!r.data.session) {
      const r2 = await c.auth.signInWithPassword({ email, password })
      if (r2.error) { console.log(`Cuenta ${i}: ${r2.error.message}`); continue }
    }
    await pausa(300)
  }
  clientes.push(c)
}
console.log(`Cuentas listas: ${clientes.length} de ${N}`)
if (clientes.length === 0) process.exit(1)

const libres = async () =>
  (await clientes[0].rpc('cupos_libres', { p_partido: partidoId, p_posicion: 'jugador' })).data
const antes = await libres()
console.log(`Cupos libres antes: ${antes}`)

// 2. Todas reservan a la vez
console.log(`\n${clientes.length} cuentas reservan al mismo instante...`)
const t0 = Date.now()
const res = await Promise.all(
  clientes.map(async (c) => {
    const t = Date.now()
    const { error } = await c.rpc('reservar_cupo', {
      p_partido: partidoId, p_incluirme: true, p_invitados: [],
    })
    return { ok: !error, msg: error?.message ?? '', ms: Date.now() - t }
  })
)
const total = Date.now() - t0

const exitos = res.filter((r) => r.ok).length
const despues = await libres()
const tiempos = res.map((r) => r.ms)
const rechazos = {}
res.filter((r) => !r.ok).forEach((r) => { rechazos[r.msg] = (rechazos[r.msg] ?? 0) + 1 })

console.log(`Reservas exitosas: ${exitos}`)
console.log(`Cupos libres después: ${despues} (esperado: ${Math.max(0, antes - clientes.length)})`)
console.log('Rechazadas:', rechazos)
console.log(
  `Tiempo total: ${total} ms · mediana ${percentil(tiempos, 50)} ms · ` +
  `p95 ${percentil(tiempos, 95)} ms · máximo ${Math.max(...tiempos)} ms`
)
console.log(
  exitos === Math.min(antes, clientes.length) && despues === Math.max(0, antes - clientes.length)
    ? 'RESULTADO: correcto, no hubo sobreventa.'
    : 'RESULTADO: REVISAR, los números no coinciden.'
)

// 3. Todas cargan la lista a la vez
console.log('\nLectura simultánea de la lista de partidos...')
const lecturas = await Promise.all(
  clientes.map(async (c) => {
    const t = Date.now()
    const a = await c.from('partidos').select('*').limit(20)
    const b = await c.rpc('libres_partidos', { p_ids: [partidoId] })
    return { ok: !a.error && !b.error, ms: Date.now() - t }
  })
)
const lt = lecturas.map((r) => r.ms)
console.log(
  `Correctas: ${lecturas.filter((r) => r.ok).length} de ${lecturas.length} · ` +
  `mediana ${percentil(lt, 50)} ms · p95 ${percentil(lt, 95)} ms · máximo ${Math.max(...lt)} ms`
)