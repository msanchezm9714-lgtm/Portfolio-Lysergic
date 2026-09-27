// Slow indigo/violet gradient waves, masked to the sky area only.
export function AtmosphereOverlay() {
  return (
    <div aria-hidden="true" className="atmosphere pointer-events-none absolute inset-0">
      <div className="atmo-blob atmo-a" />
      <div className="atmo-blob atmo-b" />
      <div className="atmo-blob atmo-c" />
      <div className="atmo-wave" />
    </div>
  )
}
