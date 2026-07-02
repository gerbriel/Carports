import { Link, useParams } from 'react-router-dom'
import { Printer, ArrowLeft, AlertTriangle } from 'lucide-react'
import { getQuote, getLead } from '../data/adminData'
import { quoteConfig, QMC } from '../data/quoteDoc'
import { buildBOM } from '../data/bom'

const ft = (n) => (n == null ? '' : `${n}′`)

// Printable packing list / bill of materials for a quote/order. Open at
// /packing/:quoteId, then "Print / Save PDF" (controls hide when printing).
export default function PackingListPage() {
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

  const bom = buildBOM(quoteConfig(quote))
  const m = bom.meta
  const num = quote.isOrder ? quote.orderNumber : quote.quoteNumber

  return (
    <div className="min-h-screen bg-slate-200 py-8 print:bg-white print:py-0">
      <div className="print:hidden mx-auto max-w-3xl flex items-center justify-between mb-4 px-4">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"><ArrowLeft size={15} /> Back to admin</Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Printer size={15} /> Print / Save PDF</button>
      </div>

      <div className="mx-auto max-w-3xl bg-white shadow-lg print:shadow-none text-slate-900 p-8 print:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="font-display text-lg font-bold">{QMC.name}</div>
            <div className="text-[11px] text-slate-500">Packing list / bill of materials</div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-bold">{num}</div>
            <div className="text-[11px] text-slate-500">{quote.isOrder ? 'Order' : 'Quote'}{lead ? ` · ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}` : ''}</div>
          </div>
        </div>

        {/* Building summary */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 py-4 border-b border-slate-200">
          {[
            ['Building', `${m.W}×${m.L}×${m.H}`],
            ['Roof', m.roofLabel],
            ['Pitch', `${m.pitch}/12`],
            ['Slope len', ft(m.slopeLen)],
            ['Frames', `${m.frameCount} @ ${ft(m.frameSpacingFt)} o.c.`],
            ['Legs', m.legType],
          ].map(([k, v]) => (
            <div key={k}><div className="text-[9px] uppercase tracking-wide text-slate-400">{k}</div><div className="text-xs font-semibold">{v}</div></div>
          ))}
        </div>

        {/* Groups */}
        {bom.groups.map((g) => g.items.length > 0 && (
          <div key={g.id} className="py-4 border-b border-slate-100 break-inside-avoid">
            <h2 className="text-sm font-bold text-slate-900 mb-2">{g.label}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 text-left border-b border-slate-200">
                  <th className="py-1 font-semibold">Item</th>
                  <th className="py-1 font-semibold">Spec</th>
                  <th className="py-1 font-semibold text-right">Qty</th>
                  <th className="py-1 font-semibold text-right">Length ea.</th>
                  <th className="py-1 font-semibold text-right">Total</th>
                  <th className="py-1 font-semibold text-right">Wt (lb)</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-1.5 text-slate-800">{it.item}</td>
                    <td className="py-1.5 text-slate-500 text-xs">{it.spec}</td>
                    <td className="py-1.5 text-right tabular-nums">{it.qty}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">{it.lengthEachFt != null ? ft(it.lengthEachFt) : '—'}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">{it.totalFt != null ? ft(it.totalFt) : '—'}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">{it.weightLb != null ? it.weightLb.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* Totals */}
        <div className="flex flex-wrap gap-x-8 gap-y-1 py-4 text-sm">
          <span><span className="text-slate-500">Steel:</span> <span className="font-semibold">{bom.totals.steelFt}′</span></span>
          <span><span className="text-slate-500">Panels:</span> <span className="font-semibold">{bom.totals.panelSqFt.toLocaleString()} ft²</span></span>
          <span><span className="text-slate-500">Trim:</span> <span className="font-semibold">{bom.totals.trimFt}′</span></span>
          <span><span className="text-slate-500">Est. weight:</span> <span className="font-semibold">{bom.totals.weightLb.toLocaleString()} lb</span></span>
        </div>

        {/* Assumptions */}
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5 text-amber-800 mb-1"><AlertTriangle size={13} /><span className="text-xs font-semibold">Estimate — confirm against the QMC spec sheet</span></div>
          <ul className="list-disc pl-5 text-[11px] text-amber-700 space-y-0.5">
            {bom.assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
