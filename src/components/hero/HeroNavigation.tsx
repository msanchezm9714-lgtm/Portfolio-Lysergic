import { useEffect, useId, useRef, useState } from 'react'
import { HERO_CONTENT } from '../../config/content'

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#c4f36c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050710]'

export function HeroNavigation() {
  const { brand, nav } = HERO_CONTENT
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    const onResize = () => window.innerWidth >= 768 && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header className="hero-enter-nav absolute inset-x-0 top-0 z-30">
      <nav
        aria-label="Principal"
        className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-10 md:grid-cols-[1fr_auto_1fr] lg:px-14 lg:py-6"
      >
        <a
          href="#inicio"
          className={`font-mono-ui justify-self-start rounded-sm text-[12px] font-medium uppercase tracking-[0.22em] text-white/90 transition-colors hover:text-white ${focusRing}`}
        >
          {brand}
        </a>

        <ul className="hidden items-center gap-0.5 rounded-full border border-white/10 bg-[#070a18]/35 p-1 backdrop-blur-md md:flex">
          {nav.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`block rounded-full px-4 py-1.5 text-[13px] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white active:bg-white/10 ${focusRing}`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href={nav.availability.href}
          className={`hidden items-center gap-2 justify-self-end rounded-full border border-[#c4f36c]/30 bg-[#070a18]/40 px-3.5 py-1.5 text-[12px] text-white/85 backdrop-blur-md transition-colors hover:border-[#c4f36c]/60 hover:text-white active:scale-[0.98] md:inline-flex ${focusRing}`}
        >
          <span aria-hidden="true" className="status-dot relative inline-block h-1.5 w-1.5 bg-[#c4f36c]" />
          {nav.availability.label}
        </a>

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((v) => !v)}
          className={`relative inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-full border border-white/15 bg-[#070a18]/45 backdrop-blur-md transition-colors hover:border-white/30 active:scale-95 md:hidden ${focusRing}`}
        >
          <span aria-hidden="true" className="flex w-4 flex-col gap-[5px]">
            <span className={`h-px w-full bg-white transition-transform duration-200 ${open ? 'translate-y-[3px] rotate-45' : ''}`} />
            <span className={`h-px w-full bg-white transition-transform duration-200 ${open ? '-translate-y-[3px] -rotate-45' : ''}`} />
          </span>
        </button>
      </nav>

      <div
        id={menuId}
        hidden={!open}
        className="mx-4 rounded-2xl border border-white/10 bg-[#070a18]/85 p-2 backdrop-blur-xl md:hidden"
      >
        <ul className="flex flex-col">
          {nav.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-4 py-3 text-base text-white/85 transition-colors hover:bg-white/5 hover:text-white active:bg-white/10 ${focusRing}`}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="mt-1 border-t border-white/10 pt-2">
            <a
              href={nav.availability.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm text-white/80 hover:bg-white/5 ${focusRing}`}
            >
              <span aria-hidden="true" className="status-dot relative inline-block h-1.5 w-1.5 bg-[#c4f36c]" />
              {nav.availability.label}
            </a>
          </li>
        </ul>
      </div>
    </header>
  )
}
