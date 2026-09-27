import { LIME_SECTION } from '../config/content'
import { ORBIT_ITEMS, ORBIT_TEXT } from '../config/orbit'
import { OrbitCarousel } from './orbit/OrbitCarousel'

export const LIME_TITLE_ID = `${LIME_SECTION.id}-title`

/** Content of the lime section. `active` pauses the carousel while it is off screen. */
export function LimeContent({ active = true }: { active?: boolean }) {
  return (
    <div className="relative flex h-full min-h-dvh w-full flex-col justify-center">
      <h2
        id={LIME_TITLE_ID}
        className="font-mono-ui absolute left-5 top-6 z-10 text-[11px] font-normal uppercase tracking-[0.26em] text-[#070a14]/70 sm:left-10 lg:left-14 lg:top-8"
      >
        {ORBIT_TEXT.sectionLabel}
      </h2>
      <OrbitCarousel items={ORBIT_ITEMS} active={active} />
      <div aria-hidden="true" className="orbit-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5" />
    </div>
  )
}

// Standalone version, used when the scroll transition is disabled (reduced motion).
export function LimeSection() {
  return (
    <section
      id={LIME_SECTION.id}
      aria-labelledby={LIME_TITLE_ID}
      className="relative overflow-hidden bg-[#c4f36c] text-[#070a14]"
    >
      <LimeContent />
    </section>
  )
}
