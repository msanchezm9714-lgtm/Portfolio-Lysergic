import { useRef, useState } from 'react'
import { HERO_CONTENT, LIME_SECTION, SCROLL_CONFIG } from '../../config/content'
import { LimeContent, LimeSection, LIME_TITLE_ID } from '../LimeSection'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { AtmosphereOverlay } from './AtmosphereOverlay'
import { CodeBackdrop } from './CodeBackdrop'
import { CodeReveal } from './CodeReveal'
import { HeroNavigation } from './HeroNavigation'
import { ScrollDisintegration } from './ScrollDisintegration'

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-[#c4f36c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050710]'

export function PortfolioHero() {
  const trackRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const uiRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLElement>(null)
  const nextInnerRef = useRef<HTMLDivElement>(null)
  const [nextVisible, setNextVisible] = useState(false)
  const reducedMotion = useReducedMotion()
  const { title, descriptor, scrollCue } = HERO_CONTENT

  // Scroll to the end of the hero transition, where the projects section is fully open.
  const goNext = () => {
    const track = trackRef.current
    if (!track) return
    const top = track.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + track.offsetHeight - (sectionRef.current?.clientHeight ?? window.innerHeight), behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  return (
    <>
    <div
      id="inicio"
      ref={trackRef}
      className="relative"
      style={reducedMotion ? undefined : { height: `${SCROLL_CONFIG.trackHeightVh}vh` }}
    >
      <section
        ref={sectionRef}
        aria-labelledby="hero-title"
        className="sticky top-0 isolate h-lvh w-full overflow-hidden bg-[#050710]"
      >
        <CodeBackdrop />
        <CodeReveal interactionRef={sectionRef} reducedMotion={reducedMotion} />
        <AtmosphereOverlay />
        <div aria-hidden="true" className="hero-scrim pointer-events-none absolute inset-0" />
        {!reducedMotion && (
          <section
            ref={nextRef}
            id={LIME_SECTION.id}
            aria-labelledby={LIME_TITLE_ID}
            className="absolute inset-0 z-[14] overflow-hidden bg-[#c4f36c] text-[#070a14]"
            style={{ visibility: 'hidden' }}
          >
            <div ref={nextInnerRef} className="h-full origin-center">
              <LimeContent active={nextVisible} />
            </div>
          </section>
        )}
        {!reducedMotion && (
          <ScrollDisintegration
            trackRef={trackRef}
            sectionRef={sectionRef}
            uiRef={uiRef}
            nextRef={nextRef}
            nextInnerRef={nextInnerRef}
            onNextVisibleChange={setNextVisible}
          />
        )}

        <div ref={uiRef} className="absolute inset-0 z-20">
          <HeroNavigation />

          <div className="hero-bottom-safe flex h-full flex-col justify-end px-5 pt-28 sm:px-10 lg:px-14">
            <div className="hero-enter-content hero-copy isolate max-w-[34rem]">
              <p className="font-mono-ui flex items-center gap-2.5 text-[11px] uppercase tracking-[0.26em] text-[#c4f36c]">
                <span aria-hidden="true" className="inline-block h-1.5 w-1.5 bg-[#c4f36c]" />
                {descriptor}
              </p>
              <h1
                id="hero-title"
                className="mt-4 text-[clamp(2.5rem,6.4vw,5.75rem)] font-medium leading-[0.95] tracking-[-0.035em] text-[#eef1ff]"
              >
                {title}
              </h1>
              <button
                type="button"
                onClick={goNext}
                className={`scroll-cue group mt-8 inline-flex items-center gap-3 rounded-full py-2 pr-3 text-left ${focusRing}`}
              >
                <span aria-hidden="true" className="scroll-cue__arrows">
                  <svg viewBox="0 0 16 10" className="scroll-cue__arrow"><path d="M1 1.5 8 8.5 15 1.5" /></svg>
                  <svg viewBox="0 0 16 10" className="scroll-cue__arrow"><path d="M1 1.5 8 8.5 15 1.5" /></svg>
                </span>
                <span className="font-mono-ui text-[11px] uppercase tracking-[0.26em] text-[#eef1ff]/85 transition-colors group-hover:text-[#c4f36c]">
                  {scrollCue}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
    {reducedMotion && <LimeSection />}
    </>
  )
}
