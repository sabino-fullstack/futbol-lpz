export async function reducirImagen(archivo, maxLado = 1280, calidad = 0.8) {
  const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  const escala = Math.min(1, maxLado / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * escala)
  const h = Math.round(bmp.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
  bmp.close?.()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la imagen'))),
      'image/jpeg',
      calidad
    )
  })
}