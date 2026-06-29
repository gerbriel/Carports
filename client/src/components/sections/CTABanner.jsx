import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import FadeIn from '../ui/FadeIn'

export default function CTABanner() {
  return (
    <section className="section bg-slate-950">
      <div className="container">
        <FadeIn>
          <div className="rounded-xl border border-white/8 bg-white/3 px-8 py-14 text-center lg:px-20">
            <span className="section-label-light">Ready to Build?</span>
            <h2 className="font-display text-5xl lg:text-6xl font-bold text-white mt-1 mb-5 leading-none">
              Let's Build Something<br />
              <span className="text-brand">That Lasts.</span>
            </h2>
            <p className="text-base text-slate-400 max-w-xl mx-auto mb-10">
              Tell us what you are picturing and we will send back a free, itemized quote. Or hop on a quick call with our team. Either way, you hear from us within one business day.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/contact" className="btn-primary-lg">
                Get a Free Quote
              </Link>
              <a href="tel:5597554900" className="btn-outline-white">
                <Phone size={16} />
                Call 559-755-4900
              </a>
            </div>
            <p className="mt-6 text-sm text-slate-400">Call for a free quote &middot; Mon–Fri, 8 AM–5 PM PST</p>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
