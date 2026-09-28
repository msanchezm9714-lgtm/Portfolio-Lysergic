import { EFFECT_CONFIG, PALETTE } from '../../../config/content'

export interface Focal {
  x: number
  y: number
}

interface Particle {
  x: number
  y: number
  w: number
  h: number
  age: number
  life: number
  color: string
}

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export function coverRect(iw: number, ih: number, bw: number, bh: number, focal: Focal) {
  const s = Math.max(bw / iw, bh / ih)
  const dw = iw * s
  const dh = ih * s
  return { dx: (bw - dw) * focal.x, dy: (bh - dh) * focal.y, dw, dh }
}

const PARTICLE_COLORS = [PALETTE.acid, PALETTE.acid, PALETTE.electric, PALETTE.pale]

function hash(i: number): number {
  let x = (i + 0x9e3779b9) | 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

/**
 * Draws the hero image into a canvas as a grid of small cells. Near the pointer each
 * cell flattens into a solid "cube", rotates a quarter turn and shrinks away, opening a
 * hole through which the code layer behind the canvas shows. Cells close again as the
 * trail decays.
 */
export class PixelTrail {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly reducedMotion: boolean
  private readonly cs = EFFECT_CONFIG.cellSize

  // The hero image is drawn straight from the <img> (no full-size copy): mobile Safari
  // caps total canvas memory and a blank canvas here would hide the hero.
  private image: HTMLImageElement | null = null
  private cover = { dx: 0, dy: 0, dw: 0, dh: 0 }
  private dpr = 1
  private cols = 0
  private rows = 0
  private radius = 200

  private heat = new Float32Array(0)
  private open = new Float32Array(0)
  private floor = new Float32Array(0)
  private rand = new Float32Array(0)
  private flags = new Uint8Array(0)
  private front: string[] = []
  private side: string[] = []
  private edge: string[] = []
  private active = new Set<number>()
  private particles: Particle[] = []
  private prevDirty: Rect | null = null

  private pointer = { tx: 0, ty: 0, sx: 0, sy: 0, px: 0, py: 0, inside: false, seeded: false, speed: 0 }

  constructor(canvas: HTMLCanvasElement, reducedMotion: boolean) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')
    this.ctx = ctx
    this.reducedMotion = reducedMotion
  }

  resize(w: number, h: number, image: HTMLImageElement, focal: Focal) {
    const cs = this.cs
    this.dpr = Math.min(window.devicePixelRatio || 1, EFFECT_CONFIG.maxDPR)
    this.cols = Math.ceil(w / cs)
    this.rows = Math.ceil(h / cs)
    this.radius = Math.min(
      EFFECT_CONFIG.radiusMax,
      Math.max(EFFECT_CONFIG.radiusMin, Math.min(w, h) * EFFECT_CONFIG.radiusScale),
    )

    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)

    const { dx, dy, dw, dh } = coverRect(image.naturalWidth, image.naturalHeight, w, h, focal)
    this.image = image
    this.cover = { dx, dy, dw, dh }

    this.buildCellColors(image, dx, dy, dw, dh)

    const n = this.cols * this.rows
    this.heat = new Float32Array(n)
    this.open = new Float32Array(n)
    this.floor = new Float32Array(n)
    this.rand = new Float32Array(n)
    this.flags = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      this.rand[i] = hash(i)
      this.flags[i] = Math.floor(hash(i + 7919) * 4)
    }
    this.active.clear()
    this.particles = []
    this.prevDirty = null
    this.drawFull()
  }

  // One solid colour per cell, averaged by downscaling the image to the grid size.
  private buildCellColors(image: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
    const cs = this.cs
    const tiny = document.createElement('canvas')
    tiny.width = this.cols
    tiny.height = this.rows
    const tctx = tiny.getContext('2d', { willReadFrequently: true })
    if (!tctx) return
    tctx.imageSmoothingQuality = 'high'
    tctx.fillStyle = PALETTE.night
    tctx.fillRect(0, 0, this.cols, this.rows)
    tctx.drawImage(image, dx / cs, dy / cs, dw / cs, dh / cs)
    const px = tctx.getImageData(0, 0, this.cols, this.rows).data
    const n = this.cols * this.rows
    this.front = new Array(n)
    this.side = new Array(n)
    this.edge = new Array(n)
    for (let i = 0; i < n; i++) {
      const r = px[i * 4]
      const g = px[i * 4 + 1]
      const b = px[i * 4 + 2]
      this.front[i] = `rgb(${r},${g},${b})`
      this.side[i] = `rgb(${(r * 0.38) | 0},${(g * 0.4) | 0},${Math.min(255, b * 0.62 + 22) | 0})`
      this.edge[i] = `rgb(${Math.min(255, r * 1.25 + 30) | 0},${Math.min(255, g * 1.25 + 30) | 0},${Math.min(255, b * 1.2 + 30) | 0})`
    }
  }

  pointerMove(x: number, y: number) {
    const p = this.pointer
    p.tx = x
    p.ty = y
    p.inside = true
    if (!p.seeded) {
      p.sx = p.px = x
      p.sy = p.py = y
      p.seeded = true
    }
  }

  pointerLeave() {
    this.pointer.inside = false
    this.pointer.seeded = false
  }

  /** Advances the simulation; returns true while another frame is needed. */
  step(dt: number, t: number): boolean {
    dt = Math.min(dt, 48)
    const cfg = EFFECT_CONFIG
    const p = this.pointer

    if (p.inside) {
      const k = this.reducedMotion ? 1 : 1 - Math.pow(1 - cfg.pointerSmoothing, dt / 16.67)
      p.sx += (p.tx - p.sx) * k
      p.sy += (p.ty - p.sy) * k
      const inst = Math.hypot(p.sx - p.px, p.sy - p.py) / Math.max(dt, 1)
      p.speed += (inst - p.speed) * Math.min(1, dt / 90)
      p.px = p.sx
      p.py = p.sy
    } else {
      p.speed = 0
    }

    const decayMs = this.reducedMotion ? 220 : cfg.trailDecayMs
    let changed = false

    for (const i of this.active) {
      const fl = this.floor[i]
      const h = this.heat[i]
      if (h > fl) {
        this.heat[i] = Math.max(fl, h - (dt / decayMs) * (0.7 + 0.6 * this.rand[i]))
      }
    }

    if (p.inside) this.stamp(t)
    if (p.inside && !this.reducedMotion && p.speed > 0.04) this.spawnParticles(dt)

    for (const i of this.active) {
      const h = this.heat[i]
      let o = this.open[i]
      const prev = o
      if (this.reducedMotion) o = h
      else if (h > o) o = Math.min(h, o + (dt / cfg.flipInMs) * (0.55 + 0.9 * this.rand[i]))
      else o = Math.max(h, o - dt / cfg.closeMs)
      this.open[i] = o
      if (o !== prev) changed = true
      if (o <= 0 && h <= 0) this.active.delete(i)
    }

    for (let k = this.particles.length - 1; k >= 0; k--) {
      const pt = this.particles[k]
      pt.age += dt
      if (pt.age >= pt.life) this.particles.splice(k, 1)
    }

    this.drawFrame()
    return p.inside || changed || this.particles.length > 0
  }

  private forCellsInRadius(cx: number, cy: number, R: number, fn: (i: number, d: number, ang: number) => void) {
    const cs = this.cs
    const c0 = Math.max(0, Math.floor((cx - R) / cs))
    const c1 = Math.min(this.cols - 1, Math.floor((cx + R) / cs))
    const r0 = Math.max(0, Math.floor((cy - R) / cs))
    const r1 = Math.min(this.rows - 1, Math.floor((cy + R) / cs))
    const R2 = R * R
    for (let r = r0; r <= r1; r++) {
      const py = (r + 0.5) * cs - cy
      for (let c = c0; c <= c1; c++) {
        const px = (c + 0.5) * cs - cx
        const d2 = px * px + py * py
        if (d2 > R2) continue
        fn(r * this.cols + c, Math.sqrt(d2), Math.atan2(py, px))
      }
    }
  }

  private currentRadius() {
    if (this.reducedMotion) return this.radius * 0.8
    const f = Math.min(1, this.pointer.speed / 0.9)
    const idle = EFFECT_CONFIG.idleRadiusFactor
    return this.radius * (idle + (1 - idle) * f)
  }

  private stamp(t: number) {
    const R = this.currentRadius()
    const { sx, sy } = this.pointer
    const wobble = this.reducedMotion ? 0 : 1
    this.forCellsInRadius(sx, sy, R * 1.22, (i, d, ang) => {
      const blob =
        1 + wobble * (0.11 * Math.sin(3 * ang + t * 0.0011) + 0.07 * Math.sin(5 * ang - t * 0.0017 + 1.3))
      const reff = R * blob * (0.8 + 0.2 * this.rand[i])
      let v = (reff - d) / (R * 0.34)
      if (v <= 0) return
      if (v > 1) v = 1
      if (v > this.heat[i]) this.heat[i] = v
      this.active.add(i)
    })
  }

  private spawnParticles(dt: number) {
    const max = EFFECT_CONFIG.maxParticles
    const R = this.currentRadius()
    const count = Math.min(5, Math.ceil(this.pointer.speed * 4 * (dt / 16.67)))
    const half = this.cs / 2
    for (let n = 0; n < count && this.particles.length < max; n++) {
      const ang = Math.random() * Math.PI * 2
      const dist = R * (0.82 + Math.random() * 0.4)
      const x = Math.round((this.pointer.sx + Math.cos(ang) * dist) / half) * half
      const y = Math.round((this.pointer.sy + Math.sin(ang) * dist) / half) * half
      const streak = Math.random() < 0.12
      const size = Math.random() < 0.65 ? half : this.cs * 0.75
      this.particles.push({
        x,
        y,
        w: streak ? this.cs * (2 + Math.floor(Math.random() * 3)) : size,
        h: streak ? 1 : size,
        age: 0,
        life: 300 + Math.random() * 420,
        color: PARTICLE_COLORS[(Math.random() * PARTICLE_COLORS.length) | 0],
      })
    }
  }

  private drawImage() {
    const { ctx, image, cover, dpr } = this
    if (!image) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, cover.dx, cover.dy, cover.dw, cover.dh)
  }

  drawFull() {
    if (!this.image) return
    const ctx = this.ctx
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.drawImage()
    this.prevDirty = null
    this.drawCellsAndParticles()
  }

  /** True when the canvas actually holds pixels (it can silently stay blank on low memory). */
  isPainted(): boolean {
    try {
      const x = Math.floor(this.canvas.width / 2)
      const y = Math.floor(this.canvas.height / 3)
      return this.ctx.getImageData(x, y, 1, 1).data[3] > 0
    } catch {
      return false
    }
  }

  private drawFrame() {
    if (!this.image) return
    const bbox = this.activeBounds()
    const prev = this.prevDirty
    let dirty: Rect | null = bbox
    if (prev) {
      dirty = bbox
        ? { x0: Math.min(bbox.x0, prev.x0), y0: Math.min(bbox.y0, prev.y0), x1: Math.max(bbox.x1, prev.x1), y1: Math.max(bbox.y1, prev.y1) }
        : prev
    }
    if (dirty) {
      const d = this.dpr
      const x = Math.max(0, Math.floor(dirty.x0 * d) - 2)
      const y = Math.max(0, Math.floor(dirty.y0 * d) - 2)
      const x1 = Math.min(this.canvas.width, Math.ceil(dirty.x1 * d) + 2)
      const y1 = Math.min(this.canvas.height, Math.ceil(dirty.y1 * d) + 2)
      if (x1 > x && y1 > y) {
        const ctx = this.ctx
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
        ctx.clearRect(x, y, x1 - x, y1 - y)
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, x1 - x, y1 - y)
        ctx.clip()
        this.drawImage()
        ctx.restore()
      }
    }
    this.drawCellsAndParticles()
    this.prevDirty = bbox
  }

  private activeBounds(): Rect | null {
    if (this.active.size === 0 && this.particles.length === 0) return null
    const cs = this.cs
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const i of this.active) {
      const c = i % this.cols
      const r = (i / this.cols) | 0
      if (c < x0) x0 = c
      if (c > x1) x1 = c
      if (r < y0) y0 = r
      if (r > y1) y1 = r
    }
    let rect: Rect | null =
      x0 === Infinity ? null : { x0: x0 * cs, y0: y0 * cs, x1: (x1 + 1) * cs, y1: (y1 + 1) * cs }
    for (const p of this.particles) {
      const pr = { x0: p.x, y0: p.y, x1: p.x + p.w, y1: p.y + p.h }
      rect = rect
        ? { x0: Math.min(rect.x0, pr.x0), y0: Math.min(rect.y0, pr.y0), x1: Math.max(rect.x1, pr.x1), y1: Math.max(rect.y1, pr.y1) }
        : pr
    }
    return rect
  }

  private drawCellsAndParticles() {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    for (const i of this.active) this.drawCell(i)
    ctx.globalAlpha = 1

    if (this.particles.length) {
      ctx.globalCompositeOperation = 'lighter'
      for (const p of this.particles) {
        const life = 1 - p.age / p.life
        const flicker = Math.random() < 0.12 ? 0.3 : 1
        ctx.globalAlpha = Math.max(0, life * life * 0.7 * flicker)
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.w, p.h)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  private drawCell(i: number) {
    const o = this.open[i]
    if (o <= 0.003) return
    const ctx = this.ctx
    const cs = this.cs
    const x = (i % this.cols) * cs
    const y = ((i / this.cols) | 0) * cs
    const PIX = EFFECT_CONFIG.pixelatePhase

    // Phase 1: the pixel flattens into a solid bevelled cube face over the image.
    if (o < PIX) {
      ctx.globalAlpha = o / PIX
      ctx.fillStyle = this.front[i]
      ctx.fillRect(x, y, cs, cs)
      ctx.fillStyle = this.side[i]
      ctx.fillRect(x + cs - 1, y, 1, cs)
      ctx.fillRect(x, y + cs - 1, cs, 1)
      ctx.fillStyle = this.edge[i]
      ctx.fillRect(x, y, cs - 1, 1)
      ctx.globalAlpha = 1
      return
    }

    // Phase 2: the cube turns a quarter and shrinks, opening a hole to the code layer.
    const p = (o - PIX) / (1 - PIX)
    const e = p * p * (3 - 2 * p)
    const theta = e * Math.PI * 0.5
    const k = Math.pow(1 - e, 0.75)
    ctx.clearRect(x, y, cs, cs)
    if (k < 0.04) return

    const fw = cs * Math.cos(theta) * k
    const sw = cs * Math.sin(theta) * k
    const len = cs * k
    const total = fw + sw
    const flag = this.flags[i]
    const vertical = (flag & 1) === 1
    const reverse = (flag & 2) === 2

    if (!vertical) {
      const oy = y + (cs - len) / 2
      const ox = x + (cs - total) / 2
      const fx = reverse ? ox + sw : ox
      const sx = reverse ? ox : ox + fw
      ctx.fillStyle = this.front[i]
      ctx.fillRect(fx, oy, fw, len)
      ctx.fillStyle = this.side[i]
      ctx.fillRect(sx, oy, sw, len)
      ctx.fillStyle = this.edge[i]
      ctx.fillRect(reverse ? fx : fx + fw - 0.75, oy, Math.min(0.75, fw), len)
    } else {
      const ox = x + (cs - len) / 2
      const oy = y + (cs - total) / 2
      const fy = reverse ? oy + sw : oy
      const sy = reverse ? oy : oy + fw
      ctx.fillStyle = this.front[i]
      ctx.fillRect(ox, fy, len, fw)
      ctx.fillStyle = this.side[i]
      ctx.fillRect(ox, sy, len, sw)
      ctx.fillStyle = this.edge[i]
      ctx.fillRect(ox, reverse ? fy : fy + fw - 0.75, len, Math.min(0.75, fw))
    }
  }
}
