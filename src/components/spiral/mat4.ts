// Minimal column-major 4x4 matrix helpers for the spiral camera.

export type Mat4 = Float32Array

export function perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovy / 2)
  const nf = 1 / (near - far)
  const m = new Float32Array(16)
  m[0] = f / aspect
  m[5] = f
  m[10] = (far + near) * nf
  m[11] = -1
  m[14] = 2 * far * near * nf
  return m
}

export function lookAt(eye: number[], center: number[], up: number[]): Mat4 {
  let zx = eye[0] - center[0]
  let zy = eye[1] - center[1]
  let zz = eye[2] - center[2]
  let l = Math.hypot(zx, zy, zz)
  zx /= l
  zy /= l
  zz /= l
  let xx = up[1] * zz - up[2] * zy
  let xy = up[2] * zx - up[0] * zz
  let xz = up[0] * zy - up[1] * zx
  l = Math.hypot(xx, xy, xz)
  xx /= l
  xy /= l
  xz /= l
  const yx = zy * xz - zz * xy
  const yy = zz * xx - zx * xz
  const yz = zx * xy - zy * xx
  const m = new Float32Array(16)
  m[0] = xx
  m[1] = yx
  m[2] = zx
  m[4] = xy
  m[5] = yy
  m[6] = zy
  m[8] = xz
  m[9] = yz
  m[10] = zz
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2])
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2])
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2])
  m[15] = 1
  return m
}
