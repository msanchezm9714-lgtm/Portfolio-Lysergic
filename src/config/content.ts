// Textos editables del hero.
export const HERO_CONTENT = {
  brand: 'Lysergic', // nombre en la navegación
  title: 'Lysergic Portfolio', // título grande del hero
  descriptor: 'Creative Developer / Digital Portfolio',
  scrollCue: 'Desliza para conocer más',
  nav: {
    links: [
      { label: 'Trabajo', href: '#trabajo' },
      { label: 'Sobre mí', href: '#sobre-mi' },
      { label: 'Contacto', href: '#contacto' },
    ],
    availability: { label: 'Disponible para proyectos', href: '#contacto' },
  },
  images: {
    heroSrc: '/assets/hero-dither-boy.png',
    heroAlt:
      'Ilustración en estilo dither: una persona con sudadera sentada sobre una roca, de noche, mirando un cielo con galaxias, planetas y un agujero negro sobre una ciudad iluminada entre montañas.',
    codeSrc: '/assets/ascii-scene.png',
  },
} as const

// Encuadre de la imagen (equivale a object-position). x/y de 0 a 1.
// Si cambias estos valores, actualiza también las clases object-[..] en CodeReveal.tsx.
export const HERO_FOCAL = {
  landscape: { x: 0.62, y: 0.5 },
  portrait: { x: 0.84, y: 0.5 },
} as const

// Sensibilidad y apariencia del efecto de píxeles-cubo.
export const EFFECT_CONFIG = {
  cellSize: 4, // tamaño de cada píxel/cubo en px (más bajo = píxeles más pequeños)
  radiusScale: 0.208, // radio de revelación relativo al lado corto del viewport
  radiusMin: 128,
  radiusMax: 224,
  idleRadiusFactor: 0.62, // radio cuando el cursor está quieto (vs. en movimiento)
  pixelatePhase: 0.28, // fracción de la animación en la que el píxel se vuelve cubo antes de girar
  flipInMs: 120, // velocidad con la que el cubo gira y se abre
  trailDecayMs: 620, // duración de la estela (300–900 ms recomendado)
  closeMs: 170, // velocidad con la que el cubo vuelve a cerrarse
  pointerSmoothing: 0.2, // 0–1, más alto = sigue al cursor más rápido
  maxParticles: 140, // fragmentos de interferencia en el borde
  maxDPR: 2,
} as const

// Transición al hacer scroll: la imagen se desintegra en código y hace zoom al verde.
// Los valores de "progreso" van de 0 (inicio del scroll) a 1 (pantalla verde completa).
export const SCROLL_CONFIG = {
  trackHeightVh: 230, // largo del recorrido de scroll (más alto = animación más lenta)
  cellSize: 14, // tamaño de cada carácter en px
  releaseSpan: 0.46, // ventana de progreso en la que se sueltan los caracteres
  fallDuration: 0.22, // duración de caída de cada carácter (en progreso)
  spinTurns: 4, // vueltas máximas que da cada carácter al caer
  limeStart: 0.28, // cuándo empieza a crecer el verde
  limeEnd: 0.92, // cuándo cubre toda la pantalla
  limeEdgeCells: 4, // grosor del borde pixelado del bloque verde (en caracteres)
  backdropZoom: 0.9, // cuánto se acerca la escena ASCII durante la transición
  uiFadeEnd: 0.12, // cuándo terminan de desaparecer el texto y la navegación
} as const

// Sección verde (su contenido y textos están en config/orbit.ts).
export const LIME_SECTION = {
  id: 'seccion-verde',
} as const

export const PALETTE = {
  night: '#050710',
  acid: '#c4f36c',
  electric: '#4f74ff',
  pale: '#eef6c4',
} as const
