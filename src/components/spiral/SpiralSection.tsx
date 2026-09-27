import { useEffect, useRef, useState } from 'react'
import { SPIRAL_MOTION, SPIRAL_RIBBONS, SPIRAL_TEXT } from '../../config/spiral'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { lookAt, perspective } from './mat4'
import { buildTextTexture, SpiralRenderer } from './SpiralRenderer'

const BG = '#050710'
const FOV = (38 * Math.PI) / 180
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export function SpiralSection() {
  const trackRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLHeadingElement>(null)
  const fadeRef = useRef<HTMLDivElement>(null)
  const [supported, setSupported] = useState(true)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const track = trackRef.current
    const canvas = canvasRef.current
    if (!track || !canvas) return
    const renderer = SpiralRenderer.create(canvas, BG)
    if (!renderer) {
      setSupported(false)
      return
    }
    const nav = navigator as Navigator & { deviceMemory?: number }
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
    const dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 2)
    let disposed = false
    let ready = false
    let raf = 0
    let running = false
    let inView = false
    let start = 0
    let w = 0
    let h = 0

    const progress = () => {
      const rect = track.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      return total > 0 ? clamp01(-rect.top / total) : 0
    }
    // 0 when the section's top edge enters the screen, 1 once it reaches the top (pinned).
    const entry = () => clamp01(1 - track.getBoundingClientRect().top / window.innerHeight)

    const render = (time: number) => {
      if (!ready || !w || !h) return
      const p = reducedMotion ? 0 : progress()
      const aspect = w / h
      const base = Math.max(7.2, 2.7 / (Math.tan(FOV / 2) * aspect))
      const dive = smooth(SPIRAL_MOTION.diveStart, 1, p)
      const eyeZ = base + (0.3 - base) * dive
      const eyeY = SPIRAL_MOTION.cameraTilt * (1 - 0.55 * p) * (1 - dive)
      const proj = perspective(FOV + dive * 0.5, aspect, 0.05, 40)
      const view = lookAt([0, eyeY, eyeZ], [0, -0.35 * (1 - dive), -3 * dive], [0, 1, 0])
      // Everything spins together (no bar can pass through another); the scroll also
      // re-twists the bars so they appear to wind around each other.
      const spin = time * SPIRAL_MOTION.idleSpin + p * SPIRAL_MOTION.scrollSpin * Math.PI
      const spins = SPIRAL_RIBBONS.map(() => spin)
      const flows = SPIRAL_RIBBONS.map((r) => time * r.flow)
      const twistPhases = SPIRAL_RIBBONS.map((r) => time * r.breathe + p * SPIRAL_MOTION.scrollTwist * Math.PI)
      // The bar builds itself from the top as the section scrolls in.
      const e = reducedMotion ? 1 : entry()
      const reveal = 1 - Math.pow(1 - smooth(0.05, 0.95, e), 2)
      renderer.draw(proj, view, spins, flows, twistPhases, [base - 1.5, base + 3.5], reveal)

      const fade = smooth(SPIRAL_MOTION.fadeStart, 1, p)
      if (fadeRef.current) fadeRef.current.style.opacity = String(fade)
      if (labelRef.current) {
        // Position of the label inside the lime→black blend (0 = lime top, 1 = fully black).
        const rect = track.getBoundingClientRect()
        const labelY = Math.max(rect.top, 0) + 30
        const k = smooth(0.25, 0.6, (labelY - rect.top) / (window.innerHeight * 0.4))
        const mixc = (a: number, b: number) => Math.round(a + (b - a) * k)
        labelRef.current.style.color = `rgb(${mixc(5, 196)}, ${mixc(7, 243)}, ${mixc(16, 108)})`
      }
      if (labelRef.current) labelRef.current.style.opacity = String(1 - smooth(SPIRAL_MOTION.diveStart - 0.1, SPIRAL_MOTION.diveStart + 0.05, p))
    }

    const tick = (now: number) => {
      raf = 0
      if (!running) return
      if (!start) start = now
      render((now - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    const setRunning = () => {
      const should = inView && !reducedMotion && document.visibilityState === 'visible'
      if (should === running) return
      running = should
      if (running) raf = requestAnimationFrame(tick)
      else cancelAnimationFrame(raf)
    }

    const layout = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      render(0)
    }

    document.fonts.ready.then(() => {
      if (disposed) return
      renderer.setScene(SPIRAL_RIBBONS, buildTextTexture(SPIRAL_TEXT.phrase, SPIRAL_TEXT.separator))
      ready = true
      layout()
    })

    const ro = new ResizeObserver(layout)
    ro.observe(canvas)
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      setRunning()
    })
    io.observe(track)
    document.addEventListener('visibilitychange', setRunning)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', setRunning)
    }
  }, [reducedMotion])

  return (
    <div
      ref={trackRef}
      className="relative bg-[#050710]"
      style={reducedMotion ? undefined : { height: `${SPIRAL_MOTION.trackHeightVh}vh` }}
    >
      {/* Soft lime→black blend with the projects section above, instead of a hard edge. */}
      <div aria-hidden="true" className="section-blend pointer-events-none absolute inset-x-0 top-0 z-30 h-[40vh]" />
      {/* Label sits above the blend; its colour follows what is behind it (see render). */}
      <div className="pointer-events-none sticky top-0 z-40 h-0">
        <h2
          ref={labelRef}
          id={`${SPIRAL_TEXT.id}-title`}
          className="font-mono-ui absolute left-5 top-6 text-[11px] font-normal uppercase tracking-[0.26em] text-[#050710] sm:left-10 lg:left-14 lg:top-8"
        >
          {SPIRAL_TEXT.sectionLabel}
        </h2>
      </div>
      <section
        id={SPIRAL_TEXT.id}
        aria-labelledby={`${SPIRAL_TEXT.id}-title`}
        className="sticky top-0 h-dvh w-full overflow-hidden bg-[#050710]"
      >
        {supported ? (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={SPIRAL_TEXT.ariaLabel}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[clamp(2.5rem,8vw,6rem)] font-semibold leading-none tracking-[-0.03em] text-[#c4f36c]">
            {SPIRAL_TEXT.phrase}
          </p>
        )}
        <div ref={fadeRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 bg-[#050710] opacity-0" />
      </section>
    </div>
  )
}
