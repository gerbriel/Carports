import { Link, useParams } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { getQuote, getLead } from '../data/adminData'
import { buildQuoteDoc } from '../data/quoteDoc'
import { PURCHASE_AGREEMENT_INTRO, TERMS_SECTIONS } from '../data/quoteTerms'

const money = (n) => (n == null ? '—' : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

// Printable quote / purchase agreement for a quote/order. Open at /quote/:quoteId,
// then "Print / Save PDF" uses the browser's print dialog (controls hide on print).
export default function QuoteDocumentPage() {
  const { quoteId } = useParams()
  const quote = getQuote(quoteId)
  const lead = quote ? getLead(quote.leadId) : null

  if (!quote) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-700 font-medium">Quote not found.</p>
          <Link to="/admin" className="mt-3 inline-block text-brand hover:underline">Back to admin</Link>
        </div>
      </div>
    )
  }

  const d = buildQuoteDoc(quote, lead)
  const b = d.breakdown
  const Row = ({ label, value, strong, accent }) => (
    <div className={`flex items-center justify-between px-3 py-1.5 ${accent ? 'bg-slate-900 text-white' : ''}`}>
      <span className={`text-sm ${strong ? 'font-semibold' : ''} ${accent ? 'text-white' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm ${strong || accent ? 'font-bold' : 'font-medium'} ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      {/* Controls (hidden in print) */}
      <div className="print:hidden mx-auto max-w-3xl flex items-center justify-between mb-4 px-4">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft size={15} /> Back to admin</Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer size={15} /> Print / Save PDF</button>
      </div>

      {/* Page */}
      <div className="mx-auto max-w-3xl bg-white shadow-lg print:shadow-none text-slate-900">
        <div className="p-8 print:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex items-center gap-3">
              {d.dealer?.logoDataUrl
                ? <img src={d.dealer.logoDataUrl} alt={d.dealer.name} className="h-12 w-auto max-w-[140px] object-contain" />
                : <div className="h-12 w-12 rounded bg-brand" />}
              <div>
                <div className="font-display text-lg font-bold leading-tight">{d.dealer ? d.dealer.name : d.qmc.name}</div>
                {d.dealer && <div className="text-[11px] text-slate-500">Manufactured by {d.qmc.name}</div>}
                <div className="text-[11px] text-slate-500">{d.qmc.address}</div>
                <div className="text-[11px] text-slate-500">{d.qmc.phone} · {d.qmc.email} · {d.qmc.license}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Building Quote</div>
              <div className="font-display text-lg font-bold">{d.quoteNumber}</div>
              <div className="text-[11px] text-slate-500 mt-1">Order {d.orderNumber}</div>
              <div className="text-[11px] text-slate-500">Date: {d.date}</div>
            </div>
          </div>

          {/* Customer + summary */}
          <div className="grid sm:grid-cols-2 gap-5 py-5 border-b border-slate-200">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Customer</div>
              <div className="font-semibold">{d.customer.name}</div>
              <div className="text-sm text-slate-600">{d.customer.email}{d.customer.phone ? ` · ${d.customer.phone}` : ''}</div>
              {d.customer.billing && <div className="mt-2 text-xs text-slate-500"><span className="font-semibold text-slate-600">Billing:</span> {d.customer.billing}</div>}
              {d.customer.shipping && <div className="text-xs text-slate-500"><span className="font-semibold text-slate-600">Shipping:</span> {d.customer.shipping}</div>}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{d.title}</div>
              <div className="space-y-0.5">
                {Object.entries(d.colors).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs"><span className="text-slate-500">{k} Color</span><span className="font-medium">{v}</span></div>
                ))}
              </div>
            </div>
          </div>

          {/* Checklist + spec */}
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 py-4 border-b border-slate-200">
            {Object.entries(d.checklist).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs"><span className="text-slate-500">{k}</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
          <div className="grid sm:grid-cols-5 gap-3 py-4 border-b border-slate-200">
            {Object.entries(d.spec).map(([k, v]) => (
              <div key={k}><div className="text-[9px] uppercase tracking-wide text-slate-400">{k}</div><div className="text-xs font-semibold">{v}</div></div>
            ))}
          </div>

          {/* Line items + price details */}
          <div className="grid lg:grid-cols-[1fr_260px] gap-5 py-5">
            <div>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-slate-300 pb-1 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                <span>Specification</span><span className="text-center">Qty</span><span className="text-right">Price</span>
              </div>
              {b.lineItems.map((it) => (
                <div key={it.key} className="grid grid-cols-[1fr_auto_auto] gap-x-4 py-1.5 border-b border-slate-100 text-sm">
                  <span className="text-slate-800">{it.label}</span>
                  <span className="text-center text-slate-500">{it.qty}</span>
                  <span className="text-right tabular-nums text-slate-900">{it.priced ? money(it.amount) : '—'}</span>
                </div>
              ))}
              {b.unpricedOptions.length > 0 && (
                <p className="mt-2 text-[11px] text-amber-700">Quoted separately (call for pricing): {b.unpricedOptions.join(', ')}.</p>
              )}
            </div>

            <div className="self-start rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-slate-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Price Details</div>
              <Row label="Sub Total" value={money(b.subtotal)} />
              <Row label={`Sales Tax (${(b.taxRate * 100).toFixed(3).replace(/\.?0+$/, '')}%)`} value={money(b.tax)} />
              {b.additionalCharges > 0 && <Row label="Additional Charges" value={money(b.additionalCharges)} />}
              <Row label="Grand Total" value={money(b.total)} strong />
              <Row label={`Deposit (${Math.round(b.depositRate * 100)}%)`} value={money(b.deposit)} accent />
              {b.stageFunding && <Row label="Scheduling Fee (50%)" value={money(b.schedulingFee)} accent />}
              <Row label="Balance Due" value={money(b.balanceDue)} accent />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
            Deposit is non-refundable after the 72-hour grace period. {b.stageFunding ? 'For orders over $15,000, 50% of the remaining balance is due upon scheduling; the balance is due COD on the day of installation. ' : 'Balance is due COD on the day of installation. '}
            Certified plans and any rental equipment (for builds over 30′ wide or 12′ tall) are billed separately.
          </p>
        </div>

        {/* Terms */}
        <div className="p-8 print:p-6 border-t-4 border-slate-900" style={{ pageBreakBefore: 'always' }}>
          <h2 className="font-display text-xl font-bold mb-1">Terms of Sales Agreement</h2>
          <p className="text-[11px] leading-relaxed text-slate-600 mb-4">{PURCHASE_AGREEMENT_INTRO}</p>
          {TERMS_SECTIONS.map((s) => (
            <div key={s.n} className="mb-4 break-inside-avoid">
              <h3 className="text-sm font-bold text-slate-900 mb-1.5">{s.n}. {s.title}</h3>
              <div className="space-y-1.5">
                {s.clauses.map((c, i) => (
                  <p key={i} className="text-[11px] leading-relaxed text-slate-600">{c.t && <span className="font-semibold text-slate-800">{c.t}: </span>}{c.b}</p>
                ))}
              </div>
            </div>
          ))}

          {/* Signature */}
          <div className="mt-8 grid sm:grid-cols-2 gap-6 break-inside-avoid">
            <div>
              <div className="border-b border-slate-400 h-8" />
              <div className="text-[11px] text-slate-500 mt-1">Customer Signature</div>
              <div className="mt-4 border-b border-slate-400 h-8" />
              <div className="text-[11px] text-slate-500 mt-1">Print Name</div>
            </div>
            <div>
              <div className="border-b border-slate-400 h-8" />
              <div className="text-[11px] text-slate-500 mt-1">Date</div>
              <div className="mt-4 border-b border-slate-400 h-8" />
              <div className="text-[11px] text-slate-500 mt-1">QMC Representative</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
