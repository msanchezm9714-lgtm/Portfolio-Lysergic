import { EFFECT_CONFIG, PALETTE, SCROLL_CONFIG } from '../../../config/content'
import { coverRect, type Focal } from './PixelTrail'

const GLYPHS = Array.from(
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ0123456789ABCDEFXZ#$%&@*+=<>口田日岩火大出',
)
const COLORS = [PALETTE.acid, PALETTE.electric, '#8fb0ff', PALETTE.pale, '#070a14']
const C_ACID = 0
const C_ELECTRIC = 1
const C_SKY = 2
const C_PALE = 3
const C_DARK = 4
const MAX_SCALE = 2.6
const PRE_RELEASE = 0.05

function hash(i: number, seed: number): number {
  let x = (i * 374761393 + seed * 668265263) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export interface LimeWindow {
  x0: number
  y0: number
  x1: number
  y1: number
  amount: number // 0..1 progress of the lime zoom
}

export const limeAmount = (p: number) =>
  clamp01((p - SCROLL_CONFIG.limeStart) / (SCROLL_CONFIG.limeEnd - SCROLL_CONFIG.limeStart))

/**
 * Scroll-driven transition. Everything is a pure function of progress p (0..1), so
 * scrolling back up rewinds it: image cells turn into glyphs, fall while spinning and
 * growing, and a lime block zooms in from the centre until it fills the viewport.
 */
export class Disintegration {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly cs = SCROLL_CONFIG.cellSize
  // Drawn straight from the <img> (no full-size copy) to stay within mobile canvas memory.
  private image: HTMLImageElement | null = null
  private cover = { dx: 0, dy: 0, dw: 0, dh: 0 }
  private atlas: HTMLCanvasElement | null = null
  private sp = 0
  private w = 0
  private h = 0
  private dpr = 1
  private cols = 0
  private rows = 0
  private release = new Float32Array(0)
  private dur = new Float32Array(0)
  private fall = new Float32Array(0)
  private drift = new Float32Array(0)
  private spin = new Float32Array(0)
  private glyph = new Uint16Array(0)
  private color = new Uint8Array(0)

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')
    this.ctx = ctx
  }

  resize(w: number, h: number, image: HTMLImageElement, focal: Focal) {
    const cs = this.cs
    this.w = w
    this.h = h
    this.dpr = Math.min(window.devicePixelRatio || 1, EFFECT_CONFIG.maxDPR)
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    this.cols = Math.ceil(w / cs)
    this.rows = Math.ceil(h / cs)

    const cover = coverRect(image.naturalWidth, image.naturalHeight, w, h, focal)
    this.image = image
    this.cover = cover

    const n = this.cols * this.rows
    this.release = new Float32Array(n)
    this.dur = new Float32Array(n)
    this.fall = new Float32Array(n)
    this.drift = new Float32Array(n)
    this.spin = new Float32Array(n)
    this.glyph = new Uint16Array(n)
    this.color = new Uint8Array(n)
    const span = SCROLL_CONFIG.releaseSpan
    for (let i = 0; i < n; i++) {
      const row = (i / this.cols) | 0
      this.release[i] = 0.01 + span * (0.65 * hash(i, 1) + 0.35 * (row / this.rows))
      this.dur[i] = SCROLL_CONFIG.fallDuration * (0.8 + 0.7 * hash(i, 2))
      this.fall[i] = h * (0.75 + 0.6 * hash(i, 3))
      this.drift[i] = (hash(i, 4) - 0.5) * 90
      const dir = hash(i, 5) < 0.5 ? -1 : 1
      this.spin[i] = dir * Math.PI * 2 * SCROLL_CONFIG.spinTurns * (0.45 + 0.55 * hash(i, 6))
      this.glyph[i] = Math.floor(hash(i, 7) * GLYPHS.length)
    }

    this.buildColors(image, cover)
    this.buildAtlas()
  }

  private buildColors(image: HTMLImageElement, c: { dx: number; dy: number; dw: number; dh: number }) {
    const cs = this.cs
    const tiny = document.createElement('canvas')
    tiny.width = this.cols
    tiny.height = this.rows
    const tctx = tiny.getContext('2d', { willReadFrequently: true })
    if (!tctx) return
    tctx.drawImage(image, c.dx / cs, c.dy / cs, c.dw / cs, c.dh / cs)
    const px = tctx.getImageData(0, 0, this.cols, this.rows).data
    for (let i = 0; i < this.color.length; i++) {
      const r = px[i * 4]
      const g = px[i * 4 + 1]
      const b = px[i * 4 + 2]
      if (Math.max(r, g, b) < 45) this.color[i] = C_ACID
      else if (r > 140 && g > 170) this.color[i] = C_PALE
      else if (b > 200 && g > 75) this.color[i] = C_SKY
      else this.color[i] = C_ELECTRIC
    }
  }

  // Every glyph pre-rendered once per colour, large enough to stay crisp at MAX_SCALE.
  private buildAtlas() {
    const sp = Math.ceil(this.cs * MAX_SCALE * this.dpr)
    this.sp = sp
    const atlas = document.createElement('canvas')
    atlas.width = GLYPHS.length * sp
    atlas.height = COLORS.length * sp
    const actx = atlas.getContext('2d')
    if (!actx) return
    actx.font = `600 ${Math.round(sp * 0.74)}px "JetBrains Mono", "Hiragino Sans", ui-monospace, monospace`
    actx.textAlign = 'center'
    actx.textBaseline = 'middle'
    COLORS.forEach((col, k) => {
      actx.fillStyle = col
      GLYPHS.forEach((ch, j) => actx.fillText(ch, j * sp + sp / 2, k * sp + sp / 2))
    })
    this.atlas = atlas
  }

  // Scattered tiles around the lime block so its edge reads as pixels, not a rectangle.
  private drawLimeEdge(x0: number, y0: number, x1: number, y1: number, p: number) {
    const { ctx, cs } = this
    const B = SCROLL_CONFIG.limeEdgeCells
    const flicker = Math.floor(p * 60)
    ctx.fillStyle = PALETTE.acid
    const tile = (x: number, y: number, j: number) => {
      const key = Math.round(x / cs) * 7919 + Math.round(y / cs) * 104729 + flicker * 31
      if (hash(key, 9) < (1 - j / (B + 1)) * 0.85) ctx.fillRect(x, y, cs, cs)
    }
    for (let j = 1; j <= B; j++) {
      for (let x = x0 - B * cs; x < x1 + B * cs; x += cs) {
        tile(x, y0 - j * cs, j)
        tile(x, y1 + (j - 1) * cs, j)
      }
      for (let y = y0; y < y1; y += cs) {
        tile(x0 - j * cs, y, j)
        tile(x1 + (j - 1) * cs, y, j)
      }
    }
  }

  /** Draws frame p and returns the open lime window (CSS px), if any. */
  render(p: number): LimeWindow | null {
    const { ctx, canvas, cs, dpr } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (p <= 0 || !this.image || !this.atlas) return null

    // Remaining image: released cells are punched out, revealing the ASCII layer.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(this.image, this.cover.dx, this.cover.dy, this.cover.dw, this.cover.dh)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const cols = this.cols
    for (let i = 0; i < this.release.length; i++) {
      if (p < this.release[i]) continue
      const c = i % cols
      const r = (i / cols) | 0
      const x0 = Math.floor(c * cs * dpr)
      const y0 = Math.floor(r * cs * dpr)
      ctx.clearRect(x0, y0, Math.floor((c + 1) * cs * dpr) - x0, Math.floor((r + 1) * cs * dpr) - y0)
    }

    // Window onto the lime section, zooming in from the centre with edges snapped to the
    // glyph grid. The canvas is cleared there so the section layer beneath shows through.
    const lz = limeAmount(p)
    const e = Math.pow(lz, 2.2)
    let lx0 = 0
    let ly0 = 0
    let lx1 = 0
    let ly1 = 0
    let win: LimeWindow | null = null
    if (e > 0) {
      const hw = lz >= 1 ? this.w : Math.ceil((this.w * e) / 2 / cs) * cs
      const hh = lz >= 1 ? this.h : Math.ceil((this.h * e) / 2 / cs) * cs
      lx0 = this.w / 2 - hw
      lx1 = this.w / 2 + hw
      ly0 = this.h / 2 - hh
      ly1 = this.h / 2 + hh
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(lx0, ly0, lx1 - lx0, ly1 - ly0)
      if (lz < 1) this.drawLimeEdge(lx0, ly0, lx1, ly1, p)
      win = { x0: lx0, y0: ly0, x1: lx1, y1: ly1, amount: lz }
    }

    const atlas = this.atlas
    const sp = this.sp
    const n = GLYPHS.length
    for (let i = 0; i < this.release.length; i++) {
      const rel = this.release[i]
      if (p < rel - PRE_RELEASE) continue
      const c = i % cols
      const r = (i / cols) | 0
      let cx = (c + 0.5) * cs
      let cy = (r + 0.5) * cs
      let s = 0
      let alpha = 1
      let scale = 1
      let angle = 0

      if (p < rel) {
        if (e > 0 && cx > lx0 && cx < lx1 && cy > ly0 && cy < ly1) continue
        // Just before release the image cell turns into a character in place.
        alpha = (p - (rel - PRE_RELEASE)) / PRE_RELEASE
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.globalAlpha = alpha * 0.85
        ctx.fillStyle = '#000'
        ctx.fillRect(c * cs, r * cs, cs, cs)
      } else {
        s = (p - rel) / this.dur[i]
        if (s >= 1) continue
        cx += this.drift[i] * s
        cy += this.fall[i] * s * s
        if (cy - cs * MAX_SCALE > this.h) continue
        angle = this.spin[i] * s
        scale = 1 + (MAX_SCALE - 1) * s * s
        alpha = s < 0.65 ? 1 : (1 - s) / 0.35
      }

      const inLime = e > 0 && cx > lx0 && cx < lx1 && cy > ly0 && cy < ly1
      const col = inLime ? C_DARK : this.color[i]
      const gi = (this.glyph[i] + Math.floor(s * 10) + Math.floor(p * 40)) % n
      const cos = Math.cos(angle) * scale * dpr
      const sin = Math.sin(angle) * scale * dpr
      ctx.globalAlpha = alpha
      ctx.setTransform(cos, sin, -sin, cos, cx * dpr, cy * dpr)
      ctx.drawImage(atlas, gi * sp, col * sp, sp, sp, -cs / 2, -cs / 2, cs, cs)
    }
    ctx.globalAlpha = 1
    return win
  }
}
