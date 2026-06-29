import { Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, Phone, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import SEOHead from './ui/SEOHead'
import FadeIn from './ui/FadeIn'

const BASE = 'https://qualitymetalcarportsca.com/wp-content/uploads'

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left group"
        aria-expanded={open}
      >
        <span className="font-sans text-sm font-semibold text-slate-800 group-hover:text-slate-900">
          {q}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-brand' : ''}`}
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-64 pb-5' : 'max-h-0'}`}>
        <p className="text-sm text-slate-500 leading-relaxed pr-6">{a}</p>
      </div>
    </div>
  )
}

export default function ServiceDetailLayout({
  /* SEO */
  seoTitle,
  seoDescription,
  canonical,
  heroImage,
  schemas = [],
  /* Content */
  label,
  h1,
  intro,
  features,
  gallery = [],
  specs,
  faqs = [],
  relatedServices = [],
  showBuilder = true,
}) {
  const faqSchema = faqs.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      }
    : null

  return (
    <>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        canonical={canonical}
        image={heroImage}
        schemas={faqSchema ? [...schemas, faqSchema] : schemas}
        breadcrumbs={[{ label: 'Services', path: '/services' }, { label: label, path: canonical }]}
      />

      {/* Page header */}
      <div className="bg-slate-950 pt-24">
        <div className="container py-14">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <Link to="/" className="hover:text-slate-300 transition-colors">Home</Link>
            <span>/</span>
            <Link to="/services" className="hover:text-slate-300 transition-colors">Services</Link>
            <span>/</span>
            <span className="text-slate-400">{label}</span>
          </nav>

          <span className="section-label-light">{label}</span>
          <h1 className="font-display text-5xl lg:text-7xl font-bold text-white leading-none mt-1 mb-5">
            {h1}
          </h1>
          <p className="text-base text-slate-400 max-w-2xl leading-relaxed">{intro}</p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <Link to="/contact" className="btn-primary-lg">Get a Free Quote</Link>
            <Link to="/builder" className="btn-outline-white">
              <ArrowRight size={16} />
              Open 3D Builder
            </Link>
            <a href="tel:5597554900" className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">
              <Phone size={15} />
              559-755-4900
            </a>
          </div>
        </div>
      </div>

      {/* Hero image */}
      {heroImage && (
        <div className="h-64 sm:h-80 lg:h-[420px] overflow-hidden">
          <img
            src={heroImage}
            alt={h1}
            className="w-full h-full object-cover"
            loading="eager"
          />
        </div>
      )}

      {/* Features */}
      <section className="section bg-white">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-2 items-start">
            <FadeIn>
              <span className="section-label">What's Included</span>
              <h2 className="font-display text-4xl font-bold text-slate-900 mt-1 mb-6 leading-none">
                Features &amp; Options
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <CheckCircle size={15} className="shrink-0 mt-0.5 text-brand" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link to="/contact" className="btn-primary">
                  Request Your Custom Quote <ArrowRight size={15} />
                </Link>
              </div>
            </FadeIn>

            {specs && (
              <FadeIn delay={100}>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-7">
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-5">Quick Specs</h3>
                  <dl className="space-y-3">
                    {specs.map(({ label: lbl, value }) => (
                      <div key={lbl} className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <dt className="text-sm font-medium text-slate-500">{lbl}</dt>
                        <dd className="text-sm font-semibold text-slate-800 text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </FadeIn>
            )}
          </div>
        </div>
      </section>

      {/* Photo gallery */}
      {gallery.length > 0 && (
        <section className="bg-slate-50 py-14">
          <div className="container">
            <FadeIn className="mb-8 text-center">
              <h2 className="font-display text-3xl font-bold text-slate-900">Project Photos</h2>
            </FadeIn>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
              {gallery.map((src, i) => (
                <FadeIn key={i} delay={i * 60}>
                  <div className={`overflow-hidden rounded-lg ${i === 0 ? 'col-span-2 lg:col-span-2 row-span-2' : ''}`}>
                    <img
                      src={src.url}
                      alt={src.alt}
                      className="w-full h-full object-cover aspect-[4/3] hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3D Builder CTA */}
      {showBuilder && (
        <section className="bg-slate-900 py-14">
          <div className="container">
            <FadeIn>
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8 rounded-xl border border-white/10 bg-white/4 px-8 py-10">
                <div>
                  <h2 className="font-display text-3xl font-bold text-white mb-2">
                    Design Yours in 3D Before You Buy
                  </h2>
                  <p className="text-slate-400 max-w-lg text-sm leading-relaxed">
                    Not sure exactly what you want yet? Play with our 3D builder to set your dimensions, roof style, doors, windows, and colors. When it looks right, bring it to us for a custom quote.
                  </p>
                </div>
                <Link
                  to="/builder"
                  className="shrink-0 btn-primary-lg"
                >
                  <ArrowRight size={17} />
                  Launch 3D Builder
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>
      )}

      {/* FAQ (AEO optimized) */}
      {faqs.length > 0 && (
        <section className="section bg-white">
          <div className="container max-w-3xl">
            <FadeIn className="text-center mb-10">
              <span className="section-label">Common Questions</span>
              <h2 className="font-display text-4xl font-bold text-slate-900 mt-1 leading-none">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                Direct answers to the questions we hear most.
              </p>
            </FadeIn>
            <FadeIn delay={80}>
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-6 divide-y divide-slate-100">
                {faqs.map((faq, i) => (
                  <FAQItem key={i} q={faq.q} a={faq.a} />
                ))}
              </div>
            </FadeIn>
          </div>
        </section>
      )}

      {/* Related services */}
      {relatedServices.length > 0 && (
        <section className="bg-slate-50 py-14">
          <div className="container">
            <FadeIn className="mb-8">
              <h2 className="font-display text-3xl font-bold text-slate-900">Related Services</h2>
            </FadeIn>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedServices.map((s) => (
                <FadeIn key={s.to}>
                  <Link
                    to={s.to}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-5 hover:border-brand/40 hover:shadow-sm transition-all duration-150 group"
                  >
                    <span className="font-display text-lg font-bold text-slate-800 group-hover:text-brand transition-colors">
                      {s.label}
                    </span>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-brand transition-colors" />
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="bg-brand py-16">
        <div className="container text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-3">
            Ready to Get Started?
          </h2>
          <p className="text-white/75 mb-8 max-w-md mx-auto text-sm">
            Get a free, itemized quote with no obligation at all. We get back to you within one business day.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded bg-white px-7 py-4 text-sm font-semibold text-brand hover:bg-white/90 transition-colors"
            >
              Get a Free Quote
            </Link>
            <a href="tel:5597554900" className="btn-outline-white"><Phone size={16} /> Call 559-755-4900</a>
          </div>
          <p className="mt-5 text-sm text-slate-500">Call for a free quote &middot; Mon–Fri, 8 AM–5 PM PST</p>
        </div>
      </section>
    </>
  )
}
