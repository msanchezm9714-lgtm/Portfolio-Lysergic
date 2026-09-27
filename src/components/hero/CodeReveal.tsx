import { useEffect, useRef, useState, type RefObject } from 'react'
import { HERO_CONTENT, HERO_FOCAL } from '../../config/content'
import { loadImage } from './effects/codeTexture'
import { PixelTrail } from './effects/PixelTrail'

interface CodeRevealProps {
  interactionRef: RefObject<HTMLElement | null>
  reducedMotion: boolean
  hasHover: boolean
}

// Fixed reveal zones for touch devices (fractions of the hero size).
const STATIC_CLUSTERS = [
  { x: 0.2, y: 0.2, r: 0.19 },
  { x: 0.74, y: 0.07, r: 0.08 },
]

/**
 * Hero image rendered through a canvas so its pixels can turn into cubes and flip
 * open. The <img> stays underneath for fast first paint and screen readers.
 */
export function CodeReveal({ interactionRef, reducedMotion, hasHover }: CodeRevealProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const target = interactionRef.current
    if (!canvas || !target) return

    let disposed = false
    let raf = 0
    let last = 0
    let engine: PixelTrail | null = null
    let image: HTMLImageElement | null = null
    let ro: ResizeObserver | null = null
    let resizeRaf = 0

    const frame = (t: number) => {
      raf = 0
      if (!engine) return
      const dt = last ? t - last : 16.67
      last = t
      if (engine.step(dt, t)) raf = requestAnimationFrame(frame)
      else last = 0
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const layout = () => {
      if (!engine || !image) return
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      engine.resize(w, h, image, h >= w ? HERO_FOCAL.portrait : HERO_FOCAL.landscape)
      if (!hasHover) engine.seedStatic(STATIC_CLUSTERS)
    }

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.clientWidth,
        y: ((e.clientY - rect.top) / rect.height) * canvas.clientHeight,
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!engine || target.hasAttribute('data-disintegrating')) return
      const { x, y } = toLocal(e)
      engine.pointerMove(x, y)
      kick()
    }
    const onLeave = () => {
      engine?.pointerLeave()
      kick()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') onLeave()
    }

    loadImage(HERO_CONTENT.images.heroSrc)
      .then((img) => {
        if (disposed) return
        image = img
        engine = new PixelTrail(canvas, reducedMotion)
        layout()
        setReady(true)
        ro = new ResizeObserver(() => {
          cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(layout)
        })
        ro.observe(canvas)
        target.addEventListener('pointermove', onMove, { passive: true })
        target.addEventListener('pointerdown', onMove, { passive: true })
        target.addEventListener('pointerleave', onLeave)
        target.addEventListener('pointercancel', onLeave)
        target.addEventListener('pointerup', onUp)
      })
      .catch(() => {})

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      cancelAnimationFrame(resizeRaf)
      ro?.disconnect()
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerdown', onMove)
      target.removeEventListener('pointerleave', onLeave)
      target.removeEventListener('pointercancel', onLeave)
      target.removeEventListener('pointerup', onUp)
    }
  }, [interactionRef, reducedMotion, hasHover])

  return (
    <div className="hero-enter-image hero-image-layer absolute inset-0">
      <img
        src={HERO_CONTENT.images.heroSrc}
        alt={HERO_CONTENT.images.heroAlt}
        width={2688}
        height={1152}
        fetchPriority="high"
        decoding="async"
        className={`absolute inset-0 h-full w-full select-none object-cover object-[62%_50%] portrait:object-[84%_50%] ${ready ? 'opacity-0' : ''}`}
        draggable={false}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 h-full w-full ${ready ? '' : 'invisible'}`}
      />
    </div>
  )
}
