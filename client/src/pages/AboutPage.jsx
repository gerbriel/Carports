import { Link } from 'react-router-dom'
import { ShieldCheck, Users, MapPin, Award, Phone } from 'lucide-react'
import FadeIn from '../components/ui/FadeIn'

const VALUES = [
  {
    icon: <ShieldCheck size={22} />,
    title: 'Accountability',
    description: 'We\'re a local California company. We back every structure with real, written warranties and we\'ll still be here to honor them.',
  },
  {
    icon: <Users size={22} />,
    title: 'Craftsmanship',
    description: 'Our crews are trained and certified professionals who take precision seriously at every stage of construction.',
  },
  {
    icon: <MapPin size={22} />,
    title: 'Local Expertise',
    description: 'We have been building in Fresno and Northern California for over 15 years, so we know the soil, the weather, and the permitting process inside and out.',
  },
  {
    icon: <Award size={22} />,
    title: 'Transparency',
    description: 'Every quote is detailed and itemized. No hidden fees, no surprises. You know exactly what you\'re getting before we break ground.',
  },
]

const MILESTONES = [
  { year: '2008', text: 'Founded in Fresno, CA by a team of experienced metal building installers.' },
  { year: '2012', text: 'Obtained California General Contractor license and expanded to Northern California.' },
  { year: '2016', text: 'Completed our 500th structure, everything from single carports to 10,000 sq ft commercial buildings.' },
  { year: '2020', text: 'Added a dedicated agricultural and large clear-span division to take on bigger barns and commercial projects.' },
  { year: '2024', text: 'Serving Fresno, Clovis, Madera, Visalia, and communities throughout Central Valley.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white pt-24">
      {/* Hero */}
      <div className="bg-slate-950">
        <div className="container py-16">
          <span className="section-label-light">About Us</span>
          <h1 className="font-display text-5xl lg:text-7xl font-bold text-white leading-none mt-1 mb-4">
            Local. Accountable.<br />
            <span className="text-brand">Steel Strong.</span>
          </h1>
          <p className="text-base text-slate-400 max-w-xl leading-relaxed">
            Quality Metal Carports Inc. has been building custom metal structures in California for over 15 years. We are not a national franchise. We are a local team that shows up, does the work, and backs it with a real warranty.
          </p>
        </div>
      </div>

      {/* Story */}
      <div className="section">
        <div className="container">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <FadeIn>
              <div className="rounded-lg bg-slate-100 aspect-[4/3] flex items-center justify-center border border-slate-200">
                <div className="text-center text-slate-400">
                  <div className="text-xs uppercase tracking-widest font-medium">Team Photo</div>
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={150}>
              <div>
                <span className="section-label">Our Story</span>
                <h2 className="font-display text-4xl font-bold text-slate-900 mt-1 mb-5 leading-none">
                  Built on Reputation, Not Marketing
                </h2>
                <div className="space-y-4 text-base text-slate-500 leading-relaxed">
                  <p>
                    Quality Metal Carports started as a small operation out of Fresno, built on word-of-mouth referrals from people who wanted a straight-talking local contractor instead of a national company that disappears the moment the check clears.
                  </p>
                  <p>
                    We've grown to serve all of Northern California, but our approach hasn't changed. Every project gets the same attention whether it's a single carport or a 10,000 square foot agricultural complex. We don't work from a catalog. We custom-engineer every structure for your site, how you'll use it, and your budget.
                  </p>
                  <p>
                    California LIC# 1096004. Fully licensed, bonded, and insured.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="section bg-slate-50">
        <div className="container">
          <FadeIn className="text-center mb-14">
            <span className="section-label">What We Stand For</span>
            <h2 className="font-display text-4xl font-bold text-slate-900 mt-1 leading-none">Our Values</h2>
          </FadeIn>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <FadeIn key={v.title} delay={i * 80}>
                <div className="rounded-lg border border-slate-100 bg-white p-6 hover:border-brand/30 hover:shadow-sm transition-all duration-200">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand/10 text-brand mb-4">
                    {v.icon}
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 mb-2">{v.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{v.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="section">
        <div className="container">
          <FadeIn className="text-center mb-14">
            <span className="section-label">History</span>
            <h2 className="font-display text-4xl font-bold text-slate-900 mt-1 leading-none">Our Journey</h2>
          </FadeIn>
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute left-[28px] top-0 bottom-0 w-px bg-slate-200" />
            <div className="space-y-10">
              {MILESTONES.map((m, i) => (
                <FadeIn key={m.year} delay={i * 80}>
                  <div className="flex gap-8 items-start">
                    <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white border-2 border-brand text-center">
                      <span className="font-display text-xs font-bold text-brand leading-tight">{m.year}</span>
                    </div>
                    <div className="pt-3">
                      <p className="text-sm text-slate-600 leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-brand py-16">
        <div className="container text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Ready to Work With Us?</h2>
          <p className="text-white/75 mb-8">Get a free quote or call our team directly — we'd love to hear what you're planning.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/contact" className="inline-flex items-center gap-2 rounded bg-white px-7 py-4 text-sm font-semibold text-brand hover:bg-white/90 transition-colors">
              Get a Free Quote
            </Link>
            <a href="tel:5597554900" className="btn-outline-white"><Phone size={16} /> Call 559-755-4900</a>
          </div>
          <p className="mt-5 text-sm text-white/70">Call for a free quote &middot; Mon–Fri, 8 AM–5 PM PST</p>
        </div>
      </div>
    </div>
  )
}
