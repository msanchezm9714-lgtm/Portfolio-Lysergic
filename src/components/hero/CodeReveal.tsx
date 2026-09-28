import { useEffect, useRef, useState, type RefObject } from 'react'
import { HERO_CONTENT, HERO_FOCAL } from '../../config/content'
import { loadImage } from './effects/codeTexture'
import { PixelTrail } from './effects/PixelTrail'

interface CodeRevealProps {
  interactionRef: RefObject<HTMLElement | null>
  reducedMotion: boolean
}

const TAP_MAX_MOVE = 10
const TAP_MAX_MS = 400
const TAP_REVEAL_MS = 420

/**
 * Hero image rendered through a canvas so its pixels can turn into cubes and flip
 * open. The <img> stays underneath for fast first paint and screen readers.
 */
export function CodeReveal({ interactionRef, reducedMotion }: CodeRevealProps) {
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
    let lastW = 0
    let lastH = 0
    let tapTimer = 0
    const tap = { id: -1, x: 0, y: 0, t: 0 }

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
      if (!w || !h || (w === lastW && h === lastH)) return
      lastW = w
      lastH = h
      engine.resize(w, h, image, h >= w ? HERO_FOCAL.portrait : HERO_FOCAL.landscape)
      setReady(engine.isPainted())
    }

    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.clientWidth,
        y: ((e.clientY - rect.top) / rect.height) * canvas.clientHeight,
      }
    }
    // Mouse: the reveal follows the cursor. Touch: nothing happens while scrolling; a
    // quick tap opens a short burst where the finger touched.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !engine || target.hasAttribute('data-disintegrating')) return
      const { x, y } = toLocal(e)
      engine.pointerMove(x, y)
      kick()
    }
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      engine?.pointerLeave()
      kick()
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      tap.id = e.pointerId
      tap.x = e.clientX
      tap.y = e.clientY
      tap.t = performance.now()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.pointerId !== tap.id || !engine) return
      tap.id = -1
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y)
      if (moved > TAP_MAX_MOVE || performance.now() - tap.t > TAP_MAX_MS) return
      if (target.hasAttribute('data-disintegrating')) return
      const { x, y } = toLocal(e)
      engine.pointerMove(x, y)
      kick()
      window.clearTimeout(tapTimer)
      tapTimer = window.setTimeout(() => {
        engine?.pointerLeave()
        kick()
      }, TAP_REVEAL_MS)
    }
    const onCancel = () => {
      tap.id = -1
    }

    loadImage(HERO_CONTENT.images.heroSrc)
      .then((img) => {
        if (disposed) return
        image = img
        engine = new PixelTrail(canvas, reducedMotion)
        layout()
        // Only hide the plain <img> once the canvas has really painted the hero; if the
        // browser couldn't allocate it (low memory), the photo stays visible instead.
        setReady(engine.isPainted())
        ro = new ResizeObserver(() => {
          cancelAnimationFrame(resizeRaf)
          resizeRaf = requestAnimationFrame(layout)
        })
        ro.observe(canvas)
        target.addEventListener('pointermove', onMove, { passive: true })
        target.addEventListener('pointerdown', onDown, { passive: true })
        target.addEventListener('pointerleave', onLeave)
        target.addEventListener('pointercancel', onCancel)
        target.addEventListener('pointerup', onUp)
      })
      .catch((err) => console.error('Hero effect failed', err))

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      cancelAnimationFrame(resizeRaf)
      ro?.disconnect()
      window.clearTimeout(tapTimer)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerdown', onDown)
      target.removeEventListener('pointerleave', onLeave)
      target.removeEventListener('pointercancel', onCancel)
      target.removeEventListener('pointerup', onUp)
    }
  }, [interactionRef, reducedMotion])

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
