import { Link } from 'react-router-dom'
import { Car, Warehouse, Truck, Tractor, Anchor, ArrowRight } from 'lucide-react'
import SectionHeader from '../ui/SectionHeader'
import FadeIn from '../ui/FadeIn'

const SERVICES = [
  {
    icon: <Car size={26} />,
    title: 'Metal Carports',
    to: '/services/metal-carports',
    description: 'Keep your vehicles out of the sun, rain, and falling debris with a carport sized exactly for them. Single, double, or triple wide, and built to stand up to California weather.',
    features: ['Standard & RV sizes', 'Custom heights & widths', 'Multiple roof styles', 'Open or enclosed sides'],
    featured: true,
  },
  {
    icon: <Warehouse size={26} />,
    title: 'Metal Garages',
    to: '/services/metal-garages',
    description: 'When you want it locked up and out of sight, a fully enclosed steel garage does the job. No rot, no termites, and real security for your cars, tools, and gear.',
    features: ['Commercial-grade steel', 'Walk-in doors & windows', 'Roll-up door options', 'Moisture barrier & insulation'],
  },
  {
    icon: <Truck size={26} />,
    title: 'RV Covers',
    to: '/services/rv-covers',
    description: 'Your RV is too big an investment to leave baking in the sun. We build tall, wide covers that shade it and protect the roof, seals, and paint all year long.',
    features: ['Up to 50+ ft wide', 'High-clearance options', 'Open or enclosed sides', 'Custom anchoring'],
  },
  {
    icon: <Tractor size={26} />,
    title: 'Agricultural Buildings',
    to: '/services/agricultural-buildings',
    description: 'Hay, tractors, and equipment last a lot longer under a roof. We build barns and clear-span storage tough enough for real Central Valley farm work.',
    features: ['Large clear-span designs', 'Equipment storage', 'Hay & livestock barns', 'Ventilation options'],
  },
  {
    icon: <Anchor size={26} />,
    title: 'Boat Storage',
    to: '/services/boat-storage',
    description: 'Sun and weather quietly wear a boat down season after season. A covered steel structure keeps yours looking sharp and ready to launch.',
    features: ['Wide clear-span entries', 'Ventilated designs', 'Custom dimensions', 'Coastal-grade finishes'],
  },
]

export default function Services() {
  return (
    <section className="section bg-white" id="services">
      <div className="container">
        <SectionHeader
          label="What We Build"
          title="Metal Structures for Every Need"
          description="From a backyard carport to a clear-span barn, we design and install steel buildings made to handle whatever California weather throws at them."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service, i) => (
            <FadeIn key={service.title} delay={i * 80}>
              <div
                className={`group relative flex h-full flex-col rounded-lg border p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg ${
                  service.featured
                    ? 'border-brand/30 bg-brand/4 hover:border-brand/60 hover:shadow-brand/10'
                    : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-white hover:shadow-slate-100'
                }`}
              >
                {service.featured && (
                  <span className="absolute right-4 top-4 rounded-full bg-brand/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-brand">
                    Most Popular
                  </span>
                )}

                <div className={`mb-5 inline-flex h-13 w-13 items-center justify-center rounded-lg ${
                  service.featured ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-brand group-hover:text-white'
                } transition-colors duration-200`}
                  style={{ height: '52px', width: '52px' }}
                >
                  {service.icon}
                </div>

                <h3 className="font-display text-2xl font-bold text-slate-900 mb-2">
                  {service.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">
                  {service.description}
                </p>

                <ul className="space-y-1.5 mb-6">
                  {service.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to={service.to || '/services'}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand hover:gap-3 transition-all duration-150"
                >
                  Learn More <ArrowRight size={14} />
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={600} className="mt-12 text-center">
          <Link to="/contact" className="btn-primary-lg">
            Get a Quote for Your Project
          </Link>
        </FadeIn>
      </div>
    </section>
  )
}
