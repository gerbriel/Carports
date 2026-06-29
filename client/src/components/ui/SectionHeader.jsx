import FadeIn from './FadeIn'

export default function SectionHeader({ label, title, description, light = false, centered = true }) {
  return (
    <FadeIn className={`mb-14 ${centered ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl'}`}>
      {label && (
        <span className={light ? 'section-label-light' : 'section-label'}>
          {label}
        </span>
      )}
      <h2 className={`font-display text-4xl lg:text-5xl font-bold leading-none tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        {title}
      </h2>
      {description && (
        <p className={`mt-4 text-base leading-relaxed ${light ? 'text-slate-400' : 'text-slate-500'}`}>
          {description}
        </p>
      )}
    </FadeIn>
  )
}
