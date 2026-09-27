export interface OrbitItem {
  title: string
  tag: string
  label: string // micro-etiqueta inferior izquierda cuando esta tarjeta está al centro
  image?: string // opcional: imagen de fondo de la tarjeta (ruta local)
  href?: string
}

// Tarjetas provisionales. Cambia títulos/etiquetas o agrega `image` cuando haya proyectos.
export const ORBIT_ITEMS: OrbitItem[] = [
  { title: 'Proyecto 01', tag: 'Próximamente', label: 'Start' },
  { title: 'Proyecto 02', tag: 'Próximamente', label: 'Stack' },
  { title: 'Proyecto 03', tag: 'Próximamente', label: 'Orbit' },
  { title: 'Proyecto 04', tag: 'Próximamente', label: 'Shift' },
  { title: 'Proyecto 05', tag: 'Próximamente', label: 'Drift' },
  { title: 'Proyecto 06', tag: 'Próximamente', label: 'Loop' },
]

export const ORBIT_TEXT = {
  sectionLabel: '02 / Proyectos',
  rightLabel: 'Selected work — 06',
  ariaLabel: 'Carrusel de proyectos',
}

/**
 * Las tarjetas van en una fila recta que se ve a través de un lente gran angular:
 * al centro se ven normales; hacia los lados se agrandan, se estiran y sus bordes se curvan.
 * Unidades: 1 = la mitad del lado corto del contenedor.
 */
export interface OrbitLens {
  tilt: number // inclinación de la fila (°, positivo = sube a la derecha)
  cardTilt: number // inclinación de cada tarjeta (°); igual a tilt = alineadas con la fila
  bend: number // curvatura extra de la fila (arco)
  lens: number // fuerza del lente: más alto = más estiramiento y curvatura en los lados
  cardH: number // alto de cada tarjeta
  cardAspect: number // ancho / alto de cada tarjeta
  gap: number // separación entre tarjetas
  radius: number // radio de las esquinas (fracción del ancho de la tarjeta)
}

export const ORBIT_LENS: Record<'desktop' | 'tablet' | 'mobile', OrbitLens> = {
  desktop: { tilt: 16, cardTilt: 16, bend: 0.1, lens: 1.1, cardH: 0.74, cardAspect: 0.72, gap: 0.045, radius: 0.03 },
  tablet: { tilt: 22, cardTilt: 18, bend: 0.1, lens: 1.05, cardH: 0.74, cardAspect: 0.72, gap: 0.045, radius: 0.03 },
  mobile: { tilt: 18, cardTilt: 18, bend: 0.12, lens: 1.25, cardH: 0.9, cardAspect: 0.72, gap: 0.05, radius: 0.03 },
}

export const ORBIT_MOTION = {
  duration: 14, // segundos por vuelta completa
  direction: 1 as 1 | -1, // 1 = izquierda → derecha
  hoverSpeed: 0.3, // velocidad relativa con el cursor encima
}
