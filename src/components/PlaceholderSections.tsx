// Destinos de los enlaces de navegación. Sustituir por el contenido real del portafolio.
const SECTIONS = [
  { id: 'trabajo', label: '01 / Trabajo', title: 'Trabajo seleccionado', body: 'Aquí irán los proyectos destacados.' },
  { id: 'sobre-mi', label: '02 / Sobre mí', title: 'Sobre mí', body: 'Aquí irá una breve presentación.' },
  { id: 'contacto', label: '03 / Contacto', title: 'Contacto', body: 'Aquí irán los datos de contacto.' },
]

export function PlaceholderSections() {
  return (
    <main className="bg-[#050710] text-white">
      {SECTIONS.map((s) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-title`}
          className="scroll-mt-4 border-t border-white/[0.06] px-5 py-24 sm:px-10 lg:px-14"
        >
          <p className="font-mono-ui text-[11px] uppercase tracking-[0.26em] text-[#c4f36c]/80">{s.label}</p>
          <h2 id={`${s.id}-title`} className="mt-3 text-3xl font-medium tracking-[-0.02em] text-[#eef1ff] sm:text-4xl">
            {s.title}
          </h2>
          <p className="mt-3 max-w-md text-white/55">{s.body}</p>
        </section>
      ))}
    </main>
  )
}
