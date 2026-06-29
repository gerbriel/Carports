import { Link } from 'react-router-dom'
import { MapPin, ArrowRight, Phone, Star } from 'lucide-react'
import SEOHead from '../components/ui/SEOHead'
import FadeIn from '../components/ui/FadeIn'
import { CITIES, FEATURED_CITY_LIST, STATE_DIRECTORY } from '../data/cities'
import LocationSearch from '../components/ui/LocationSearch'

const STATE_NAME = { CA: 'California', NV: 'Nevada', AZ: 'Arizona' }

const areaServedSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Quality Metal Carports Inc.',
  telephone: '+15597554900',
  url: 'https://qualitymetalcarportsca.com',
  areaServed: CITIES.map((c) => ({
    '@type': 'City',
    name: c.name,
    containedInPlace: { '@type': 'State', name: STATE_NAME[c.stateCode] || 'California' },
  })),
}

export default function LocationsPage() {
  return (
    <>
      <SEOHead
        title="Service Areas | Metal Buildings Across Arizona, California & Nevada"
        description="Quality Metal Carports builds metal carports, garages, RV covers & ag buildings in every city and county across Arizona, California & Nevada. Free quotes & engineer-stamped drawings."
        canonical="/locations"
        breadcrumbs={[{ label: 'Locations', path: '/locations' }]}
        schemas={[areaServedSchema]}
      />

      <div className="min-h-screen bg-white pt-24">
        {/* Hero */}
        <div className="bg-slate-950">
          <div className="container py-16">
            <span className="section-label-light">Where We Build</span>
            <h1 className="font-display text-5xl lg:text-7xl font-bold text-white leading-none mt-1 mb-4">
              Service Areas
            </h1>
            <p className="text-base text-slate-400 max-w-xl leading-relaxed">
              We design, deliver, and install custom steel buildings in every city and county across Arizona, California &amp; Nevada, each one engineered for your local climate, soil, and permit requirements.
            </p>

            <div className="mt-8">
              <LocationSearch variant="light" />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <Link to="/contact" className="btn-primary">Get a Free Quote</Link>
              <a href="tel:5597554900" className="btn-outline-white">
                <Phone size={15} /> 559-755-4900
              </a>
            </div>
          </div>
        </div>

        {/* Featured cities */}
        <div className="container py-16">
          <FadeIn>
            <div className="flex items-center gap-2 mb-1">
              <Star size={16} className="text-brand" />
              <span className="section-label">Primary Service Hubs</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-slate-900 mb-1">
              Central & Northern California
            </h2>
            <p className="text-sm text-slate-500 mb-6 max-w-xl">
              Our home markets, where you get the fastest turnaround and the most crew availability.
            </p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {FEATURED_CITY_LIST.map((city) => (
              <Link
                key={city.slug}
                to={`/locations/${city.slug}`}
                className="group flex items-start gap-3 rounded-lg border border-brand/20 bg-brand/5 p-5 hover:border-brand/40 hover:shadow-md transition-all duration-200"
              >
                <MapPin size={16} className="shrink-0 mt-0.5 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 group-hover:text-brand transition-colors">
                    {city.name}, CA
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">{city.county}</div>
                </div>
                <ArrowRight size={14} className="shrink-0 mt-0.5 text-slate-300 group-hover:text-brand transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Full statewide directory */}
        <div className="bg-slate-50 border-y border-slate-100">
          <div className="container py-16">
            <FadeIn>
              <span className="section-label">Full Directory</span>
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-1">
                Every City &amp; County We Serve
              </h2>
              <p className="text-sm text-slate-500 mb-10 max-w-xl">
                Browse by state and region. Each <span className="font-medium text-slate-700">county name</span> is its own page (permit office + wind/snow loads); the <span className="font-medium text-slate-700">chips</span> below it are the individual city pages. Don't see your town? We build across the whole region, so <Link to="/contact" className="text-brand font-medium">just ask</Link>.
              </p>
            </FadeIn>

            <div className="space-y-16">
              {STATE_DIRECTORY.map((st) => (
                <div key={st.stateCode}>
                  <FadeIn>
                    <div className="flex items-baseline gap-3 mb-8">
                      <h3 className="font-display text-3xl font-bold text-brand">{st.state}</h3>
                      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {st.regions.reduce((n, r) => n + r.counties.length, 0)} counties &middot;{' '}
                        {st.regions.reduce((n, r) => n + r.counties.reduce((m, c) => m + c.cities.length, 0), 0)} cities
                      </span>
                    </div>
                  </FadeIn>
                  <div className="space-y-12">
                    {st.regions.map((region) => (
                      <FadeIn key={`${st.stateCode}-${region.key}`}>
                        <div>
                          <h4 className="font-display text-2xl font-bold text-slate-900">{region.label}</h4>
                          <p className="text-sm text-slate-500 mb-4">{region.blurb}</p>
                          <div className="h-0.5 w-12 bg-brand mb-6" />

                          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                            {region.counties.map(({ county, countySlug, cities }) => (
                              <div key={county}>
                                {countySlug ? (
                                  <Link
                                    to={`/locations/${countySlug}`}
                                    className="group mb-2 flex items-center gap-2"
                                  >
                                    <span className="text-xs font-semibold uppercase tracking-widest text-slate-600 group-hover:text-brand transition-colors">
                                      {county}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 rounded border border-brand/30 bg-brand/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand whitespace-nowrap">
                                      County page <ArrowRight size={9} />
                                    </span>
                                  </Link>
                                ) : (
                                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                                    {county}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-1.5">
                                  {cities.map((city) => (
                                    <Link
                                      key={city.slug}
                                      to={`/locations/${city.slug}`}
                                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand/40 hover:text-brand transition-colors"
                                    >
                                      {city.name}
                                    </Link>
                                  ))}
                                  {cities.length === 0 && countySlug && (
                                    <Link
                                      to={`/locations/${countySlug}`}
                                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand/40 hover:text-brand transition-colors"
                                    >
                                      Countywide service
                                    </Link>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </FadeIn>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Why we cover such a wide area */}
        <div className="container py-16 grid lg:grid-cols-3 gap-10">
          <FadeIn>
            <div>
              <div className="font-display text-5xl font-bold text-brand mb-2">{CITIES.length}+</div>
              <div className="font-semibold text-slate-900 mb-1">Cities & Towns Served</div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Every incorporated city and major community across Arizona, California &amp; Nevada has its own dedicated, locally-engineered service page.
              </p>
            </div>
          </FadeIn>
          <FadeIn>
            <div>
              <div className="font-display text-5xl font-bold text-brand mb-2">3</div>
              <div className="font-semibold text-slate-900 mb-1">Licensed &amp; Insured States</div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Licensed and bonded to pull permits and build throughout Arizona (ROC), California, and Nevada, and every structure ships with engineer-stamped drawings.
              </p>
            </div>
          </FadeIn>
          <FadeIn>
            <div>
              <div className="font-display text-5xl font-bold text-brand mb-2">15+</div>
              <div className="font-semibold text-slate-900 mb-1">Years of Experience</div>
              <p className="text-sm text-slate-500 leading-relaxed">
                Over 15 years building across the Southwest means we know each county's permit office, soil type, and wind-, snow-, and dust-load zones.
              </p>
            </div>
          </FadeIn>
        </div>

        {/* CTA */}
        <div className="bg-slate-950 py-16">
          <div className="container text-center">
            <h2 className="font-display text-4xl font-bold text-white mb-4">
              Ready to Start Your Project?
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Get a free, no-obligation quote for your location, and we'll confirm service coverage during the consultation.
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
