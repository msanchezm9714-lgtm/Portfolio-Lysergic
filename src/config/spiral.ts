// Tercera sección: espiral 3D de barras con texto (un "cubo" estirado a lo largo de una curva).

export const SPIRAL_TEXT = {
  id: 'manifiesto',
  sectionLabel: '03 / Manifiesto',
  phrase: 'Nomeimportasaberporqué', // texto que corre sobre las caras (se repite sin espacios)
  separator: '',
  ariaLabel: 'Espiral animada con la frase: No me importa saber por qué',
}

export interface FaceStyle {
  bg: string
  ink: string
}

export interface RibbonConfig {
  radius: number // radio medio del espiral (unidades 3D)
  taper: number // embudo: diferencia de radio entre arriba y abajo (positivo = más abierto arriba)
  wobble: number // ondulación del radio a lo largo de la barra
  turns: number // vueltas completas
  height: number // altura total
  offsetY: number // desplazamiento vertical (negativo = más abajo)
  width: number // ancho de la barra (caras 1 y 3)
  depth: number // grosor de la barra (caras 2 y 4); igual a width = sección cuadrada
  phase: number // desfase inicial (radianes)
  twist: number // cuánto se tuerce la barra sobre sí misma (radianes)
  twistWaves: number // cuántas veces se tuerce a lo largo del recorrido
  breathe: number // velocidad a la que la torsión "respira" (0 = forma fija)
  flow: number // velocidad del texto (vueltas de la frase por segundo)
  // Colores de las 4 caras en orden: exterior, lateral, interior, lateral
  faces: [FaceStyle, FaceStyle, FaceStyle, FaceStyle]
}

const LIME = '#c4f36c'
const PALE = '#e9f8b0'
const INK = '#050710'

export const SPIRAL_RIBBONS: RibbonConfig[] = [
  {
    radius: 1.8, taper: 0.5, wobble: 0.08, turns: 2.5, height: 6.2, offsetY: 0.2,
    width: 0.95, depth: 0.72, phase: 0,
    twist: 1.2, twistWaves: 2.0, breathe: 0.16, flow: 0.1,
    faces: [
      { bg: PALE, ink: INK },
      { bg: INK, ink: LIME },
      { bg: LIME, ink: INK },
      { bg: INK, ink: PALE },
    ],
  },
]

export const SPIRAL_MOTION = {
  trackHeightVh: 260, // largo del recorrido de scroll de la sección (más alto = más lento)
  idleSpin: 0.08, // giro automático lento (radianes por segundo)
  scrollSpin: 1.6, // vueltas extra (en π) que da la espiral con el scroll
  scrollTwist: 1.4, // cuánto se retuerce la barra con el scroll (en π)
  cameraTilt: 1.9, // altura de la cámara: más alto = se ve más desde arriba
  diveStart: 0.72, // progreso en el que la cámara empieza a entrar en la espiral
  fadeStart: 0.86, // progreso en el que empieza el fundido a negro
}
