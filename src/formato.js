export const bs = (n) => {
  const x = Number(n)
  return Number.isInteger(x) ? String(x) : x.toFixed(2)
}