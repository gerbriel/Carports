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
  pages: 'qmc_pages_overlay',
  users: 'qmc_users',
  templates: 'qmc_templates',
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
// Assign/reassign any record (lead, quote, conversation, document) to a user.
export function assign(kind, id, userId) {
  const key = K[kind]; if (!key) return
  write(key, read(key).map((r) => (r.id === id ? { ...r, assignee: userId || null } : r)))
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

// ── Pages: editable hero/header content + custom-page CRUD (overlay) ──────────
// Editable core pages keep their default content here (matching the live
// components); the public Hero/About/Contact/Services read getPageFields() so
// edits show on the site. Custom (new/duplicated) pages render at /p/:slug.
const PAGE_DEFAULTS = {
  home: { eyebrow: 'CA LIC# 1096004 · Fresno & Northern California', title1: 'Built to Last.', title2: 'Steel Strong.', intro: "That truck, RV, or tractor sitting out in the Valley sun deserves better. We build custom steel carports, garages, and barns made for California weather, backed by warranties we put in writing and a local crew that sticks around long after the job is done.", cta: 'Get a Free Quote' },
  about: { eyebrow: 'About Us', title1: 'Local. Accountable.', title2: 'Steel Strong.', intro: 'Quality Metal Carports Inc. has been building custom metal structures in California for over 15 years. We are not a national franchise. We are a local team that shows up, does the work, and backs it with a real warranty.' },
  contact: { eyebrow: 'Get in Touch', title1: 'Ready to Build?', title2: "Let's Talk.", intro: "Tell us a bit about what you have in mind and we'll get back to you within one business day with a free, itemized quote. No pressure and no pushy sales calls." },
  services: { eyebrow: 'What We Build', title1: 'Our Services', title2: '', intro: 'Every structure we build is custom, engineered to your site, your dimensions, and how you actually plan to use it. Take a look at everything we build below.' },
}
const CORE_PAGES_META = [
  { id: 'home', name: 'Home', path: '/', editable: true },
  { id: 'services', name: 'Services', path: '/services', editable: true },
  { id: 'about', name: 'About', path: '/about', editable: true },
  { id: 'contact', name: 'Contact', path: '/contact', editable: true },
  { id: 'blog', name: 'Blog', path: '/blog', editable: false, note: 'Edit articles in the Blog tab' },
  { id: 'locations', name: 'Locations', path: '/locations', editable: false, note: 'Auto-generated from your service areas' },
]
const readPages = () => read(K.pages, { core: {}, custom: [] })
const writePages = (v) => write(K.pages, v)

export const getPageFields = (id) => ({ ...PAGE_DEFAULTS[id], ...(readPages().core[id] || {}) })
export function savePageFields(id, patch) { const p = readPages(); p.core[id] = { ...(p.core[id] || {}), ...patch }; writePages(p) }

export const getCustomPages = () => readPages().custom
export const getCustomPage = (slug) => readPages().custom.find((c) => c.slug === slug) || null
export function saveCustomPage(page) {
  const p = readPages(); const i = p.custom.findIndex((c) => c.slug === page.slug)
  if (i >= 0) p.custom[i] = { ...p.custom[i], ...page }
  else p.custom.unshift({ slug: page.slug || `page-${Date.now()}`, ...page })
  writePages(p)
}
export const deleteCustomPage = (slug) => { const p = readPages(); p.custom = p.custom.filter((c) => c.slug !== slug); writePages(p) }

export function duplicatePage(id) {
  const core = CORE_PAGES_META.find((m) => m.id === id && m.editable)
  let src
  if (core) { const f = getPageFields(id); src = { name: `${core.name} (copy)`, eyebrow: f.eyebrow, title1: f.title1, title2: f.title2 || '', intro: f.intro || '', body: '<p>Duplicated from a template — edit me.</p>' } }
  else { const c = getCustomPage(id); if (c) src = { ...c, name: `${c.name || 'Page'} (copy)` } }
  if (!src) return null
  const slug = `${slugify(src.name)}-${Math.random().toString(36).slice(2, 5)}`
  saveCustomPage({ ...src, slug })
  return slug
}
export function createPage() {
  const slug = `page-${Math.random().toString(36).slice(2, 6)}`
  saveCustomPage({ slug, name: 'New page', eyebrow: 'New', title1: 'New page', title2: '', intro: 'Edit this page in the admin — it shows on the site at this URL.', body: '<p>Your content here.</p>' })
  return slug
}

// Admin list (core + custom); generated counts for the directory pages.
export function getAllPages() {
  const core = CORE_PAGES_META.map((m) => ({ ...m, type: 'Core', title: m.editable ? getPageFields(m.id).title1 : m.name }))
  const custom = getCustomPages().map((c) => ({ id: c.slug, name: c.name || c.title1 || 'Untitled', path: `/p/${c.slug}`, type: 'Custom', editable: true, custom: true, title: c.title1 }))
  return [...core, ...custom]
}
export const getGeneratedPages = () => [
  { name: 'City / county location pages', count: CITIES.length, sample: `/locations/${CITIES[0]?.slug || ''}` },
  { name: 'Blog articles', count: getSiteBlog().length, sample: `/blog/${getSiteBlog()[0]?.slug || ''}` },
]

// ── Team: users, roles & permissions ─────────────────────────────────────────
// Roles gate what each user can do. Permissions are advisory in the demo (the
// dashboard reads them to show/hide), but the shape is real so a backend can
// enforce them later.
export const PERMISSIONS = [
  { id: 'users', label: 'Manage team' },
  { id: 'leads', label: 'Leads' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'documents', label: 'Documents' },
  { id: 'content', label: 'Pages & blog' },
  { id: 'chat', label: 'Inbox / chat' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'social', label: 'Social' },
]
export const ROLES = {
  admin: { label: 'Admin', desc: 'Full access — team, settings, and every module.', perms: ['users', 'leads', 'quotes', 'documents', 'content', 'chat', 'analytics', 'social'] },
  manager: { label: 'Manager', desc: 'Runs the day-to-day: leads, quotes, docs, content & assignments.', perms: ['leads', 'quotes', 'documents', 'content', 'chat', 'analytics', 'social'] },
  sales: { label: 'Sales', desc: 'Works assigned leads, quotes and live chats.', perms: ['leads', 'quotes', 'chat'] },
  viewer: { label: 'Viewer', desc: 'Read-only — reports and analytics.', perms: ['analytics'] },
}
export const roleCan = (role, perm) => !!ROLES[role]?.perms.includes(perm)

const DEFAULT_USERS = [
  { id: 'u-carlos', name: 'Carlos Dominguez', email: 'carlos@qualitymetalcarportsca.com', role: 'admin', active: true },
  { id: 'u-gabriel', name: 'Gabriel Rios', email: 'gabriel@qualitymetalcarportsca.com', role: 'manager', active: true },
  { id: 'u-piper', name: 'Piper Vance', email: 'piper@qualitymetalcarportsca.com', role: 'sales', active: true },
  { id: 'u-gladis', name: 'Gladis Romero', email: 'gladis@qualitymetalcarportsca.com', role: 'sales', active: true },
]
export function getUsers() {
  let u = read(K.users, null)
  if (!u) { u = DEFAULT_USERS; try { localStorage.setItem(K.users, JSON.stringify(u)) } catch { /* demo */ } }
  return u
}
export const getUser = (id) => getUsers().find((u) => u.id === id) || null
export const getUserName = (id) => getUser(id)?.name || null
export const addUser = (u) => { const arr = getUsers(); arr.push({ id: uid(), active: true, role: 'sales', ...u }); write(K.users, arr) }
export const updateUser = (id, patch) => write(K.users, getUsers().map((u) => (u.id === id ? { ...u, ...patch } : u)))

// Count records currently assigned to a user across every module.
export function assignedCount(userId) {
  const kinds = ['leads', 'quotes', 'convos', 'docs']
  return kinds.reduce((n, k) => n + read(K[k]).filter((r) => r.assignee === userId).length, 0)
}
// Remove a user, handing their leads/quotes/chats/documents to someone else
// (or leaving them unassigned when reassignTo is null).
export function removeUser(id, reassignTo = null) {
  ;['leads', 'quotes', 'convos', 'docs'].forEach((k) => {
    write(K[k], read(K[k]).map((r) => (r.assignee === id ? { ...r, assignee: reassignTo } : r)))
  })
  write(K.users, getUsers().filter((u) => u.id !== id))
}

// ── Templates: what quotes & documents look like ─────────────────────────────
const DEFAULT_TEMPLATES = [
  { id: 't-quote', name: 'Standard Quote', type: 'quote', subject: 'Your custom metal building quote', body: '<h2>Your Custom Metal Building Quote</h2><p>Thank you for considering Quality Metal Carports. Below is your itemized quote — valid for 30 days.</p><ul><li>Engineer-stamped drawings included</li><li>Free delivery &amp; professional installation</li><li>20-year rust-through warranty</li></ul><p>Questions? Call us at 559-755-4900.</p>' },
  { id: 't-agreement', name: 'Installation Agreement', type: 'document', subject: 'Installation agreement', body: '<h2>Installation Agreement</h2><p>This agreement covers the manufacture, delivery, and installation of the structure described in your accepted quote.</p><h3>Site preparation</h3><p>The customer is responsible for a level, accessible install site.</p><h3>Warranty</h3><p>Backed by our written 20-year rust-through warranty.</p>' },
  { id: 't-invoice', name: 'Deposit Invoice', type: 'document', subject: 'Deposit invoice', body: '<h2>Deposit Invoice</h2><p>A 10% deposit reserves your build slot and locks in pricing. The balance is due on installation day.</p>' },
]
export function getTemplates() {
  let t = read(K.templates, null)
  if (!t) { t = DEFAULT_TEMPLATES; try { localStorage.setItem(K.templates, JSON.stringify(t)) } catch { /* demo */ } }
  return t
}
export const getTemplate = (id) => getTemplates().find((t) => t.id === id) || null
export function saveTemplate(tpl) {
  const arr = getTemplates(); const i = arr.findIndex((t) => t.id === tpl.id)
  if (i >= 0) arr[i] = { ...arr[i], ...tpl }; else arr.unshift({ id: uid(), type: 'document', ...tpl })
  write(K.templates, arr)
}
export const removeTemplate = (id) => write(K.templates, getTemplates().filter((t) => t.id !== id))

// ── Sample data (written to localStorage on demand; nothing baked into views) ─
export function clearDemoData() {
  ;['leads', 'quotes', 'designs', 'convos', 'docs', 'social', 'analytics'].forEach((k) => write(K[k], []))
  resetReviews(); resetBlog()
  ;[K.pages, K.users, K.templates].forEach((k) => localStorage.removeItem(k))
  emit()
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
  // Spread the new work across the team so assignment is visible in the demo.
  getUsers()
  const spread = (kind, ids) => { const arr = read(K[kind]); arr.forEach((r, i) => { r.assignee = ids[i % ids.length] }); write(K[kind], arr) }
  spread('leads', ['u-piper', 'u-gladis', 'u-gabriel'])
  spread('quotes', ['u-gabriel', 'u-piper'])
  spread('convos', ['u-piper', 'u-gladis'])
  spread('docs', ['u-gabriel', 'u-piper', 'u-gladis'])
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
