import { useEffect, useState } from 'react'
import { HERO_CONTENT } from '../../config/content'
import { processCodeTexture } from './effects/codeTexture'

// ASCII version of the scene behind the hero image, framed identically so each
// opened pixel reveals the same spot rendered in glyphs.
export function CodeBackdrop() {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    processCodeTexture(HERO_CONTENT.images.codeSrc)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch((err) => console.error('ASCII backdrop failed to load', err))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div aria-hidden="true" className="code-backdrop absolute inset-0 overflow-hidden">
      {url && (
        <>
          <div className="code-scene code-scene--glow absolute inset-0" style={{ backgroundImage: `url(${url})` }} />
          <div className="code-scene absolute inset-0" style={{ backgroundImage: `url(${url})` }} />
        </>
      )}
    </div>
  )
}
