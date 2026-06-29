import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Facebook, Instagram, Youtube } from 'lucide-react'

const SERVICES = [
  'Metal Carports',
  'Metal Garages',
  'RV Covers',
  'Agricultural Buildings',
  'Boat Storage',
]

const COMPANY = [
  { label: 'About Us', to: '/about' },
  { label: 'Our Process', to: '/about#process' },
  { label: 'Services', to: '/services' },
  { label: 'Contact', to: '/contact' },
]

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-white/8">
      <div className="container py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="inline-flex items-center mb-4" aria-label="Quality Metal Carports home">
              <img src="/logo.png" alt="Quality Metal Carports" className="h-12 w-auto" />
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed mb-5">
              Custom steel structures built for California, backed by real written warranties and decades of hands-on experience.
            </p>
            <div className="inline-flex items-center gap-2 rounded border border-white/10 bg-white/5 px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-light" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span className="text-xs text-slate-400 font-medium">CA LIC# 1096004</span>
            </div>

            <div className="flex gap-3 mt-6">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded bg-white/8 text-slate-400 hover:bg-brand hover:text-white transition-colors duration-150">
                <Facebook size={16} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded bg-white/8 text-slate-400 hover:bg-brand hover:text-white transition-colors duration-150">
                <Instagram size={16} />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded bg-white/8 text-slate-400 hover:bg-brand hover:text-white transition-colors duration-150">
                <Youtube size={16} />
              </a>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-sans text-xs font-semibold uppercase tracking-widest text-slate-500 mb-5">Services</h4>
            <ul className="space-y-2.5">
              {SERVICES.map((s) => (
                <li key={s}>
                  <Link to="/services" className="text-sm text-slate-400 hover:text-white transition-colors duration-150">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-sans text-xs font-semibold uppercase tracking-widest text-slate-500 mb-5">Company</h4>
            <ul className="space-y-2.5">
              {COMPANY.map((item) => (
                <li key={item.label}>
                  <Link to={item.to} className="text-sm text-slate-400 hover:text-white transition-colors duration-150">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-sans text-xs font-semibold uppercase tracking-widest text-slate-500 mb-5">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Phone size={15} className="mt-0.5 shrink-0 text-brand-light" />
                <a href="tel:5597554900" className="text-sm text-slate-400 hover:text-white transition-colors">
                  559-755-4900
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Mail size={15} className="mt-0.5 shrink-0 text-brand-light" />
                <a href="mailto:Info@QualityMetalCarportsCA.com" className="text-sm text-slate-400 hover:text-white transition-colors break-all">
                  Info@QualityMetalCarportsCA.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={15} className="mt-0.5 shrink-0 text-brand-light" />
                <address className="text-sm text-slate-400 not-italic">
                  9191 W Whitesbridge Ave<br />
                  Fresno, CA 93706
                </address>
              </li>
              <li className="text-sm text-slate-500">
                Mon to Fri &nbsp;·&nbsp; 8:00 AM to 5:00 PM PST
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 py-6">
          <p className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} Quality Metal Carports Inc. All rights reserved. CA LIC# 1096004
          </p>
          <p className="text-xs text-slate-600">
            Fresno &amp; Northern California
          </p>
        </div>
      </div>
    </footer>
  )
}
