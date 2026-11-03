const SEP = ';'

function celda(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'number') return String(v).replace('.', ',') // coma decimal
  let s = String(v)
  // Evita que Excel interprete un texto como fórmula (por ejemplo un nombre que empiece con "=")
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}

// columnas: [['Título', (fila) => valor], ...]
export function descargarCSV(nombre, columnas, filas) {
  const lineas = [columnas.map(([t]) => celda(t)).join(SEP)]
  filas.forEach((f) => lineas.push(columnas.map(([, fn]) => celda(fn(f))).join(SEP)))
  // El BOM al inicio hace que Excel lea bien las tildes
  const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}

// Trae todas las filas de una consulta, de a 1000 (el máximo por petición)
export async function traerTodo(construir, tamano = 1000) {
  const filas = []
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await construir().range(desde, desde + tamano - 1)
    if (error) throw error
    filas.push(...data)
    if (data.length < tamano) break
  }
  return filas
}