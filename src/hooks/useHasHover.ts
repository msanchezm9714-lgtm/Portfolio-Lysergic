import { useEffect, useState } from 'react'

// Detecta si el dispositivo tiene un cursor real (hover) para activar el efecto interactivo.
export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: hover) and (pointer: fine)').matches
      : true,
  )

  useEffect(() => {
    const mql = window.matchMedia('(hover: hover) and (pointer: fine)')
    const handler = (e: MediaQueryListEvent) => setHasHover(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return hasHover
}
