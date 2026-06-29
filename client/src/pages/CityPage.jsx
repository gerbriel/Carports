import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Car, Warehouse, Truck, Tractor, Anchor,
  ChevronDown, ChevronRight, MapPin, Phone, ArrowRight,
  Wind, Snowflake, ExternalLink,
} from 'lucide-react'
import SEOHead from '../components/ui/SEOHead'
import FadeIn from '../components/ui/FadeIn'
import { getCityBySlug } from '../data/cities'

const SERVICES = [
  {
    icon: Car,
    title: 'Metal Carports',
    description: 'Single, double, and triple-wide steel carports for vehicles, equipment, and covered outdoor space.',
    to: '/services/metal-carports',
  },
  {
    icon: Warehouse,
    title: 'Metal Garages',
    description: 'Fully enclosed steel garages with custom door, window, and roof configurations.',
    to: '/services/metal-garages',
  },
  {
    icon: Truck,
    title: 'RV Covers',
    description: 'High-clearance covers engineered for Class A, B, and C motorhomes and fifth-wheels.',
    to: '/services/rv-covers',
  },
  {
    icon: Tractor,
    title: 'Agricultural Buildings',
    description: 'Clear-span hay barns, equipment shelters, and livestock structures for California farms.',
    to: '/services/agricultural-buildings',
  },
  {
    icon: Anchor,
    title: 'Boat Storage',
    description: 'Wide-entry, tall-clearance steel structures for year-round watercraft protection.',
    to: '/services/boat-storage',
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-100">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="font-medium text-slate-900 pr-4">{q}</span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-5 text-sm leading-relaxed text-slate-600">{a}</div>
      )}
    </div>
  )
}

// Normalize the design-load fields across the CA / AZ / NV generators (which use
// slightly different field names) into one shape the Design Loads panel can read.
const DEFAULT_LOAD_DISCLAIMER =
  'Representative values for guidance. Confirm the exact design loads for your parcel with the building department or the ASCE 7 Hazard Tool.'

function normalizeLoads(city) {
  const windNote = city.windNote ?? null
  return {
    wind: city.designWindMph ?? city.designWindSpeed ?? city.windSpeed ?? null,
    snow: city.designSnowPsf ?? city.groundSnowLoad ?? city.groundSnow ?? null,
    exposure: city.windExposure ?? null,
    specialWind: city.specialWind ?? !!windNote,
    windNote,
    snowNote: city.snowNote ?? city.elevationNote ?? city.aboveBandsNote ?? null,
    caseStudy: city.snowCaseStudy ?? false,
    codeRef: city.codeRef ?? null,
    hazardUrl: city.asceHazardToolUrl ?? city.hazardToolUrl ?? 'https://ascehazardtool.org/',
    disclaimer: city.loadDisclaimer ?? DEFAULT_LOAD_DISCLAIMER,
  }
}

export default function CityPage() {
  const { citySlug } = useParams()
  const city = getCityBySlug(citySlug)

  if (!city) {
    return (
      <div className="min-h-screen bg-white pt-32">
        <div className="container py-20 text-center">
          <h1 className="font-display text-4xl font-bold text-slate-900 mb-4">Location Not Found</h1>
          <p className="text-slate-500 mb-8">We couldn't find information for that location.</p>
          <Link to="/locations" className="btn-primary">View All Service Areas</Link>
        </div>
      </div>
    )
  }

  // State-aware copy so the same template serves California, Nevada & Arizona pages.
  const st        = city.stateCode || 'CA'
  const stateName = { CA: 'California', NV: 'Nevada', AZ: 'Arizona' }[st] || 'California'
  const licenseNote = st === 'CA' ? 'CA Licensed Contractor LIC# 1096004. ' : ''
  const loads = normalizeLoads(city)

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: city.faqs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  }

  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Metal Buildings in ${city.name}, ${city.stateCode}`,
    provider: {
      '@type': 'LocalBusiness',
      name: 'Quality Metal Carports Inc.',
      telephone: '+15597554900',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Fresno',
        addressRegion: 'CA',
        addressCountry: 'US',
      },
    },
    areaServed: {
      '@type': 'City',
      name: city.name,
      containedInPlace: { '@type': 'State', name: stateName },
    },
    serviceType: 'Metal Building Construction',
    description: `Custom metal carports, garages, and agricultural buildings serving ${city.name}, ${city.county}, ${stateName}.`,
  }

  return (
    <>
      <SEOHead
        title={`Metal Buildings in ${city.name}, ${st} | Carports, Garages & More`}
        description={`Custom metal carports, garages, RV covers, and agricultural buildings serving ${city.name}, ${city.county}. ${licenseNote}Free quotes. 20-year rust-through warranty.`}
        canonical={`/locations/${city.slug}`}
        breadcrumbs={[
          { label: 'Locations', path: '/locations' },
          { label: `${city.name}, ${st}`, path: `/locations/${city.slug}` },
        ]}
        schemas={[faqSchema, serviceSchema]}
      />

      <div className="min-h-screen bg-white pt-24">
        {/* Hero */}
        <div className="bg-slate-950">
          <div className="container py-16">
            <nav className="flex items-center gap-2 text-xs text-slate-500 mb-6">
              <Link to="/" className="hover:text-slate-300 transition-colors">Home</Link>
              <ChevronRight size={12} />
              <Link to="/locations" className="hover:text-slate-300 transition-colors">Locations</Link>
              <ChevronRight size={12} />
              <span className="text-slate-400">{city.name}, {st}</span>
            </nav>

            <div className="flex items-center gap-2 mb-2">
              <MapPin size={14} className="text-brand" />
              <span className="section-label-light">{city.county} &middot; {city.region}</span>
            </div>
            <h1 className="font-display text-5xl lg:text-7xl font-bold text-white leading-none mt-1 mb-4">
              Metal Buildings in<br />
              <span className="text-brand">{city.name}, {st}</span>
            </h1>
            <p className="text-base text-slate-400 max-w-2xl leading-relaxed">
              {city.introText}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <Link to="/contact" className="btn-primary">Get a Free Quote</Link>
              <a href="tel:5597554900" className="btn-outline-white">
                <Phone size={15} /> 559-755-4900
              </a>
            </div>
          </div>
        </div>

        {/* Highlights bar */}
        <div className="bg-brand/5 border-b border-brand/10">
          <div className="container py-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {city.highlights.map((h) => (
                <div key={h} className="flex items-start gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                  <span className="text-sm text-slate-700">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Services grid */}
        <div className="container py-20">
          <FadeIn>
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-2">
              What We Build in {city.name}
            </h2>
            <p className="text-slate-500 mb-10 max-w-xl">
              Every structure is custom-engineered for your site, use case, and local permit requirements in {city.county}.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map(({ icon: Icon, title, description, to }) => (
              <FadeIn key={title}>
                <Link
                  to={to}
                  className="group flex flex-col gap-4 rounded-lg border border-slate-100 p-6 hover:border-brand/30 hover:shadow-md transition-all duration-200"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-colors duration-200">
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-900 mb-1">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-brand group-hover:gap-2.5 transition-all">
                    Learn more <ArrowRight size={14} />
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>

        {/* Climate & Permit info */}
        <div className="bg-slate-50 border-y border-slate-100">
          <div className="container py-16 grid lg:grid-cols-2 gap-12">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                Climate Considerations
              </h2>
              <p className="text-slate-600 leading-relaxed mb-6">
                {city.name} experiences {city.climate}. We engineer every structure to handle exactly those conditions, from the right gauge steel to anchoring matched to your soil type and local code.
              </p>
              <Link to="/contact" className="btn-primary">Discuss Your Project</Link>
            </FadeIn>
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                Permits in {city.county}
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                {city.permitNotes}
              </p>
              <p className="text-sm text-slate-500">
                Permit authority:{' '}
                {city.permitUrl ? (
                  <a
                    href={city.permitUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
                  >
                    {city.permitOffice}
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                ) : (
                  <span className="font-medium text-slate-700">{city.permitOffice}</span>
                )}
              </p>

              {/* Adopted structural design loads (wind + ground snow), elevation-aware */}
              {(loads.wind != null || loads.snow != null) && (
                <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
                    Design Loads for {city.name}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {loads.wind != null && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Wind size={18} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Design wind speed</p>
                          <p className="font-display text-lg font-bold text-slate-900 leading-tight">
                            {loads.wind} mph
                          </p>
                          <p className="text-xs text-slate-500">
                            {city.windBasis === '3-second gust' ? '3-sec gust' : <>V<sub>ult</sub></>}, Exposure {loads.exposure || 'C'}
                            {loads.specialWind ? ' · Special Wind Region' : ''}
                          </p>
                        </div>
                      </div>
                    )}
                    {loads.snow != null && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Snowflake size={18} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Ground snow load</p>
                          <p className="font-display text-lg font-bold text-slate-900 leading-tight">
                            {loads.snow === 0 ? 'None*' : `${loads.snow}${loads.caseStudy ? '+' : ''} psf`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {loads.snow === 0 ? '*wind governs' : 'ground snow (Pg)'}
                          </p>
                          {loads.caseStudy && (
                            <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                              Site-specific study req'd
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {loads.windNote && (
                    <p className="mt-4 text-xs leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-700">Wind note:</span>{' '}
                      {loads.windNote}
                    </p>
                  )}

                  {loads.snowNote && (
                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-700">Elevation &amp; snow:</span>{' '}
                      {loads.snowNote}
                    </p>
                  )}

                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    {loads.codeRef ? `${loads.codeRef} ` : ''}
                    {loads.disclaimer}
                    {loads.hazardUrl && (
                      <>
                        {' '}
                        <a
                          href={loads.hazardUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand hover:underline"
                        >
                          Look up your parcel (ASCE Hazard Tool)
                          <ExternalLink size={10} className="shrink-0" />
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
            </FadeIn>
          </div>
        </div>

        {/* FAQ */}
        <div className="container py-20">
          <FadeIn>
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-2">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-500 mb-10">
              Common questions about metal buildings in {city.name} and {city.county}.
            </p>
          </FadeIn>
          <div className="max-w-2xl">
            {city.faqs.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>

        {/* Nearby communities */}
        {city.nearbyAreas.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-100">
            <div className="container py-12">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-4">
                Also Serving Nearby Communities
              </p>
              <div className="flex flex-wrap gap-2">
                {city.nearbyAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600"
                  >
                    {area}, {st}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-slate-950 py-16">
          <div className="container text-center">
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Ready to Build in {city.name}?
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Get a free, no-obligation quote for your {city.name} metal building project.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/contact" className="btn-primary-lg">Get a Free Quote</Link>
              <a href="tel:5597554900" className="btn-outline-white"><Phone size={16} /> Call 559-755-4900</a>
            </div>
            <p className="mt-5 text-sm text-slate-500">Call for a free quote &middot; Mon–Fri, 8 AM–5 PM PST</p>
          </div>
        </div>
      </div>
    </>
  )
}
