import type { OrbitLens } from '../../config/orbit'

// JS mirror of the shader mapping, used for hit-testing and the centred-card label.

export interface LensFrame {
  W: number
  H: number
  s: number // px per unit (half the short side)
  geo: OrbitLens
  cardW: number
  pitch: number // distance between card centres along the strip
  dir: [number, number] // strip direction (y up)
  rel: [number, number] // cos/sin of (strip tilt - card tilt)
}

export function makeLens(W: number, H: number, geo: OrbitLens): LensFrame {
  const t = (geo.tilt * Math.PI) / 180
  const a = ((geo.tilt - geo.cardTilt) * Math.PI) / 180
  const cardW = geo.cardH * geo.cardAspect
  const extent = Math.abs(cardW * Math.cos(a)) + Math.abs(geo.cardH * Math.sin(a))
  return {
    W,
    H,
    s: Math.min(W, H) / 2,
    geo,
    cardW,
    pitch: extent + geo.gap,
    dir: [Math.cos(t), Math.sin(t)],
    rel: [Math.cos(a), Math.sin(a)],
  }
}

/** Screen point (CSS px, y down) → strip coordinates (u along, v across). */
function toStrip(f: LensFrame, x: number, y: number): [number, number] {
  const px = (x - f.W / 2) / f.s
  const py = (f.H / 2 - y) / f.s
  const r = Math.hypot(px, py)
  const k = f.geo.lens
  const scale = r < 1e-5 ? 1 : Math.atan(k * r) / k / r
  const qx = px * scale
  const qy = py * scale
  const u = qx * f.dir[0] + qy * f.dir[1]
  const v = -qx * f.dir[1] + qy * f.dir[0] - f.geo.bend * u * u
  return [u, v]
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** Index of the card under a screen point, or -1 for a gap / background. */
export function cardAt(f: LensFrame, x: number, y: number, offset: number, n: number): number {
  const [u, v] = toStrip(f, x, y)
  const sx = u - offset
  const cell0 = Math.round(sx / f.pitch)
  for (let k = -1; k <= 1; k++) {
    const c = cell0 + k
    const du = sx - c * f.pitch
    const lx = du * f.rel[0] - v * f.rel[1]
    const ly = du * f.rel[1] + v * f.rel[0]
    if (Math.abs(lx) <= f.cardW / 2 && Math.abs(ly) <= f.geo.cardH / 2) return mod(c, n)
  }
  return -1
}

export function centerIndex(f: LensFrame, offset: number, n: number): number {
  return mod(Math.round(-offset / f.pitch), n)
}
