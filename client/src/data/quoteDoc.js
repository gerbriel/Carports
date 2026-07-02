// ─────────────────────────────────────────────────────────────────────────────
// Assembles everything a printable quote / purchase agreement needs from a lead:
// company + customer header, colors, building-spec panel, itemized line items +
// price waterfall (from pricing.js), and the dealer (for co-branding). The Terms
// pages come from quoteTerms.js.
// ─────────────────────────────────────────────────────────────────────────────
import { quoteBreakdown, ROOF_LABELS } from './pricing'
import { getOrg, MFR_ORG_ID, leadName } from './adminData'

export const QMC = {
  name: 'Quality Metal Carports, Inc',
  license: 'CA Lic# 1096004',
  address: '9191 W. Whitesbridge Ave., Fresno, CA 93706',
  phone: '559-755-4900',
  email: 'sales@qualitymetalcarportsca.com',
  web: 'qualitymetalcarportsca.com',
}

const yn = (v) => (v === true ? 'Yes' : v === false ? 'No' : '—')
const fmtDate = (iso) => { try { return new Date(iso || Date.now()).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) } catch { return '' } }

// Parse "24×35×12ft" / "24x35x12" out of a config string when no buildConfig exists.
function parseDims(str = '') {
  const m = String(str).match(/(\d+)\s*[×x]\s*(\d+)\s*[×x]\s*(\d+)/)
  return m ? { width: +m[1], length: +m[2], height: +m[3] } : { width: 12, length: 20, height: 10 }
}

// Best-effort config for a quote: the captured builder snapshot, else minimal.
export function quoteConfig(quote) {
  if (quote?.buildConfig && typeof quote.buildConfig === 'object') return quote.buildConfig
  const dims = quote?.width ? { width: quote.width, length: quote.length, height: quote.height } : parseDims(quote?.config)
  return { ...dims, roofStyle: quote?.roofStyle || 'a_frame_vertical' }
}

// A printable quote/agreement is built from a QUOTE (number, design, pricing,
// pipeline) plus its LEAD (the customer). A lead may have several of these.
export function buildQuoteDoc(quote, lead, opts = {}) {
  const cfg = quoteConfig(quote)
  const org = getOrg(quote?.orgId || lead?.orgId || MFR_ORG_ID)
  const dealer = org && org.kind === 'dealer' ? org : null
  const taxRate = opts.taxRate ?? quote?.taxRate ?? 0.0775
  const breakdown = quoteBreakdown(cfg, { taxRate, additionalCharges: opts.additionalCharges ?? 0 })
  // Permit + engineering path comes from the quote's pipeline toggles.
  const pl = quote?.pipeline || {}
  const planType = pl.engineering_plans // 'none' | 'generic' | 'site_specific'
  const PLAN_LABEL = { none: 'None needed', generic: 'Generic plans', site_specific: 'Site-specific plans' }
  const certified = planType ? planType !== 'none' : !!(cfg.certification && cfg.certification !== 'uncertified')
  const permitRequired = pl.permit_status === 'required' ? true : pl.permit_status === 'not_required' ? false : (lead?.permitRequired ?? null)

  return {
    qmc: QMC,
    dealer, // null for QMC-direct; else co-brand "<Dealer> · Manufactured by QMC"
    isOrder: !!quote?.isOrder,
    quoteNumber: quote?.quoteNumber || '—',
    orderNumber: quote?.orderNumber || '—',
    date: fmtDate(quote?.createdAt),
    customer: {
      name: leadName(lead),
      email: lead?.email || '',
      phone: lead?.phone || '',
      billing: lead?.billingAddress || lead?.address || '',
      shipping: lead?.shippingAddress || lead?.address || '',
    },
    title: `${quote?.name || lead?.structureType || ROOF_LABELS[cfg.roofStyle] || 'Metal Building'} — ${cfg.width} x ${cfg.length} x ${cfg.height}`,
    colors: {
      Roof: cfg.roofColor?.name || 'TBD',
      Trim: cfg.trimColor?.name || 'TBD',
      'Sides/Ends': cfg.wallColor?.name || 'TBD',
      Wainscot: cfg.wainscotEnabled ? (cfg.wainscotColor?.name || 'TBD') : 'NA',
    },
    spec: {
      'Building Dimension': `${cfg.width}’W x ${cfg.length}’L x ${cfg.height}’H`,
      'Roof Style': ROOF_LABELS[cfg.roofStyle] || 'A-Frame Vertical Roof',
      Gauge: `${cfg.gauge || 14} Gauge`,
      'Wind/Snow Rating': `${cfg.windSpeed ?? 105} MPH + ${cfg.groundSnow ?? 30} PSF ${certified ? 'Certified' : 'Uncertified'}`,
      'Engineering Plans': planType ? PLAN_LABEL[planType] : (certified ? 'Required' : 'None'),
      'Distance on Center': `${cfg.frameSpacing ?? 5} Feet`,
    },
    checklist: {
      'Ready for Installation?': yn(pl.scheduling === 'scheduled'),
      'Jobsite Level?': cfg.installationSurface ? 'Yes' : yn(pl.site_level === 'level'),
      'Permit Required?': yn(permitRequired),
      'Inside City Limit?': yn(lead?.insideCityLimit),
      'Electricity Available?': yn(lead?.electricity),
      'Installation Surface?': cfg.installationSurface || 'Ground',
    },
    breakdown,
  }
}
