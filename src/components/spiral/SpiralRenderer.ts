import type { RibbonConfig } from '../../config/spiral'
import { buildRibbon } from './ribbonGeometry'
import type { Mat4 } from './mat4'

// Each bar is a rectangular section swept along a helix and built on the GPU: the section
// twists about the centre line, so two faces (each with its own colours and text) are often
// visible at once, like a stretched cube bent into a spiral. The twist phase animates.
const VERT = `#version 300 es
in vec2 aTS;
in float aFace;
in float aArc;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec4 uA; // radius, taper, wobble, turns
uniform vec4 uB; // height, width, phase, twist
uniform vec4 uC; // twistWaves, twistPhase, depth, offsetY
uniform vec2 uArcScale; // text scale on the wide faces / on the thin faces
uniform float uSpin;
out vec2 vUv;
out vec3 vNormal;
out vec3 vView;
flat out int vFace;
out float vT;

const float TAU = 6.2831853;

vec3 center(float t) {
  float th = uB.z + t * uA.w * TAU;
  float r = uA.x * (1.0 + uA.z * sin(t * 4.4 + uB.z)) + uA.y * (t - 0.5);
  return vec3(r * cos(th), (t - 0.5) * uB.x + uC.w, r * sin(th));
}

void main() {
  float t = aTS.x;
  float s = aTS.y;
  int face = int(aFace + 0.5);
  vec3 p = center(t);
  vec3 T = normalize(center(t + 0.0015) - center(t - 0.0015));
  float th = uB.z + t * uA.w * TAU;
  vec3 radial = vec3(cos(th), 0.0, sin(th));
  vec3 across = normalize(cross(radial, T));
  float phi = uB.w * sin(t * uC.x * TAU + uC.y);
  vec3 W = cos(phi) * across + sin(phi) * radial;
  vec3 N = normalize(cross(T, W));
  float hw = 0.5 * uB.y;
  float hd = 0.5 * uC.z;

  vec3 offset;
  vec3 n;
  float scale;
  if (face == 0) { offset = W * (s * uB.y) + N * hd; n = N; scale = uArcScale.x; }
  else if (face == 1) { offset = W * hw - N * (s * uC.z); n = W; scale = uArcScale.y; }
  else if (face == 2) { offset = -W * (s * uB.y) - N * hd; n = -N; scale = uArcScale.x; }
  else { offset = -W * hw + N * (s * uC.z); n = -W; scale = uArcScale.y; }

  float c = cos(uSpin), sn = sin(uSpin);
  mat3 rot = mat3(c, 0.0, -sn, 0.0, 1.0, 0.0, sn, 0.0, c);
  vec4 view = uView * vec4(rot * (p + offset), 1.0);
  vView = view.xyz;
  vNormal = mat3(uView) * (rot * n);
  vUv = vec2(-aArc * scale, s + 0.5);
  vFace = face;
  vT = t;
  gl_Position = uProj * view;
}`

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vNormal;
in vec3 vView;
flat in int vFace;
in float vT;
uniform float uReveal; // 0..1: how much of the bar has been built (from the top)
uniform sampler2D uText;
uniform float uFlow;
uniform vec3 uFaceBg[4];
uniform vec3 uFaceInk[4];
uniform vec3 uBg;
uniform float uFogNear, uFogFar;
out vec4 outColor;
void main() {
  if (vT < 1.0 - uReveal) discard;
  float ink = texture(uText, vec2(vUv.x + uFlow, vUv.y)).r;
  vec3 col = mix(uFaceBg[vFace], uFaceInk[vFace], ink);
  float facing = abs(dot(normalize(vNormal), normalize(-vView)));
  col *= 0.74 + 0.26 * facing;
  float fog = smoothstep(uFogNear, uFogFar, -vView.z);
  outColor = vec4(mix(col, uBg, fog * 0.7), 1.0);
}`

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error')
  return sh
}

/** Heavy, condensed text strip used as a repeating mask along every ribbon. */
export function buildTextTexture(phrase: string, separator: string): { canvas: HTMLCanvasElement; aspect: number } {
  const h = 256
  const squeeze = 0.8
  const size = Math.round(h * 0.96)
  const font = `600 ${size}px "Space Grotesk", "Helvetica Neue", Arial, sans-serif`
  const text = phrase + separator
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = font
  const w = Math.ceil(probe.measureText(text).width * squeeze)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.scale(squeeze, 1)
  ctx.font = font
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = h * 0.028
  ctx.lineJoin = 'round'
  ctx.textBaseline = 'middle'
  const y = h * 0.47
  ctx.strokeText(text, 0, y)
  ctx.fillText(text, 0, y)
  ctx.restore()
  return { canvas, aspect: w / h }
}

interface RibbonDraw {
  vao: WebGLVertexArrayObject
  count: number
  cfg: RibbonConfig
  arcScale: [number, number]
  bgs: Float32Array
  inks: Float32Array
}

export class SpiralRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly prog: WebGLProgram
  private readonly loc: Record<string, WebGLUniformLocation | null> = {}
  private readonly tex: WebGLTexture
  private ribbons: RibbonDraw[] = []
  private readonly bg: [number, number, number]

  static create(canvas: HTMLCanvasElement, bgHex: string): SpiralRenderer | null {
    // MSAA only on low-density screens: at 2x it adds a lot of memory for little gain.
    const gl = canvas.getContext('webgl2', { antialias: (window.devicePixelRatio || 1) < 2, alpha: false })
    if (!gl) return null
    try {
      return new SpiralRenderer(gl, bgHex)
    } catch {
      return null
    }
  }

  private constructor(gl: WebGL2RenderingContext, bgHex: string) {
    this.gl = gl
    this.bg = rgb(bgHex)
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link error')
    this.prog = prog
    const names = ['uProj', 'uView', 'uA', 'uB', 'uC', 'uArcScale', 'uSpin', 'uText', 'uFlow', 'uFaceBg', 'uFaceInk', 'uBg', 'uFogNear', 'uFogFar', 'uReveal']
    for (const n of names) this.loc[n] = gl.getUniformLocation(prog, n)
    this.tex = gl.createTexture()!
    gl.enable(gl.DEPTH_TEST)
  }

  setScene(ribbons: RibbonConfig[], text: { canvas: HTMLCanvasElement; aspect: number }) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text.canvas)
    gl.generateMipmap(gl.TEXTURE_2D)
    text.canvas.width = 0 // pixels now live in the texture
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8)

    const attr = (name: string, data: Float32Array, size: number) => {
      const loc = gl.getAttribLocation(this.prog, name)
      const buf = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      gl.enableVertexAttribArray(loc)
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
    }
    this.ribbons = ribbons.map((cfg) => {
      const mesh = buildRibbon(cfg)
      const vao = gl.createVertexArray()!
      gl.bindVertexArray(vao)
      attr('aTS', mesh.ts, 2)
      attr('aFace', mesh.face, 1)
      attr('aArc', mesh.arc, 1)
      const ib = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW)
      gl.bindVertexArray(null)
      const bgs = new Float32Array(cfg.faces.flatMap((f) => rgb(f.bg)))
      const inks = new Float32Array(cfg.faces.flatMap((f) => rgb(f.ink)))
      const arcScale: [number, number] = [1 / (cfg.width * text.aspect), 1 / (cfg.depth * text.aspect)]
      return { vao, count: mesh.indices.length, cfg, arcScale, bgs, inks }
    })
  }

  draw(proj: Mat4, view: Mat4, spins: number[], flows: number[], twistPhases: number[], fog: [number, number], reveal = 1) {
    const gl = this.gl
    const c = gl.canvas as HTMLCanvasElement
    gl.viewport(0, 0, c.width, c.height)
    gl.clearColor(this.bg[0], this.bg[1], this.bg[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (!this.ribbons.length) return
    gl.useProgram(this.prog)
    const l = this.loc
    gl.uniformMatrix4fv(l.uProj, false, proj)
    gl.uniformMatrix4fv(l.uView, false, view)
    gl.uniform3f(l.uBg, this.bg[0], this.bg[1], this.bg[2])
    gl.uniform1f(l.uFogNear, fog[0])
    gl.uniform1f(l.uFogFar, fog[1])
    gl.uniform1f(l.uReveal, reveal)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.uniform1i(l.uText, 0)
    this.ribbons.forEach((r, i) => {
      const g = r.cfg
      gl.uniform4f(l.uA, g.radius, g.taper, g.wobble, g.turns)
      gl.uniform4f(l.uB, g.height, g.width, g.phase, g.twist)
      gl.uniform4f(l.uC, g.twistWaves, twistPhases[i], g.depth, g.offsetY)
      gl.uniform2f(l.uArcScale, r.arcScale[0], r.arcScale[1])
      gl.uniform1f(l.uSpin, spins[i])
      gl.uniform1f(l.uFlow, flows[i])
      gl.uniform3fv(l.uFaceBg, r.bgs)
      gl.uniform3fv(l.uFaceInk, r.inks)
      gl.bindVertexArray(r.vao)
      gl.drawElements(gl.TRIANGLES, r.count, gl.UNSIGNED_SHORT, 0)
    })
    gl.bindVertexArray(null)
  }
}
