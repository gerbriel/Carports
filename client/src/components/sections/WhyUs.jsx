import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import SectionHeader from '../ui/SectionHeader'
import FadeIn from '../ui/FadeIn'

const PILLARS = [
  {
    num: '01',
    title: 'Workmanship You Can See',
    description:
      'You have probably driven past a cheap carport sagging in someone\'s yard. That is never going to be yours. Our crews have been doing this for decades and they sweat the details, from the first anchor in the ground to the last fastener. When our name is on it, it is built right.',
  },
  {
    num: '02',
    title: 'Built Around Your Property',
    description:
      'You should not have to squeeze what you need into a catalog box that almost fits. Tell us your space, your vehicles, and your plans, and we engineer the building around them. Your dimensions, your roof style, your colors, your doors and windows.',
  },
  {
    num: '03',
    title: 'We Will Still Be Here',
    description:
      'Too many companies cash the check and disappear. We are a local California company, so we are around when you actually need us. Every structure comes with warranties we put in writing, plus full documentation for your permits and engineering review.',
  },
]

export default function WhyUs() {
  return (
    <section className="section bg-slate-950" id="why">
      <div className="container">
        <SectionHeader
          label="Why Quality Metal Carports"
          title={<>Built Different.<br />Built Better.</>}
          description="Here are the three things people worry about most before they buy a metal building, and how we put each one to rest."
          light
        />

        <div className="grid gap-8 lg:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <FadeIn key={pillar.num} delay={i * 120}>
              <div className="group relative rounded-lg border border-white/8 bg-white/4 p-8 hover:border-brand/40 hover:bg-white/6 transition-all duration-200">
                <div className="font-display text-7xl font-bold text-white/5 leading-none mb-4 select-none">
                  {pillar.num}
                </div>
                <h3 className="font-display text-2xl font-bold text-white mb-3">
                  {pillar.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {pillar.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* Warranty banner */}
        <FadeIn delay={400}>
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-lg border border-brand/20 bg-brand/8 px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand">
                <ShieldCheck size={22} className="text-white" />
              </div>
              <div>
                <div className="font-display text-xl font-bold text-white">20-Year Rust-Through Warranty</div>
                <div className="text-sm text-slate-400">Our 12-gauge frames carry a 20-year rust-through warranty, with certified, leak, and 90 MPH wind coverage on top. The money you put in stays protected.</div>
              </div>
            </div>
            <Link to="/contact" className="btn-primary shrink-0">
              Start Your Project
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
