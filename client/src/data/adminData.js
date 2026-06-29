// ─────────────────────────────────────────────────────────────────────────────
// Admin data layer — PLUG AND PLAY, NO external API dependencies.
//
// Every "self-hosted" module (CRM, chat, analytics, e-sign, social, blog/CMS,
// reviews) is backed by the browser's localStorage so the whole suite WORKS in
// the demo with zero backend. Content modules (blog, reviews) write a localStorage
// OVERLAY that the public site reads, so editing in the admin updates the site
// live (in that browser). To go fully live later, swap read()/write() for your
// real store — the dashboard, capture points, and overlays don't change.
// ─────────────────────────────────────────────────────────────────────────────

import reviewsData from './reviews.json'
import { BLOG_POSTS } from './blogPosts'
import { CITIES } from './cities'

const K = {
  leads: 'qmc_admin_leads',
  quotes: 'qmc_admin_quotes',
  designs: 'qmc_admin_designs',
  convos: 'qmc_admin_convos',
  docs: 'qmc_admin_docs',
  social: 'qmc_admin_social',
  analytics: 'qmc_admin_analytics',
  blog: 'qmc_blog_overlay',
  reviews: 'qmc_reviews_overlay',
}

const emit = () => window.dispatchEvent(new CustomEvent('qmc-admin-change'))
function read(key, fallback = []) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback } catch { return fallback }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); emit() } catch { /* demo only */ }
}
const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const now = () => new Date().toISOString()

function listAdd(key, rec, extra = {}) {
  const arr = read(key)
  arr.unshift({ id: uid(), createdAt: now(), ...extra, ...rec })
  write(key, arr)
}
export function setStatus(kind, id, status) {
  const key = K[kind]; if (!key) return
  write(key, read(key).map((r) => (r.id === id ? { ...r, status } : r)))
}
export function removeRecord(kind, id) {
  const key = K[kind]; if (!key) return
  write(key, read(key).filter((r) => r.id !== id))
}

// ── Leads / Quotes / Designs (captured from the live site) ───────────────────
export const getLeads = () => read(K.leads)
export const addLead = (lead) => listAdd(K.leads, lead, { status: 'new' })
export const getQuotes = () => read(K.quotes)
export const addQuote = (q) => listAdd(K.quotes, q, { status: 'open' })
export const getDesigns = () => read(K.designs)
export const addDesign = (d) => listAdd(K.designs, d)

// ── Chat inbox (Chatwoot-style) ──────────────────────────────────────────────
export const getConversations = () => read(K.convos)
export function addConversation(c) {
  listAdd(K.convos, {
    name: c.name || 'Website visitor', channel: c.channel || 'Website', status: 'open',
    messages: c.messages || [], unread: c.unread ?? 0,
  })
}
export function addMessage(convId, text, from = 'agent') {
  const arr = read(K.convos).map((c) =>
    c.id === convId
      ? { ...c, status: 'open', messages: [...(c.messages || []), { from, text, t: now() }], unread: from === 'visitor' ? (c.unread || 0) + 1 : 0 }
      : c,
  )
  write(K.convos, arr)
}
export const markConversationRead = (id) =>
  write(K.convos, read(K.convos).map((c) => (c.id === id ? { ...c, unread: 0 } : c)))

// ── Documents / e-sign (Documenso-style) ─────────────────────────────────────
export const getDocuments = () => read(K.docs)
export const addDocument = (doc) => listAdd(K.docs, doc, { status: 'draft' })
export const signDocument = (id) =>
  write(K.docs, read(K.docs).map((d) => (d.id === id ? { ...d, status: 'signed', signedAt: now() } : d)))

// ── Social scheduler (Postiz-style) ──────────────────────────────────────────
export const getSocialPosts = () => read(K.social)
export const addSocialPost = (p) => listAdd(K.social, p, { status: 'scheduled' })

// ── Analytics (Plausible-style, tracked client-side) ─────────────────────────
export function trackPageview(path) {
  try {
    const a = read(K.analytics, { events: [], session: null })
    const t = Date.now()
    // crude session (30-min window) to estimate visitors
    if (!a.session || t - a.session.last > 30 * 60 * 1000) a.session = { id: uid(), start: t, last: t }
    else a.session.last = t
    a.events = a.events || []
    a.events.push({ path, t, s: a.session.id })
    if (a.events.length > 3000) a.events = a.events.slice(-3000)
    localStorage.setItem(K.analytics, JSON.stringify(a)) // no emit — avoid re-render storms
  } catch { /* ignore */ }
}
export function getAnalytics() {
  const a = read(K.analytics, { events: [] })
  const events = a.events || []
  const byPath = {}, byDay = {}, sessions = new Set()
  const DAY = 86400000, today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * DAY)
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }), views: 0 }
  })
  const dayIndex = Object.fromEntries(days.map((d, i) => [d.key, i]))
  for (const e of events) {
    byPath[e.path] = (byPath[e.path] || 0) + 1
    sessions.add(e.s)
    const k = new Date(e.t).toISOString().slice(0, 10)
    if (k in dayIndex) days[dayIndex[k]].views++
  }
  const topPages = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, views]) => ({ path, views }))
  return {
    total: events.length,
    visitors: sessions.size,
    topPages,
    days,
    recent: events.slice(-12).reverse(),
  }
}

// ── Reviews (overlay over the bundled reviews.json — read by the public site) ─
export const getSiteReviews = () => read(K.reviews, reviewsData.reviews || [])
export function getReviewSummary() {
  const ov = localStorage.getItem(K.reviews + '_sum')
  if (ov) { try { return JSON.parse(ov) } catch { /* */ } }
  const r = getSiteReviews()
  return { rating: reviewsData.rating ?? 5, total: reviewsData.total ?? r.length }
}
export function saveReview(review) {
  const arr = getSiteReviews().slice()
  if (review.id != null && arr[review.id]) arr[review.id] = { ...arr[review.id], ...review }
  else arr.unshift({ author: 'New Customer', rating: 5, text: '', location: '', date: '', ...review })
  write(K.reviews, arr)
}
export const deleteReview = (idx) => write(K.reviews, getSiteReviews().filter((_, i) => i !== idx))
export function resetReviews() { localStorage.removeItem(K.reviews); localStorage.removeItem(K.reviews + '_sum'); emit() }

// ── Blog (overlay over BLOG_POSTS — read by the public site) ──────────────────
export const getSiteBlog = () => read(K.blog, BLOG_POSTS)
export const getBlogPostBySlug = (slug) => getSiteBlog().find((p) => p.slug === slug) || null
const slugify = (s) => (s || 'post').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
export function saveBlogPost(post) {
  const arr = getSiteBlog().slice()
  const i = post.slug ? arr.findIndex((p) => p.slug === post.slug) : -1
  if (i >= 0) arr[i] = { ...arr[i], ...post }
  else arr.unshift({
    slug: slugify(post.title) || `post-${Date.now()}`, title: 'Untitled', excerpt: '', html: '',
    feature_image: '', published_at: now(), reading_time: 1, tags: [{ id: 0, name: 'Article' }], ...post,
  })
  write(K.blog, arr)
}
export const deleteBlogPost = (slug) => write(K.blog, getSiteBlog().filter((p) => p.slug !== slug))
export function resetBlog() { localStorage.removeItem(K.blog); emit() }

// ── Pages (real site structure) ──────────────────────────────────────────────
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
export const getPages = () => ({
  core: CORE_PAGES,
  generated: [
    { name: 'City / county location pages', count: CITIES.length, sample: `/locations/${CITIES[0]?.slug || ''}` },
    { name: 'Blog articles', count: getSiteBlog().length, sample: `/blog/${getSiteBlog()[0]?.slug || ''}` },
  ],
})

// ── Sample data (written to localStorage on demand; nothing baked into views) ─
export function clearDemoData() {
  ;['leads', 'quotes', 'designs', 'convos', 'docs', 'social', 'analytics'].forEach((k) => write(K[k], []))
  resetReviews(); resetBlog()
}
export function loadSampleData() {
  ;[
    { firstName: 'Marcus', lastName: 'Hill', email: 'm.hill@example.com', phone: '(559) 555-0142', structureType: 'Metal Garage', message: 'Looking for a 24x30 enclosed garage with a roll-up door in Clovis. Lead time?', status: 'new' },
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
  ;[
    { name: 'Marcus Hill', channel: 'Website', unread: 1, messages: [
      { from: 'visitor', text: 'Hi! Do you install in Clovis?', t: now() },
      { from: 'agent', text: 'We do — Clovis is right in our backyard. What size are you thinking?', t: now() },
      { from: 'visitor', text: 'A 24x30 garage with a roll-up door.', t: now() },
    ] },
    { name: 'Theresa N.', channel: 'Facebook', unread: 0, messages: [
      { from: 'visitor', text: 'What colors do the RV covers come in?', t: now() },
      { from: 'agent', text: 'Over a dozen — I can send the swatch sheet. What\'s your email?', t: now() },
    ] },
  ].forEach(addConversation)
  ;[
    { title: 'Quote #1042 — Hill Garage', recipient: 'm.hill@example.com', status: 'sent', amount: 16850 },
    { title: 'Install Agreement — Romero Barn', recipient: 'sromero@example.com', status: 'signed', amount: 48200, signedAt: now() },
    { title: 'Quote #1039 — Roberts RV Cover', recipient: 'diane.r@example.com', status: 'draft', amount: 9400 },
  ].forEach(addDocument)
  ;[
    { platform: 'Instagram', content: 'New 30×40 shop we just wrapped in Fresno 🔧 Swipe for the build →', when: new Date(Date.now() + 86400000).toISOString(), status: 'scheduled' },
    { platform: 'Facebook', content: 'Fall booking is filling up — lock in your 2026 install date now.', when: new Date(Date.now() + 3 * 86400000).toISOString(), status: 'scheduled' },
    { platform: 'Instagram', content: 'Behind the scenes at the World Ag Expo 🚜', when: new Date(Date.now() - 2 * 86400000).toISOString(), status: 'posted' },
  ].forEach(addSocialPost)
  // a little analytics history
  try {
    const paths = ['/', '/services/metal-garages', '/locations/fresno-ca', '/blog', '/services/rv-covers', '/contact', '/builder']
    const events = []
    for (let d = 13; d >= 0; d--) {
      const base = Date.now() - d * 86400000
      const n = 8 + Math.floor(Math.random() * 22)
      for (let i = 0; i < n; i++) events.push({ path: paths[Math.floor(Math.random() * paths.length)], t: base + i * 60000, s: `s-${d}-${Math.floor(i / 3)}` })
    }
    localStorage.setItem(K.analytics, JSON.stringify({ events, session: null }))
    emit()
  } catch { /* */ }
}
