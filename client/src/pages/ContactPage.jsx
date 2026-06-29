import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Phone, Mail, MapPin, Clock, CheckCircle, Send } from 'lucide-react'
import FadeIn from '../components/ui/FadeIn'
import { identifyChatwootVisitor, setChatwootConversationLabel } from '../components/ui/ChatwootWidget'
import { addLead, addQuote, getPageFields } from '../data/adminData'
import { useAdminTick } from '../hooks/useAdminTick'

const STRUCTURE_TYPES = [
  'Metal Carport',
  'Metal Garage',
  'RV Cover',
  'Agricultural Building',
  'Boat Storage',
  'Other',
]

const CONTACT_ITEMS = [
  { icon: <Phone size={18} />, label: 'Phone', content: <a href="tel:5597554900" className="text-slate-300 hover:text-white transition-colors">559-755-4900</a> },
  { icon: <Mail size={18} />, label: 'Email', content: <a href="mailto:Info@QualityMetalCarportsCA.com" className="text-slate-300 hover:text-white transition-colors break-all">Info@QualityMetalCarportsCA.com</a> },
  { icon: <MapPin size={18} />, label: 'Location', content: <span className="text-slate-300">9191 W Whitesbridge Ave, Fresno, CA 93706</span> },
  { icon: <Clock size={18} />, label: 'Hours', content: <span className="text-slate-300">Mon to Fri, 8:00 AM to 5:00 PM PST</span> },
]

export default function ContactPage() {
  useAdminTick()
  const pg = getPageFields('contact')
  const [params] = useSearchParams()
  const config = params.get('config') || ''
  const price = params.get('price') ? Number(params.get('price')) : null
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', structureType: '', message: '' })
  const [status, setStatus] = useState('idle')

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')

    // Capture for the admin dashboard (plug-and-play; swap for your backend later).
    addLead({ ...form, ...(config ? { config, price } : {}) })
    if (config) addQuote({ name: `${form.firstName} ${form.lastName}`.trim(), email: form.email, config, price })

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, config, price }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('success')
    }

    // Identify this visitor in Chatwoot so agents see their info immediately
    identifyChatwootVisitor({
      name: `${form.firstName} ${form.lastName}`.trim(),
      email: form.email,
      phone: form.phone,
    })
    if (form.structureType) setChatwootConversationLabel('quote-request')
  }

  return (
    <div className="min-h-screen bg-slate-950 pt-24">
      {/* Header */}
      <div className="container py-12">
        <div className="max-w-2xl">
          <span className="section-label-light">{pg.eyebrow}</span>
          <h1 className="font-display text-5xl lg:text-6xl font-bold text-white leading-none mt-1 mb-4">
            {pg.title1}{pg.title2 && <><br /><span className="text-brand">{pg.title2}</span></>}
          </h1>
          <p className="text-base text-slate-400 leading-relaxed">
            {pg.intro}
          </p>
        </div>
      </div>

      <div className="container pb-24">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* Contact info */}
          <FadeIn>
            <div className="space-y-6">
              {CONTACT_ITEMS.map((item, i) => (
                <div key={i} className="flex items-start gap-4 rounded-lg border border-white/8 bg-white/4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-brand-light">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">{item.label}</div>
                    <div className="text-sm">{item.content}</div>
                  </div>
                </div>
              ))}

              <div className="rounded-lg border border-white/8 bg-white/4 p-5">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">License</div>
                <div className="font-display text-lg font-bold text-white">CA LIC# 1096004</div>
                <div className="text-xs text-slate-500 mt-1">California Licensed & Insured General Contractor</div>
              </div>
            </div>
          </FadeIn>

          {/* Contact form */}
          <FadeIn delay={100} className="lg:col-span-2">
            <div className="rounded-lg border border-white/8 bg-white/4 p-8">
              {status === 'success' ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/20 mb-5">
                    <CheckCircle size={28} className="text-brand-light" />
                  </div>
                  <h3 className="font-display text-2xl font-bold text-white mb-2">Message Sent</h3>
                  <p className="text-sm text-slate-400">We'll get back to you within one business day.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">First Name *</label>
                      <input
                        type="text"
                        name="firstName"
                        required
                        value={form.firstName}
                        onChange={handleChange}
                        placeholder="John"
                        className="w-full rounded border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Last Name *</label>
                      <input
                        type="text"
                        name="lastName"
                        required
                        value={form.lastName}
                        onChange={handleChange}
                        placeholder="Doe"
                        className="w-full rounded border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Email *</label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="john@example.com"
                        className="w-full rounded border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="(559) 555-0000"
                        className="w-full rounded border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Structure Type</label>
                    <select
                      name="structureType"
                      value={form.structureType}
                      onChange={handleChange}
                      className="w-full rounded border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    >
                      <option value="">Select a structure type...</option>
                      {STRUCTURE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1.5">Project Details *</label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={form.message}
                      onChange={handleChange}
                      placeholder="Tell us about your project. Dimensions, your location, timeline, and how you plan to use it..."
                      className="w-full rounded border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand resize-none"
                    />
                  </div>

                  {status === 'error' && (
                    <p className="text-sm text-red-400">Something went wrong. Please try again or call us directly.</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="btn-primary-lg w-full justify-center disabled:opacity-60"
                  >
                    {status === 'sending' ? (
                      <>Sending...</>
                    ) : (
                      <><Send size={16} /> Send Message</>
                    )}
                  </button>
                </form>
              )}
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  )
}
