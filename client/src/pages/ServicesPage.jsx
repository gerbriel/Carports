import { Link } from 'react-router-dom'
import { Car, Warehouse, Truck, Tractor, Anchor, ArrowRight, CheckCircle, Box, Phone } from 'lucide-react'
import FadeIn from '../components/ui/FadeIn'
import SEOHead from '../components/ui/SEOHead'

const SERVICES = [
  {
    icon: <Car size={32} />,
    title: 'Metal Carports',
    to: '/services/metal-carports',
    description: 'Our metal carports are built from commercial-grade steel made for tough Western climates. Single, double, or triple wide, they keep your personal vehicles, work trucks, and equipment out of the sun and weather.',
    features: [
      'Standard sizes from 12x20 to 30x40+',
      'Triple-wide and custom widths available',
      'Vertical, horizontal, and A-frame roof styles',
      'Open, partially enclosed, or fully enclosed',
      'Multiple color options',
      'Engineered for local wind loads',
    ],
    cta: 'Explore Metal Carports',
  },
  {
    icon: <Warehouse size={32} />,
    title: 'Metal Garages',
    to: '/services/metal-garages',
    description: 'From single-car to commercial-scale, our metal garages are built to secure your property for decades. All-steel construction means no rot, no termites, and minimal maintenance.',
    features: [
      'Single, double, and triple-wide options',
      'Walk-in doors and windows',
      'Roll-up and swing door options',
      'Moisture barrier and fiberglass insulation available',
      'Interior wiring provisions',
      'Fully enclosed and lockable',
    ],
    cta: 'Explore Metal Garages',
  },
  {
    icon: <Truck size={32} />,
    title: 'RV Covers',
    to: '/services/rv-covers',
    description: 'Class A, B, and C motorhomes require serious protection. Our RV covers are engineered with the clearances and spans needed for even the largest coaches and fifth-wheels.',
    features: [
      'Up to 60+ ft in length',
      'High clearance options (up to 16 ft)',
      'Open, enclosed, or partially walled',
      'Side entry access panels',
      'Custom anchoring for your slab',
      'UV-resistant panel coatings',
    ],
    cta: 'Explore RV Covers',
  },
  {
    icon: <Tractor size={32} />,
    title: 'Agricultural Buildings',
    to: '/services/agricultural-buildings',
    description: 'Western agriculture demands structures that can handle large equipment, hay storage, and livestock. We\'ve built everything from modest hay barns to multi-span clear buildings over 100 ft wide.',
    features: [
      'Clear-span up to 150+ ft wide',
      'Hay, grain, and equipment storage',
      'Livestock and poultry barn designs',
      'Large sliding or roll-up doors',
      'Ventilation and skylight options',
      'Engineered for snow and wind loads',
    ],
    cta: 'Explore Ag Buildings',
  },
  {
    icon: <Anchor size={32} />,
    title: 'Boat Storage',
    to: '/services/boat-storage',
    description: 'Protect your watercraft investment with a purpose-built boat storage structure. Wide clear entries, tall clearances, and corrosion-resistant finishes keep your boat in prime condition year-round.',
    features: [
      'Wide clear-span entry designs',
      'Custom dimensions for any vessel',
      'Ventilated wall panel options',
      'Corrosion-resistant hardware',
      'Fully enclosed with doors',
      'Concrete anchor systems available',
    ],
    cta: 'Explore Boat Storage',
  },
]

export default function ServicesPage() {
  return (
    <>
    <SEOHead
      title="Metal Building Services | Carports, Garages, Barns & More"
      description="Custom metal carports, garages, RV covers, agricultural buildings, and boat storage across California, Arizona, and Nevada. CA LIC# 1096004. Free quotes."
      canonical="/services"
      breadcrumbs={[{ label: 'Services', path: '/services' }]}
    />
    <div className="min-h-screen bg-white pt-24">
      {/* Page header */}
      <div className="bg-slate-950">
        <div className="container py-16">
          <span className="section-label-light">What We Build</span>
          <h1 className="font-display text-5xl lg:text-7xl font-bold text-white leading-none mt-1 mb-4">
            Our Services
          </h1>
          <p className="text-base text-slate-400 max-w-xl leading-relaxed">
            Every structure we build is custom, engineered to your site, your dimensions, and how you actually plan to use it. Take a look at everything we build below.
          </p>
          <div className="mt-6">
            <Link to="/builder"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-light hover:text-white transition-colors">
              <Box size={14} /> Try the 3D Builder to design your structure
            </Link>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="container py-20">
        <div className="space-y-20">
          {SERVICES.map((service, i) => (
            <FadeIn key={service.title}>
              <div className={`grid gap-10 lg:grid-cols-2 items-center ${i % 2 === 1 ? 'lg:grid-flow-dense' : ''}`}>
                {/* Content */}
                <div className={i % 2 === 1 ? 'lg:col-start-2' : ''}>
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-brand/10 text-brand mb-5">
                    {service.icon}
                  </div>
                  <h2 className="font-display text-4xl font-bold text-slate-900 mb-3">
                    {service.title}
                  </h2>
                  <p className="text-base text-slate-500 leading-relaxed mb-6">
                    {service.description}
                  </p>
                  <ul className="grid grid-cols-2 gap-y-2 gap-x-4 mb-8">
                    {service.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle size={14} className="shrink-0 mt-0.5 text-brand" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link to={service.to} className="btn-primary">
                    {service.cta} <ArrowRight size={15} />
                  </Link>
                </div>

                {/* Image placeholder */}
                <div className={`rounded-lg bg-slate-100 aspect-[4/3] flex items-center justify-center border border-slate-200 ${i % 2 === 1 ? 'lg:col-start-1' : ''}`}>
                  <div className="text-center text-slate-400">
                    <div className="text-slate-300 mb-2">{service.icon}</div>
                    <div className="text-xs uppercase tracking-widest font-medium">Project Photo</div>
                  </div>
                </div>
              </div>

              {i < SERVICES.length - 1 && <hr className="mt-20 border-slate-100" />}
            </FadeIn>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-slate-950 py-16">
        <div className="container text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">Get a free, itemized quote for your project with no obligation at all.</p>
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
