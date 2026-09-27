import type { RibbonConfig } from '../../config/spiral'

export interface RibbonMesh {
  ts: Float32Array // (t along 0..1, s across its face -0.5..0.5); the shader builds the shape
  face: Float32Array // which of the 4 sides of the bar (0..3)
  arc: Float32Array // arclength of the centre line, used for the text coordinate
  indices: Uint16Array
}

// Must match `center()` in the vertex shader.
export function ribbonCenter(cfg: RibbonConfig, t: number): [number, number, number] {
  const theta = cfg.phase + t * cfg.turns * Math.PI * 2
  const r = cfg.radius * (1 + cfg.wobble * Math.sin(t * 4.4 + cfg.phase)) + cfg.taper * (t - 0.5)
  return [r * Math.cos(theta), (t - 0.5) * cfg.height + cfg.offsetY, r * Math.sin(theta)]
}

/** A rectangular bar swept along the helix: 4 flat faces, each a strip of 2 triangles wide. */
export function buildRibbon(cfg: RibbonConfig, segments = 900): RibbonMesh {
  const rows = segments + 1
  const arcAt = new Float32Array(rows)
  let len = 0
  let prev = ribbonCenter(cfg, 0)
  for (let j = 0; j < rows; j++) {
    const p = ribbonCenter(cfg, j / segments)
    if (j > 0) len += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2])
    prev = p
    arcAt[j] = len
  }

  const perFace = rows * 2
  const count = perFace * 4
  const ts = new Float32Array(count * 2)
  const face = new Float32Array(count)
  const arc = new Float32Array(count)
  const indices = new Uint16Array(segments * 6 * 4)
  let o = 0
  for (let f = 0; f < 4; f++) {
    const base = f * perFace
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < 2; i++) {
        const k = base + j * 2 + i
        ts[k * 2] = j / segments
        ts[k * 2 + 1] = i - 0.5
        face[k] = f
        arc[k] = arcAt[j]
      }
    }
    for (let j = 0; j < segments; j++) {
      const a = base + j * 2
      const b = a + 2
      indices[o++] = a
      indices[o++] = b
      indices[o++] = a + 1
      indices[o++] = a + 1
      indices[o++] = b
      indices[o++] = b + 1
    }
  }
  return { ts, face, arc, indices }
}
