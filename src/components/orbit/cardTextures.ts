import type { OrbitItem } from '../../config/orbit'
import { PALETTE } from '../../config/content'

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

/** Renders every card side by side into one canvas, uploaded as a single texture. */
export async function buildCardAtlas(items: OrbitItem[], aspect: number, cardPx = 768): Promise<HTMLCanvasElement> {
  await document.fonts.ready
  const images = await Promise.all(items.map((it) => (it.image ? loadImage(it.image) : Promise.resolve(null))))
  const th = cardPx
  const tw = Math.round(cardPx * aspect)
  const canvas = document.createElement('canvas')
  canvas.width = tw * items.length
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const n = items.length

  items.forEach((item, i) => {
    ctx.save()
    ctx.translate(i * tw, 0)
    ctx.beginPath()
    ctx.rect(0, 0, tw, th)
    ctx.clip()

    const bg = ctx.createLinearGradient(0, 0, tw * 0.55, th)
    bg.addColorStop(0, '#2a2e3a')
    bg.addColorStop(0.5, '#0c0e15')
    bg.addColorStop(1, '#040509')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, tw, th)

    const img = images[i]
    if (img) {
      const s = Math.max(tw / img.naturalWidth, th / img.naturalHeight)
      const w = img.naturalWidth * s
      const h = img.naturalHeight * s
      ctx.drawImage(img, (tw - w) / 2, (th - h) / 2, w, h)
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.045)'
      ctx.lineWidth = 1
      const step = tw / 7
      for (let x = step; x < tw; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, th)
        ctx.stroke()
      }
      for (let y = step; y < th; y += step) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(tw, y)
        ctx.stroke()
      }
    }

    const pad = tw * 0.09
    const setSpacing = (em: number, size: number) => {
      if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${em * size}px`
    }

    let size = tw * 0.042
    ctx.font = `500 ${size}px "JetBrains Mono", ui-monospace, monospace`
    setSpacing(0.18, size)
    ctx.fillStyle = 'rgba(238,241,255,0.5)'
    ctx.textBaseline = 'top'
    ctx.fillText(`${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`, pad, pad)

    size = tw * 0.125
    ctx.font = `500 ${size}px "Space Grotesk", ui-sans-serif, sans-serif`
    setSpacing(-0.03, size)
    ctx.fillStyle = '#eef1ff'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(item.title, pad, th - pad - tw * 0.11)

    size = tw * 0.04
    ctx.font = `500 ${size}px "JetBrains Mono", ui-monospace, monospace`
    setSpacing(0.16, size)
    ctx.fillStyle = PALETTE.acid
    ctx.fillRect(pad, th - pad - size * 0.85, size * 0.62, size * 0.62)
    ctx.fillStyle = 'rgba(238,241,255,0.62)'
    ctx.fillText(item.tag.toUpperCase(), pad + size * 1.2, th - pad - size * 0.12)
    ctx.restore()
  })
  return canvas
}
