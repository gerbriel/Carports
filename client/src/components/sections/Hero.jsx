import { Link } from 'react-router-dom'
import { ShieldCheck, ChevronDown, Phone, Box } from 'lucide-react'

const STATS = [
  { value: '20', label: 'Yr Rust-Through' },
  { value: '100%', label: 'Custom Built' },
  { value: 'CA', label: 'Licensed & Insured' },
  { value: '15+', label: 'Years Experience' },
]

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-slate-950">
      {/* Grid texture */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-100" />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/80 to-slate-950/90" />

      {/* Accent glow */}
      <div className="absolute top-1/4 right-0 h-[600px] w-[600px] -translate-y-1/2 translate-x-1/3 rounded-full bg-brand/8 blur-[120px]" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] -translate-x-1/3 rounded-full bg-brand/5 blur-[100px]" />

      <div className="relative z-10 container pt-28 pb-24">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm font-medium text-brand-light"
            style={{ animationDelay: '0ms', animation: 'fade-up 0.6s ease forwards' }}
          >
            <ShieldCheck size={14} />
            CA LIC# 1096004 &nbsp;&middot;&nbsp; Fresno &amp; Northern California
          </div>

          {/* Headline */}
          <h1
            className="font-display text-7xl font-bold leading-none tracking-tight text-white lg:text-[96px]"
            style={{ animation: 'fade-up 0.6s ease 80ms both' }}
          >
            Built to Last.<br />
            <span className="text-brand">Steel Strong.</span>
          </h1>

          {/* Sub */}
          <p
            className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300"
            style={{ animation: 'fade-up 0.6s ease 160ms both' }}
          >
            That truck, RV, or tractor sitting out in the Valley sun deserves better. We build custom steel carports, garages, and barns made for California weather, backed by warranties we put in writing and a local crew that sticks around long after the job is done.
          </p>

          {/* CTAs */}
          <div
            className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap"
            style={{ animation: 'fade-up 0.6s ease 240ms both' }}
          >
            <Link to="/contact" className="btn-primary-lg">
              Get a Free Quote
            </Link>
            <a href="tel:5597554900" className="btn-outline-white">
              <Phone size={16} />
              Call 559-755-4900
            </a>
            <Link
              to="/builder"
              className="flex items-center gap-2 px-6 py-4 rounded border border-white/20 text-sm font-semibold text-slate-300 hover:border-white/50 hover:text-white transition-colors"
            >
              <Box size={15} />
              3D Builder
            </Link>
          </div>

          {/* Stats */}
          <div
            className="mt-16 flex flex-wrap gap-x-10 gap-y-4"
            style={{ animation: 'fade-up 0.6s ease 320ms both' }}
          >
            {STATS.map((stat, i) => (
              <div key={stat.label} className="flex items-center gap-3">
                {i > 0 && <div className="hidden h-8 w-px bg-white/15 sm:block" />}
                <div>
                  <div className="font-display text-3xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs font-medium uppercase tracking-widest text-slate-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#trust"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-slate-600 hover:text-slate-400 transition-colors"
        aria-label="Scroll down"
      >
        <span className="text-xs tracking-widest uppercase font-medium">Scroll</span>
        <ChevronDown size={18} className="animate-bounce" />
      </a>
    </section>
  )
}
