// ─────────────────────────────────────────────────────────────────────────────
// Admin demo data layer — PLUG AND PLAY, no hardcoded results.
//
// The dashboard reads everything through these functions. Today they're backed by
// the browser's localStorage (so the demo works with zero backend and captures
// REAL submissions from the contact form + 3-D builder). To go live, swap the
// read()/write() bodies for your API or Supabase — the dashboard and the capture
// points (addLead / addQuote / addDesign) don't change.
//
// Reviews, blog posts, and pages are read straight from the site's own data, so
// they're always real and current — nothing is faked here.
// ─────────────────────────────────────────────────────────────────────────────

import reviewsData from './reviews.json'
import { BLOG_POSTS } from './blogPosts'
import { CITIES } from './cities'

const K = {
  leads: 'qmc_admin_leads',
  quotes: 'qmc_admin_quotes',
  designs: 'qmc_admin_designs',
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function write(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr))
    window.dispatchEvent(new CustomEvent('qmc-admin-change'))
  } catch { /* private mode / storage full — demo only */ }
}
const uid = () =>
  globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ── Captured records (written by the live site, read by the dashboard) ───────
export const getLeads = () => read(K.leads)
export function addLead(lead) {
  const arr = read(K.leads)
  arr.unshift({ id: uid(), createdAt: new Date().toISOString(), status: 'new', ...lead })
  write(K.leads, arr)
}

export const getQuotes = () => read(K.quotes)
export function addQuote(quote) {
  const arr = read(K.quotes)
  arr.unshift({ id: uid(), createdAt: new Date().toISOString(), status: 'open', ...quote })
  write(K.quotes, arr)
}

export const getDesigns = () => read(K.designs)
export function addDesign(design) {
  const arr = read(K.designs)
  arr.unshift({ id: uid(), createdAt: new Date().toISOString(), ...design })
  write(K.designs, arr)
}

export function setStatus(kind, id, status) {
  const key = K[kind]; if (!key) return
  write(key, read(key).map((r) => (r.id === id ? { ...r, status } : r)))
}
export function removeRecord(kind, id) {
  const key = K[kind]; if (!key) return
  write(key, read(key).filter((r) => r.id !== id))
}

// ── Real, already-published content (read-only) ──────────────────────────────
export const getReviews = () =>
  (reviewsData.reviews || []).map((r, i) => ({ id: `rv-${i}`, ...r }))
export const reviewSummary = () => ({
  rating: reviewsData.rating ?? 5,
  total: reviewsData.total ?? (reviewsData.reviews || []).length,
})
export const getBlogPosts = () => BLOG_POSTS

const CORE_PAGES = [
  { name: 'Home', path: '/', type: 'Core' },
  { name: 'Services', path: '/services', type: 'Core' },
  { name: 'Metal Carports', path: '/services/metal-carports', type: 'Service' },
  { name: 'Metal Garages', path: '/services/metal-garages', type: 'Service' },
  { name: 'RV Covers', path: '/services/rv-covers', type: 'Service' },
  { name: 'Agricultural Buildings', path: '/services/agricultural-buildings', type: 'Service' },
  { name: 'Boat Storage', path: '/services/boat-storage', type: 'Service' },
  { name: 'Locations', path: '/locations', type: 'Core' },
  { name: 'About', path: '/about', type: 'Core' },
  { name: 'Contact', path: '/contact', type: 'Core' },
  { name: 'Blog', path: '/blog', type: 'Core' },
]
export function getPages() {
  return {
    core: CORE_PAGES,
    generated: [
      { name: 'City / county location pages', count: CITIES.length, sample: `/locations/${CITIES[0]?.slug || ''}` },
      { name: 'Blog articles', count: BLOG_POSTS.length, sample: `/blog/${BLOG_POSTS[0]?.slug || ''}` },
    ],
  }
}

// ── Optional sample data for showing the dashboard populated. Nothing is baked
// into the dashboard itself — this just writes example rows into localStorage on
// demand (and "Clear" wipes them). Real submissions appear the same way. ───────
export function clearDemoData() {
  Object.values(K).forEach((key) => write(key, []))
}
export function loadSampleData() {
  clearDemoData()
  ;[
    { firstName: 'Marcus', lastName: 'Hill', email: 'm.hill@example.com', phone: '(559) 555-0142', structureType: 'Metal Garage', message: 'Looking for a 24x30 enclosed garage with a roll-up door in Clovis. What is your lead time?', status: 'new' },
    { firstName: 'Diane', lastName: 'Roberts', email: 'diane.r@example.com', phone: '(661) 555-0199', structureType: 'RV Cover', message: 'Need a tall cover for a 40ft Class A motorhome near Bakersfield.', status: 'contacted' },
    { firstName: 'Sal', lastName: 'Romero', email: 'sromero@example.com', phone: '(209) 555-0167', structureType: 'Agricultural Building', message: '60x100 open hay barn for our ranch outside Merced. Ag-exempt parcel.', status: 'quoted' },
  ].forEach(addLead)
  ;[
    { name: 'Marcus Hill', config: '24×30×12ft – Metal Garage', price: 16850, status: 'open' },
    { name: 'Sal Romero', config: '60×100×16ft – Agricultural Building', price: 48200, status: 'sent' },
  ].forEach(addQuote)
  ;[
    { name: 'Garage build', config: '24×30×12ft – A-Frame Vertical', price: 16850, width: 24, length: 30, height: 12, roofStyle: 'A-Frame Vertical' },
    { name: 'RV cover', config: '18×40×14ft – A-Frame Vertical', price: 9400, width: 18, length: 40, height: 14, roofStyle: 'A-Frame Vertical' },
  ].forEach(addDesign)
}
