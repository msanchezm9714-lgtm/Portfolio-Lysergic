import type { LensFrame } from './lensMath'

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

// Every pixel is traced back through a wide-angle lens (r_src = atan(k r) / k) onto a flat
// strip of cards. Magnification grows towards the edges, so side cards stretch and their
// straight borders bend, like looking at them through a curved piece of glass.
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uScale;
uniform float uOffset;
uniform vec2 uDir;
uniform float uBend;
uniform float uLens;
uniform vec2 uCard;
uniform float uPitch;
uniform vec2 uRel; // cos/sin of (strip tilt - card tilt)
uniform float uRadius;
uniform float uCount;
uniform vec3 uBg;
uniform sampler2D uAtlas;
out vec4 outColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uScale;
  float r = length(p);
  vec2 q = r < 1e-5 ? p : p * (atan(uLens * r) / uLens / r);
  float u = dot(q, uDir);
  float v = dot(q, vec2(-uDir.y, uDir.x)) - uBend * u * u;

  // Cards keep their own tilt (upright on mobile) while travelling along the strip,
  // so the nearest card and its neighbours are tested.
  float x = u - uOffset;
  float cell0 = floor(x / uPitch + 0.5);
  float d = 1e9;
  vec2 l = vec2(0.0);
  float cell = cell0;
  for (int k = -1; k <= 1; k++) {
    float c = cell0 + float(k);
    float du = x - c * uPitch;
    vec2 lc = vec2(du * uRel.x - v * uRel.y, du * uRel.y + v * uRel.x);
    float dc = sdRoundBox(lc, 0.5 * uCard, uRadius);
    if (dc < d) { d = dc; l = lc; cell = c; }
  }
  float aa = max(fwidth(d), 1e-5);
  float inside = 1.0 - smoothstep(-aa, aa, d);

  float idx = mod(cell, uCount);
  vec2 uv = vec2((idx + clamp(l.x / uCard.x + 0.5, 0.001, 0.999)) / uCount, 0.5 - l.y / uCard.y);
  vec2 cont = vec2(l.x / (uCard.x * uCount), -l.y / uCard.y);
  vec3 card = textureGrad(uAtlas, uv, dFdx(cont), dFdy(cont)).rgb;
  outColor = vec4(mix(uBg, card, inside), 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error')
  return sh
}

const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

export class LensRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly tex: WebGLTexture
  private readonly loc: Record<string, WebGLUniformLocation | null> = {}
  private hasTexture = false
  private readonly bg: [number, number, number]

  get maxTextureSize(): number {
    return this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number
  }

  static create(canvas: HTMLCanvasElement, bgHex: string): LensRenderer | null {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false })
    if (!gl) return null
    try {
      return new LensRenderer(gl, bgHex)
    } catch {
      return null
    }
  }

  private constructor(gl: WebGL2RenderingContext, bgHex: string) {
    this.gl = gl
    this.bg = hexToRgb(bgHex)
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link error')
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    for (const name of ['uRes', 'uScale', 'uOffset', 'uDir', 'uBend', 'uLens', 'uCard', 'uPitch', 'uRel', 'uRadius', 'uCount', 'uBg', 'uAtlas']) {
      this.loc[name] = gl.getUniformLocation(prog, name)
    }
    this.tex = gl.createTexture()!
  }

  setAtlas(atlas: HTMLCanvasElement) {
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8)
    this.hasTexture = true
  }

  draw(f: LensFrame, offset: number, count: number, dpr: number) {
    if (!this.hasTexture) return
    const gl = this.gl
    const c = gl.canvas as HTMLCanvasElement
    gl.viewport(0, 0, c.width, c.height)
    const l = this.loc
    gl.uniform2f(l.uRes, c.width, c.height)
    gl.uniform1f(l.uScale, f.s * dpr)
    gl.uniform1f(l.uOffset, offset)
    gl.uniform2f(l.uDir, f.dir[0], f.dir[1])
    gl.uniform1f(l.uBend, f.geo.bend)
    gl.uniform1f(l.uLens, f.geo.lens)
    gl.uniform2f(l.uCard, f.cardW, f.geo.cardH)
    gl.uniform1f(l.uPitch, f.pitch)
    gl.uniform2f(l.uRel, f.rel[0], f.rel[1])
    gl.uniform1f(l.uRadius, f.cardW * f.geo.radius)
    gl.uniform1f(l.uCount, count)
    gl.uniform3f(l.uBg, this.bg[0], this.bg[1], this.bg[2])
    gl.uniform1i(l.uAtlas, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
