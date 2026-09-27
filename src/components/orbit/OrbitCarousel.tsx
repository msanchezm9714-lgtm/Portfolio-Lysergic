import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PALETTE } from '../../config/content'
import { ORBIT_LENS, ORBIT_MOTION, ORBIT_TEXT, type OrbitItem } from '../../config/orbit'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { buildCardAtlas } from './cardTextures'
import { cardAt, centerIndex, makeLens, type LensFrame } from './lensMath'
import { LensRenderer } from './lensRenderer'

interface OrbitCarouselProps {
  items: OrbitItem[]
  duration?: number
  direction?: 1 | -1
  rightLabel?: string
  active?: boolean // false pauses the loop (e.g. while the section is still hidden)
  onSelect?: (index: number) => void
}

const DRAG_THRESHOLD = 6

function isLowEnd(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
}

function breakpoint(w: number) {
  return w >= 1024 ? 'desktop' : w >= 640 ? 'tablet' : 'mobile'
}

export function OrbitCarousel({
  items,
  duration = ORBIT_MOTION.duration,
  direction = ORBIT_MOTION.direction,
  rightLabel = ORBIT_TEXT.rightLabel,
  active = true,
  onSelect,
}: OrbitCarouselProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const pendingRef = useRef(0)
  const kickRef = useRef<() => void>(() => {})
  const activeRef = useRef(active)
  const syncRunningRef = useRef<() => void>(() => {})
  const centerRef = useRef(0)
  const onSelectRef = useRef(onSelect)
  const [supported, setSupported] = useState(true)
  const reducedMotion = useReducedMotion()
  const n = items.length

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return
    const renderer = LensRenderer.create(canvas, PALETTE.acid)
    if (!renderer) {
      setSupported(false)
      return
    }
    const lowEnd = isLowEnd()
    const dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 2)
    let frame: LensFrame | null = null
    let disposed = false
    let progress = 0
    let speed = reducedMotion ? 0 : 1
    let inertia = 0
    let hovering = false
    let running = false
    let inView = false
    let raf = 0
    let last = 0
    let acc = 0
    let activeIdx = -1
    let atlasAspect = 0
    const drag = { id: -1, x: 0, lastX: 0, lastT: 0, vel: 0, moved: false }

    const offset = () => (frame ? progress * n * frame.pitch : 0)

    const render = () => {
      if (!frame) return
      renderer.draw(frame, offset(), n, dpr)
      const idx = centerIndex(frame, offset(), n)
      centerRef.current = idx
      if (idx !== activeIdx) {
        activeIdx = idx
        if (labelRef.current) labelRef.current.textContent = items[idx].label
      }
    }

    const loadAtlas = (aspect: number) => {
      if (aspect === atlasAspect) return
      atlasAspect = aspect
      buildCardAtlas(items, aspect).then((atlas) => {
        if (disposed || aspect !== atlasAspect) return
        renderer.setAtlas(atlas)
        render()
      })
    }

    const layout = () => {
      const w = root.clientWidth
      const h = root.clientHeight
      if (!w || !h) return
      const geo = ORBIT_LENS[breakpoint(w)]
      frame = makeLens(w, h, geo)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      loadAtlas(geo.cardAspect)
      render()
    }

    const tick = (now: number) => {
      raf = 0
      if (!running) return
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0
      last = now
      if (lowEnd) {
        acc += dt
        if (acc < 1 / 30) {
          raf = requestAnimationFrame(tick)
          return
        }
      }
      const step = lowEnd ? acc : dt
      acc = 0

      const target = reducedMotion ? 0 : hovering ? ORBIT_MOTION.hoverSpeed : 1
      speed += (target - speed) * (1 - Math.exp(-step / 0.35))
      if (drag.id === -1) {
        progress += (direction * speed * step) / duration + inertia * step
        inertia *= Math.exp(-step / 0.6)
      }
      if (pendingRef.current !== 0) {
        const take = pendingRef.current * (1 - Math.exp(-step / (reducedMotion ? 0.08 : 0.14)))
        progress += take
        pendingRef.current -= take
        if (Math.abs(pendingRef.current) < 1e-4) pendingRef.current = 0
      }
      progress = ((progress % 1) + 1) % 1
      render()
      const idle = reducedMotion && drag.id === -1 && pendingRef.current === 0 && Math.abs(inertia) < 1e-4
      if (!idle) raf = requestAnimationFrame(tick)
    }

    const kick = () => {
      if (running && !raf) {
        last = 0
        raf = requestAnimationFrame(tick)
      }
    }
    kickRef.current = kick
    const setRunning = () => {
      const should = inView && activeRef.current && document.visibilityState === 'visible'
      if (should === running) return
      running = should
      if (running) {
        kick()
      } else {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }
    syncRunningRef.current = setRunning

    const pxToProgress = (dx: number) => (frame ? dx / frame.s / (n * frame.pitch) : 0)
    const local = (e: PointerEvent | MouseEvent) => {
      const rect = root.getBoundingClientRect()
      return [((e.clientX - rect.left) / rect.width) * root.clientWidth, ((e.clientY - rect.top) / rect.height) * root.clientHeight]
    }

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      drag.id = e.pointerId
      drag.x = drag.lastX = e.clientX
      drag.lastT = performance.now()
      drag.vel = 0
      drag.moved = false
      inertia = 0
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) {
        if (e.pointerType === 'mouse' && frame) {
          const [x, y] = local(e)
          root.style.cursor = cardAt(frame, x, y, offset(), n) >= 0 ? 'pointer' : ''
        }
        return
      }
      const dx = e.clientX - drag.lastX
      if (!drag.moved && Math.abs(e.clientX - drag.x) > DRAG_THRESHOLD) {
        drag.moved = true
        root.setPointerCapture(e.pointerId)
        root.dataset.dragging = ''
      }
      if (!drag.moved) return
      const now = performance.now()
      const dp = pxToProgress(dx)
      progress += dp
      drag.vel = dp / Math.max(0.008, (now - drag.lastT) / 1000)
      drag.lastX = e.clientX
      drag.lastT = now
      kick()
    }
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.id) return
      const wasDrag = drag.moved
      if (wasDrag) inertia = Math.max(-2, Math.min(2, drag.vel))
      delete root.dataset.dragging
      drag.id = -1
      if (!wasDrag && frame) {
        const [x, y] = local(e)
        const idx = cardAt(frame, x, y, offset(), n)
        if (idx >= 0) onSelectRef.current?.(idx)
      }
      kick()
    }
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovering = true
    }
    const onLeave = () => {
      hovering = false
    }
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      inertia = Math.max(-1.5, Math.min(1.5, inertia + delta * 0.0006 * direction))
      kick()
    }

    const ro = new ResizeObserver(layout)
    ro.observe(root)
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      setRunning()
    })
    io.observe(root)
    document.addEventListener('visibilitychange', setRunning)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerup', onUp)
    root.addEventListener('pointercancel', onUp)
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('wheel', onWheel, { passive: true })
    layout()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', setRunning)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerup', onUp)
      root.removeEventListener('pointercancel', onUp)
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('wheel', onWheel)
      kickRef.current = () => {}
      syncRunningRef.current = () => {}
    }
  }, [n, items, duration, direction, reducedMotion])

  useEffect(() => {
    activeRef.current = active
    syncRunningRef.current()
  }, [active])

  const moveBy = (cards: number) => {
    pendingRef.current += cards / n
    kickRef.current()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    moveBy(e.key === 'ArrowRight' ? 1 : -1)
  }
  // Bring a focused card to the centre (shortest way round the loop).
  const focusCard = (i: number) => {
    let diff = i - centerRef.current
    if (diff > n / 2) diff -= n
    if (diff < -n / 2) diff += n
    if (diff !== 0) moveBy(-diff)
  }

  if (!supported) {
    return (
      <div role="region" aria-label={ORBIT_TEXT.ariaLabel} className="flex gap-3 overflow-x-auto px-5 py-10 sm:px-10">
        {items.map((item, i) => (
          <button
            key={item.title}
            type="button"
            onClick={() => onSelect?.(i)}
            className="flex aspect-[0.72] w-56 shrink-0 flex-col justify-end rounded-md bg-[#0c0e15] p-5 text-left text-[#eef1ff]"
          >
            <span className="text-xl font-medium">{item.title}</span>
            <span className="font-mono-ui mt-1 text-[10px] uppercase tracking-[0.16em] text-white/60">{item.tag}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={ORBIT_TEXT.ariaLabel}
      onKeyDown={onKeyDown}
      className="orbit relative isolate z-0 w-full select-none overflow-hidden"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />

      <ul className="sr-only">
        {items.map((item, i) => (
          <li key={item.title}>
            <button type="button" onFocus={() => focusCard(i)} onClick={() => onSelect?.(i)}>
              {item.title} — {item.tag}
            </button>
          </li>
        ))}
      </ul>

      <div className="orbit-labels font-mono-ui pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-between">
        <span ref={labelRef}>{items[0]?.label}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}
