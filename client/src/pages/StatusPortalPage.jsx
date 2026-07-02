import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, CheckCircle2, Circle, Clock, Package, Phone, AlertTriangle, PauseCircle } from 'lucide-react'
import SEOHead from '../components/ui/SEOHead'
import { findByNumber } from '../data/adminData'
import { customerView } from '../data/pipeline'

const fmt = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' } }

// Public order/quote status lookup. Customers enter the order # or quote # printed
// on their paperwork and see a friendly milestone view — no internal detail.
export default function StatusPortalPage() {
  // A dealer/manufacturer can send a deep link: /status?n=ORD-1042 → auto-search.
  const [params] = useSearchParams()
  const initial = params.get('n') || params.get('order') || params.get('quote') || ''
  const lookup = (n) => findByNumber(n)?.quote || null // the quote/order (no personal detail)
  const [q, setQ] = useState(initial)
  const [result, setResult] = useState(() => (initial ? lookup(initial) : undefined))
  const submit = (e) => { e.preventDefault(); setResult(lookup(q)) }

  const view = result ? customerView(result) : null
  const firstOpen = view?.steps.findIndex((s) => !s.done) ?? -1
  const doneCount = view ? view.steps.filter((s) => s.done).length : 0
  const pct = view ? Math.round((doneCount / view.steps.length) * 100) : 0

  return (
    <>
      <SEOHead title="Track Your Order — Quality Metal Carports" description="Check the status of your metal building order or quote." canonical="/status" />
      <div className="min-h-screen bg-white pt-24">
        <div className="bg-slate-950">
          <div className="container py-14">
            <div className="flex items-center gap-2 text-brand-light mb-2"><Package size={16} /><span className="text-xs font-semibold uppercase tracking-widest">Order status</span></div>
            <h1 className="font-display text-4xl lg:text-5xl font-bold text-white">Track your building</h1>
            <p className="mt-2 text-sm text-slate-400 max-w-xl">Enter the order number or quote number from your paperwork to see where your project stands.</p>
            <form onSubmit={submit} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-lg">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. ORD-1042 or Q-1043"
                className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none" />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"><Search size={15} /> Check status</button>
            </form>
          </div>
        </div>

        <div className="container py-12 max-w-2xl">
          {result === undefined && (
            <p className="text-sm text-slate-500">Your order and quote numbers are on your emailed quote and your signed agreement.</p>
          )}

          {result === null && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <p className="font-medium text-slate-800">No match for “{q}”.</p>
              <p className="mt-1 text-sm text-slate-500">Double-check the number, or call us and we’ll look it up.</p>
              <a href="tel:5597554900" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"><Phone size={14} /> 559-755-4900</a>
            </div>
          )}

          {view && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-slate-400">{result.isOrder ? `Order ${result.orderNumber}` : `Quote ${result.quoteNumber}`}</div>
                    <h2 className="font-display text-2xl font-bold text-slate-900">{result.name || result.structureType || 'Metal building'}</h2>
                    {result.config && <p className="text-sm text-slate-500">{result.config}</p>}
                  </div>
                  <div className="text-right">
                    <div className="font-display text-3xl font-bold text-brand">{pct}%</div>
                    <div className="text-xs text-slate-400">complete</div>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
              </div>

              {view.actionNeeded && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Action needed on your behalf</p>
                    <p className="text-xs text-amber-700">There’s a step that needs you before we can keep things moving. Give us a call and we’ll walk you through it.</p>
                  </div>
                </div>
              )}
              {view.onHold && (
                <div className="flex items-start gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4">
                  <PauseCircle size={18} className="mt-0.5 shrink-0 text-orange-600" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Your project is currently delayed / on hold</p>
                    <p className="text-xs text-orange-700">We’ll be in touch with an update. Call us anytime for the latest.</p>
                  </div>
                </div>
              )}

              <ol className="relative border-l border-slate-200 ml-3">
                {view.steps.map((s, i) => {
                  const current = i === firstOpen
                  const Icon = s.actionNeeded ? AlertTriangle : s.onHold ? PauseCircle : s.done ? CheckCircle2 : current ? Clock : Circle
                  const dot = s.actionNeeded ? 'bg-amber-500 text-white' : s.onHold ? 'bg-orange-400 text-white' : s.done ? 'bg-emerald-500 text-white' : current ? 'bg-brand text-white' : 'bg-slate-200 text-slate-400'
                  return (
                    <li key={s.key} className="mb-6 ml-6">
                      <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${dot}`}><Icon size={14} /></span>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm font-medium ${s.done || current || s.actionNeeded || s.onHold ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
                        {s.key === 'install_date' && s.value
                          ? <span className="text-xs font-semibold text-brand">{fmt(s.value)}</span>
                          : s.ts && s.done ? <span className="text-xs text-slate-400">{fmt(s.ts)}</span> : null}
                      </div>
                      {s.actionNeeded
                        ? <p className="mt-0.5 text-xs font-semibold text-amber-700">{s.status || 'Action needed on your behalf'}</p>
                        : s.onHold ? <p className="mt-0.5 text-xs font-semibold text-orange-700">{s.status || 'On hold'}</p>
                        : current ? <p className="mt-0.5 text-xs text-slate-500">{s.status || 'In progress'}</p> : null}
                    </li>
                  )
                })}
              </ol>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-5 text-center">
                <p className="text-sm text-slate-600">Questions about your build?</p>
                <a href="tel:5597554900" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"><Phone size={14} /> Call 559-755-4900 · Mon–Fri, 8–5 PST</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
