// ─────────────────────────────────────────────────────────────────────────────
// Global search index. Aggregates every navigable destination on the marketing
// site (pages, services, and all CA/AZ/NV location pages) into one flat, ranked
// list. Blog articles are merged in at search time from the live Ghost feed.
// ─────────────────────────────────────────────────────────────────────────────

import { CITIES } from './cities'

const STATE_NAME = { CA: 'California', NV: 'Nevada', AZ: 'Arizona' }

// Top-level pages.
const PAGE_ENTRIES = [
  { type: 'Page', title: 'Home', subtitle: 'Quality Metal Carports', path: '/', keywords: 'home start main' },
  { type: 'Page', title: 'Our Services', subtitle: 'Everything we build', path: '/services', keywords: 'services what we build overview' },
  { type: 'Page', title: 'Service Areas', subtitle: 'Where we build', path: '/locations', keywords: 'locations cities counties areas california arizona nevada coverage' },
  { type: 'Page', title: 'About Us', subtitle: 'Our story', path: '/about', keywords: 'about company story team history license accountable' },
  { type: 'Page', title: 'Blog', subtitle: 'Tips & guides', path: '/blog', keywords: 'blog articles guides tips news advice' },
  { type: 'Page', title: 'Contact', subtitle: 'Get a free quote — call Mon–Fri, 8–5 PST', path: '/contact', keywords: 'contact quote free quote call phone email get in touch message hours' },
  { type: 'Page', title: '3D Builder', subtitle: 'Design your building in 3D', path: '/builder', keywords: '3d builder design configure customize visualize price' },
]

// Service detail pages.
const SERVICE_ENTRIES = [
  { type: 'Service', title: 'Metal Carports', subtitle: 'Single, double & triple-wide', path: '/services/metal-carports', keywords: 'carport carports vehicle truck car parking shade cover open' },
  { type: 'Service', title: 'Metal Garages', subtitle: 'Fully enclosed & lockable', path: '/services/metal-garages', keywords: 'garage garages workshop enclosed shop storage roll-up door' },
  { type: 'Service', title: 'RV Covers', subtitle: 'Class A, B & C clearances', path: '/services/rv-covers', keywords: 'rv cover motorhome fifth wheel trailer camper coach' },
  { type: 'Service', title: 'Agricultural Buildings', subtitle: 'Barns & clear-span storage', path: '/services/agricultural-buildings', keywords: 'agricultural barn barns hay equipment farm ranch livestock pole barn clear span' },
  { type: 'Service', title: 'Boat Storage', subtitle: 'Covered & enclosed', path: '/services/boat-storage', keywords: 'boat storage watercraft marine cover dock' },
]

// Every location page (cities + county pages across all three states).
const LOCATION_ENTRIES = CITIES.map((c) => {
  const st = c.stateCode || 'CA'
  return {
    type: 'Location',
    title: `${c.name}, ${st}`,
    subtitle: c.county,
    path: `/locations/${c.slug}`,
    keywords: `${c.name} ${c.county} ${c.region || ''} ${STATE_NAME[st] || ''}`,
  }
})

// Combine and precompute lowercased fields for fast matching.
export const SEARCH_ENTRIES = [
  ...PAGE_ENTRIES,
  ...SERVICE_ENTRIES,
  ...LOCATION_ENTRIES,
].map((e, i) => ({
  ...e,
  id: `${e.type}-${i}`,
  _title: e.title.toLowerCase(),
  _hay: `${e.title} ${e.subtitle} ${e.keywords || ''}`.toLowerCase(),
}))

// Sort priority by type when match scores tie (pages/services beat the long tail
// of location pages so a query like "garage" surfaces the service first).
export const TYPE_ORDER = { Page: 0, Service: 1, Article: 2, Location: 3 }
