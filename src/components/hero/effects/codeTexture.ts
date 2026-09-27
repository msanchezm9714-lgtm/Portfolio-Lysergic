const ACID: [number, number, number] = [196, 243, 108]

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await img.decode()
  return img
}

// The source is black glyphs on white: white becomes transparent (the night
// background shows through) and every glyph turns acid green.
export async function processCodeTexture(src: string): Promise<string> {
  const img = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D context unavailable')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data

  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    const ink = Math.min(1, Math.max(0, (215 - lum) / 150))
    px[i] = ACID[0]
    px[i + 1] = ACID[1]
    px[i + 2] = ACID[2]
    px[i + 3] = ink < 0.06 ? 0 : Math.round(255 * Math.pow(ink, 0.8))
  }

  ctx.putImageData(data, 0, 0)
  // data: URL rather than blob: so it loads under viewers whose CSP blocks blob images.
  return canvas.toDataURL('image/png')
}
