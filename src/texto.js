export const NIVELES = [
  ['normal', 'Normal'],
  ['grande', 'Grande'],
  ['muy-grande', 'Muy grande'],
]

export function textoActual() {
  const a = document.documentElement.getAttribute('data-texto')
  return a === 'grande' || a === 'muy-grande' ? a : 'normal'
}

export function aplicarTexto(nivel) {
  const el = document.documentElement
  if (nivel === 'normal') el.removeAttribute('data-texto')
  else el.setAttribute('data-texto', nivel)
  try { localStorage.setItem('texto', nivel) } catch { /* sin almacenamiento */ }
}