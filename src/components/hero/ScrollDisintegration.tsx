import { useEffect, useRef, type RefObject } from 'react'
import { HERO_CONTENT, HERO_FOCAL, SCROLL_CONFIG } from '../../config/content'
import { loadImage } from './effects/codeTexture'
import { Disintegration } from './effects/Disintegration'

interface ScrollDisintegrationProps {
  trackRef: RefObject<HTMLElement | null>
  sectionRef: RefObject<HTMLElement | null>
  uiRef: RefObject<HTMLElement | null>
  // Second section layered under the canvas, revealed through the zooming lime window.
  nextRef: RefObject<HTMLElement | null>
  nextInnerRef: RefObject<HTMLElement | null>
  onNextVisibleChange: (visible: boolean) => void
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export function ScrollDisintegration({
  trackRef,
  sectionRef,
  uiRef,
  nextRef,
  nextInnerRef,
  onNextVisibleChange,
}: ScrollDisintegrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onVisibleRef = useRef(onNextVisibleChange)
  useEffect(() => {
    onVisibleRef.current = onNextVisibleChange
  }, [onNextVisibleChange])

  useEffect(() => {
    const canvas = canvasRef.current
    const track = trackRef.current
    const section = sectionRef.current
    const ui = uiRef.current
    const next = nextRef.current
    const nextInner = nextInnerRef.current
    if (!canvas || !track || !section || !ui || !next || !nextInner) return

    let disposed = false
    let raf = 0
    let lastP = -1
    let nextVisible: boolean | null = null
    let engine: Disintegration | null = null
    let image: HTMLImageElement | null = null
    let ro: ResizeObserver | null = null

    const setNextVisible = (v: boolean) => {
      if (v === nextVisible) return
      nextVisible = v
      next.style.visibility = v ? '' : 'hidden'
      onVisibleRef.current(v)
    }

    const update = () => {
      raf = 0
      const rect = track.getBoundingClientRect()
      // section height (100lvh) rather than innerHeight: it doesn't change with the mobile toolbar
      const total = rect.height - section.clientHeight
      const p = total > 0 ? clamp01(-rect.top / total) : 0
      if (p === lastP) return
      lastP = p
      const win = engine ? engine.render(p) : null
      section.toggleAttribute('data-disintegrating', p > 0)
      section.style.setProperty('--backdrop-zoom', String(1 + SCROLL_CONFIG.backdropZoom * Math.pow(p, 1.6)))
      const fade = clamp01(p / SCROLL_CONFIG.uiFadeEnd)
      ui.style.opacity = String(1 - fade)
      ui.style.transform = fade > 0 ? `translate3d(0, ${-fade * 60}px, 0)` : ''
      ui.style.visibility = fade >= 1 ? 'hidden' : ''

      if (win) {
        const W = canvas.clientWidth
        const H = canvas.clientHeight
        const full = win.amount >= 1
        next.style.clipPath = full
          ? ''
          : `inset(${Math.max(0, win.y0)}px ${Math.max(0, W - win.x1)}px ${Math.max(0, H - win.y1)}px ${Math.max(0, win.x0)}px)`
        next.style.pointerEvents = full ? '' : 'none'
        // The section is scaled to the window's size so it grows as one piece with the
        // lime block and lands at its natural size exactly when the block fills the screen.
        const z = Math.min((win.x1 - win.x0) / W, (win.y1 - win.y0) / H)
        nextInner.style.transform = full ? '' : `scale(${Math.max(0.001, z).toFixed(4)})`
        setNextVisible(true)
      } else {
        setNextVisible(false)
      }
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    let lastW = 0
    let lastH = 0
    const layout = () => {
      if (!engine || !image) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h || (w === lastW && h === lastH)) return
      lastW = w
      lastH = h
      engine.resize(w, h, image, h >= w ? HERO_FOCAL.portrait : HERO_FOCAL.landscape)
      lastP = -1
      schedule()
    }

    setNextVisible(false)
    Promise.all([loadImage(HERO_CONTENT.images.heroSrc), document.fonts.ready])
      .then(([img]) => {
        if (disposed) return
        image = img
        engine = new Disintegration(canvas)
        layout()
        ro = new ResizeObserver(layout)
        ro.observe(canvas)
      })
      .catch(() => {})

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      section.removeAttribute('data-disintegrating')
      section.style.removeProperty('--backdrop-zoom')
      ui.style.opacity = ''
      ui.style.transform = ''
      ui.style.visibility = ''
      next.style.clipPath = ''
      next.style.visibility = ''
      next.style.pointerEvents = ''
      nextInner.style.transform = ''
    }
  }, [trackRef, sectionRef, uiRef, nextRef, nextInnerRef])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[15] h-full w-full" />
}
