import { Link } from 'react-router-dom'
import { CheckCircle, DollarSign } from 'lucide-react'
import FadeIn from '../ui/FadeIn'

const BENEFITS = [
  'Low monthly payments',
  'Quick pre-qualification',
  'No prepayment penalties',
  'Flexible loan terms',
  'Competitive rates',
  'Trusted HFS Financial partner',
]

export default function Financing() {
  return (
    <section className="section bg-brand" id="financing">
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <FadeIn>
            <div>
              <span className="section-label-light opacity-80">Flexible Financing</span>
              <h2 className="font-display text-5xl lg:text-6xl font-bold text-white leading-none mt-1 mb-5">
                Don't wait to build.<br />
                Finance your structure today.
              </h2>
              <p className="text-base text-white/75 leading-relaxed mb-8 max-w-lg">
                The right building should not have to wait until you have saved up every last dollar. We have partnered with HFS Financial so you can spread the cost out and get started now. Pre-qualify in minutes with no impact to your credit score.
              </p>
              <Link to="/contact" className="inline-flex items-center gap-2 rounded bg-white px-7 py-4 text-sm font-semibold text-brand hover:bg-white/90 transition-colors duration-150">
                <DollarSign size={16} />
                Learn About Financing
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={150}>
            <div className="rounded-lg bg-white/10 border border-white/20 p-8">
              <div className="grid grid-cols-2 gap-4">
                {BENEFITS.map((b) => (
                  <div key={b} className="flex items-center gap-3">
                    <CheckCircle size={16} className="shrink-0 text-white" />
                    <span className="text-sm font-medium text-white/90">{b}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded border border-white/15 bg-white/8 p-4 text-center">
                <div className="text-3xl font-display font-bold text-white mb-1">$0 Down</div>
                <div className="text-sm text-white/60">options available on qualified projects</div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
