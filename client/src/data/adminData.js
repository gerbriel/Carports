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
  orgs: 'qmc_orgs',          // dealerships + the manufacturer org
  session: 'qmc_session',    // simulated "logged-in" user
  folders: 'qmc_folders',    // file-manager folders (Phase 3)
  files: 'qmc_files',        // file-manager files (Phase 3)
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
  const created = { id: uid(), createdAt: now(), ...extra, ...rec }
  arr.unshift(created)
  write(key, arr)
  return created
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

// Human-friendly sequential numbers (order #, quote #) for the customer portal.
function nextNumber(prefix) {
  const key = `qmc_seq_${prefix}`
  let n = 1000
  try { n = parseInt(localStorage.getItem(key) || '1000', 10) + 1; localStorage.setItem(key, String(n)) } catch { /* demo */ }
  return `${prefix}-${n}`
}

// ── Orgs: the manufacturer (QMC) + every dealership ───────────────────────────
// Multi-tenant root. `mfr` is Quality Metal Carports itself; every other org is a
// dealership. Leads/quotes/designs/files carry an `orgId` pointing here, and the
// scoping selectors below enforce one-way visibility (QMC sees all; a dealer sees
// only its own). Swap read()/write() for a real API to enforce this server-side.
export const MFR_ORG_ID = 'mfr'
const DEFAULT_ORGS = [
  { id: MFR_ORG_ID, name: 'Quality Metal Carports', slug: 'quality-metal', kind: 'manufacturer', brandColor: '#c8102e', phone: '559-755-4900', active: true },
]
export function getOrgs() {
  let o = read(K.orgs, null)
  if (!o) { o = DEFAULT_ORGS; try { localStorage.setItem(K.orgs, JSON.stringify(o)) } catch { /* demo */ } }
  return o
}
export const getOrg = (id) => getOrgs().find((o) => o.id === id) || null
export const getOrgName = (id) => getOrg(id)?.name || null
export const getDealerOrgs = () => getOrgs().filter((o) => o.kind === 'dealer')
export const getOrgByEmbedKey = (key) => getOrgs().find((o) => o.embedKey === key) || null
export function addOrg(o) {
  const arr = getOrgs()
  const rec = {
    id: uid(), kind: 'dealer', active: true, createdAt: now(),
    brandColor: '#c8102e', embedKey: `dlr_${Math.random().toString(36).slice(2, 10)}`,
    ...o,
  }
  arr.push(rec); write(K.orgs, arr); return rec
}
export const updateOrg = (id, patch) => write(K.orgs, getOrgs().map((o) => (o.id === id ? { ...o, ...patch } : o)))
export function removeOrg(id) {
  if (id === MFR_ORG_ID) return
  write(K.orgs, getOrgs().filter((o) => o.id !== id))
}

// ── Session: who is "logged in" (simulated). Drives every scoped view ─────────
export const getSession = () => read(K.session, null)
export function setSession(userId) {
  try { localStorage.setItem(K.session, JSON.stringify({ userId })) } catch { /* demo */ }
  emit()
}
export function clearSession() { localStorage.removeItem(K.session); emit() }
export function currentUser() {
  const s = getSession()
  return s?.userId ? getUser(s.userId) : null
}
// The open /admin has no login; fall back to the first manufacturer admin so the
// dashboard always renders. Real auth would require an explicit session instead.
export function effectiveUser() {
  return (
    currentUser() ||
    getUsers().find((u) => u.role === 'mfr_admin') ||
    getUsers().find((u) => roleScope(u.role) === 'manufacturer') ||
    getUsers()[0] || null
  )
}
export const currentOrg = () => { const u = effectiveUser(); return u ? getOrg(u.orgId || MFR_ORG_ID) : null }

// ── Tenant isolation (the core) ───────────────────────────────────────────────
// One-way visibility: a manufacturer user sees every record; a dealer user sees
// ONLY records owned by their own org. Used by every list view.
export const roleScope = (role) => ROLES[role]?.scope || 'manufacturer'
export const isManufacturerUser = (u) => roleScope(u?.role) === 'manufacturer'
export const isDealerUser = (u) => roleScope(u?.role) === 'dealer'
export function canSeeOrg(viewer, recordOrgId) {
  if (!viewer) return false
  const scope = roleScope(viewer.role)
  if (scope === 'manufacturer') return true
  if (scope === 'dealer') return (recordOrgId || MFR_ORG_ID) === viewer.orgId
  return false
}
// Filter any list of org-tagged records for a viewer.
export function scopeRecords(viewer, records) {
  if (!viewer) return []
  const scope = roleScope(viewer.role)
  if (scope === 'manufacturer') return records
  if (scope === 'dealer') return records.filter((r) => (r.orgId || MFR_ORG_ID) === viewer.orgId)
  return []
}
export const scopedLeads = (viewer = effectiveUser()) => scopeRecords(viewer, getLeads())
export const scopedQuotes = (viewer = effectiveUser()) => scopeRecords(viewer, getQuotes())
export const scopedDesigns = (viewer = effectiveUser()) => scopeRecords(viewer, getDesigns())
// Team list a viewer may manage: QMC sees all users; a dealer sees only its own.
export function scopedUsers(viewer = effectiveUser()) {
  if (!viewer) return []
  return roleScope(viewer.role) === 'manufacturer' ? getUsers() : getUsers().filter((u) => u.orgId === viewer.orgId)
}

// ── Leads (the CUSTOMER / opportunity) ───────────────────────────────────────
// A lead is the contact + org + salesperson. The building itself — number,
// design, pricing, pipeline — lives on its quotes/orders below. One lead can
// have MANY quotes and MANY orders.
export const getLeads = () => read(K.leads)
export function addLead(lead) {
  const rec = { status: 'new', orgId: MFR_ORG_ID, salespersonId: null, ...lead }
  if (!rec.assignee && rec.salespersonId) rec.assignee = rec.salespersonId
  return listAdd(K.leads, rec)
}
export const getLead = (id) => getLeads().find((l) => l.id === id) || null
export const leadName = (l) => [l?.firstName, l?.lastName].filter(Boolean).join(' ') || 'Customer'

// ── Quotes / Orders (each its own record under a lead) ───────────────────────
// A quote always has a quoteNumber; it BECOMES an order in place (gains an
// orderNumber + isOrder) when the agreement is signed and the deposit is placed.
export const getQuotes = () => read(K.quotes)
export const getQuote = (id) => getQuotes().find((q) => q.id === id) || null
export const getLeadQuotes = (leadId) => getQuotes().filter((q) => q.leadId === leadId)
export function addQuote(q) {
  return listAdd(K.quotes, {
    status: 'draft', orgId: MFR_ORG_ID, isOrder: false, pipeline: {},
    quoteNumber: nextNumber('Q'), ...q,
  })
}
export const updateQuote = (id, patch) => write(K.quotes, getQuotes().map((q) => (q.id === id ? { ...q, ...patch } : q)))
export function promoteToOrder(id) {
  const q = getQuote(id)
  if (!q || q.orderNumber) return
  updateQuote(id, { orderNumber: nextNumber('ORD'), isOrder: true, status: 'ordered' })
}
// Update one pipeline stage on a quote/order; auto-promote to an order once the
// deposit is marked paid (proxy for "agreement signed + deposit placed").
export function setQuotePipelineStage(quoteId, key, value) {
  write(K.quotes, getQuotes().map((q) => {
    if (q.id !== quoteId) return q
    const prev = q.pipeline || {}
    const patch = { pipeline: { ...prev, [key]: value, _ts: { ...(prev._ts || {}), [key]: now() } } }
    if (key === 'deposit' && value === 'paid' && !q.orderNumber) {
      patch.orderNumber = nextNumber('ORD'); patch.isOrder = true; patch.status = 'ordered'
    }
    return { ...q, ...patch }
  }))
}
// Customer-portal lookup: match a quote # OR order # → its quote + lead.
export function findByNumber(num) {
  if (!num) return null
  const s = String(num).trim().toLowerCase()
  const quote = getQuotes().find((q) => [q.quoteNumber, q.orderNumber].some((n) => n && String(n).toLowerCase() === s))
  return quote ? { quote, lead: getLead(quote.leadId) } : null
}
export const getDesigns = () => read(K.designs)
export const getDesign = (id) => getDesigns().find((d) => d.id === id) || null
export const addDesign = (d) => listAdd(K.designs, d, { orgId: MFR_ORG_ID })
// Re-save an edited 3D model (from the builder) onto the same design record.
export const updateDesign = (id, patch) => write(K.designs, getDesigns().map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now() } : d)))

// ── Files & folders (scoped by org; drag-and-drop sortable) ───────────────────
// Folders and files both carry an `orgId` so a dealer only ever touches their own.
// "Uploads" are stored as data URLs in the demo (swap for object storage later).
export const getFolders = (orgId) => {
  const f = read(K.folders)
  const scoped = orgId ? f.filter((x) => (x.orgId || MFR_ORG_ID) === orgId) : f
  return scoped.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
}
export function addFolder({ orgId = MFR_ORG_ID, name = 'New folder', parentId = null }) {
  const arr = read(K.folders)
  const order = arr.filter((f) => (f.orgId || MFR_ORG_ID) === orgId).length
  const rec = { id: uid(), orgId, parentId, name, order, createdAt: now() }
  arr.push(rec); write(K.folders, arr); return rec
}
export const renameFolder = (id, name) => write(K.folders, read(K.folders).map((f) => (f.id === id ? { ...f, name } : f)))
export function removeFolder(id) {
  write(K.files, read(K.files).filter((x) => x.folderId !== id)) // cascade delete its files
  write(K.folders, read(K.folders).filter((f) => f.id !== id))
}
export function reorderFolders(orderedIds) {
  const pos = new Map(orderedIds.map((id, i) => [id, i]))
  write(K.folders, read(K.folders).map((f) => (pos.has(f.id) ? { ...f, order: pos.get(f.id) } : f)))
}
export const getFiles = (folderId) => read(K.files).filter((x) => x.folderId === folderId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
export const getLeadFiles = (leadId) => read(K.files).filter((x) => x.leadId === leadId)
export function addFile({ orgId = MFR_ORG_ID, folderId = null, leadId = null, name, kind = 'file', dataUrl = null }) {
  const arr = read(K.files)
  const order = arr.filter((x) => x.folderId === folderId).length
  const rec = { id: uid(), orgId, folderId, leadId, name, kind, dataUrl, order, createdAt: now() }
  arr.push(rec); write(K.files, arr); return rec
}
export const removeFile = (id) => write(K.files, read(K.files).filter((x) => x.id !== id))
export const moveFile = (id, folderId) => write(K.files, read(K.files).map((x) => (x.id === id ? { ...x, folderId } : x)))
export const tagFileLead = (id, leadId) => write(K.files, read(K.files).map((x) => (x.id === id ? { ...x, leadId: leadId || null } : x)))
export function reorderFiles(orderedIds) {
  const pos = new Map(orderedIds.map((id, i) => [id, i]))
  write(K.files, read(K.files).map((x) => (pos.has(x.id) ? { ...x, order: pos.get(x.id) } : x)))
}

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
export const getDocument = (id) => getDocuments().find((d) => d.id === id) || null
export const addDocument = (doc) => listAdd(K.docs, doc, { status: 'draft' })
// Build out a document (title, body content, recipient, signers, etc.).
export function updateDocument(id, patch) {
  write(K.docs, getDocuments().map((d) => (d.id === id ? { ...d, ...patch } : d)))
}
// Lock the document and move it into the signing flow (draft → sent).
export function sendDocument(id) {
  write(K.docs, getDocuments().map((d) => (d.id === id ? { ...d, status: 'sent', sentAt: now() } : d)))
}
// Record one signer's signature; when everyone has signed, the doc is complete.
export function signDocumentBy(id, signerId, signature) {
  write(K.docs, getDocuments().map((d) => {
    if (d.id !== id) return d
    const signers = (d.signers || []).map((s) =>
      s.id === signerId ? { ...s, name: s.name || signature, signed: true, signature, signedAt: now() } : s)
    const allSigned = signers.length > 0 && signers.every((s) => s.signed)
    return { ...d, signers, status: allSigned ? 'signed' : d.status, signedAt: allSigned ? now() : d.signedAt }
  }))
}
// Back-compat one-click sign (marks the whole document signed).
export const signDocument = (id) =>
  write(K.docs, getDocuments().map((d) => (d.id === id
    ? { ...d, status: 'signed', signedAt: now(), signers: (d.signers || []).map((s) => ({ ...s, signed: true, signedAt: s.signedAt || now() })) }
    : d)))

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
  { id: 'dealers', label: 'Dealerships' },
  { id: 'leads', label: 'Leads' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'quotes', label: 'Quotes' },
  { id: 'documents', label: 'Documents' },
  { id: 'files', label: 'Files' },
  { id: 'content', label: 'Pages & blog' },
  { id: 'chat', label: 'Inbox / chat' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'social', label: 'Social' },
]
// `scope` is the tenant boundary: 'manufacturer' users (QMC) see everything;
// 'dealer' users see only their own dealership; 'customer' is portal-only.
const MFR_PERMS = ['users', 'dealers', 'leads', 'pipeline', 'quotes', 'documents', 'files', 'content', 'chat', 'analytics', 'social']
const DEALER_ADMIN_PERMS = ['users', 'leads', 'pipeline', 'quotes', 'documents', 'files']
const DEALER_SALES_PERMS = ['leads', 'pipeline', 'quotes', 'documents', 'files']
export const ROLES = {
  // Manufacturer (Quality Metal Carports) staff
  mfr_admin: { label: 'QMC Admin', scope: 'manufacturer', desc: 'Full access across every dealership and QMC-direct lead.', perms: MFR_PERMS },
  mfr_staff: { label: 'QMC Team', scope: 'manufacturer', desc: 'Manufacturing & install team — every lead, pipeline & crews.', perms: ['leads', 'pipeline', 'quotes', 'documents', 'files', 'chat'] },
  // Dealership users
  dealer_admin: { label: 'Dealer Admin', scope: 'dealer', desc: 'Runs one dealership — its salespeople and its own leads only.', perms: DEALER_ADMIN_PERMS },
  dealer_sales: { label: 'Salesperson', scope: 'dealer', desc: 'Works their dealership’s leads, quotes and designs.', perms: DEALER_SALES_PERMS },
  customer: { label: 'Customer', scope: 'customer', desc: 'Order/quote status lookup only.', perms: [] },
  // Legacy roles kept so any pre-existing seeded users still resolve (QMC scope).
  admin: { label: 'Admin', scope: 'manufacturer', desc: 'Full access.', perms: MFR_PERMS, legacy: true },
  manager: { label: 'Manager', scope: 'manufacturer', desc: 'Day-to-day operations.', perms: ['leads', 'pipeline', 'quotes', 'documents', 'content', 'chat', 'analytics', 'social'], legacy: true },
  sales: { label: 'Sales', scope: 'manufacturer', desc: 'Works leads & quotes.', perms: ['leads', 'quotes', 'chat'], legacy: true },
  viewer: { label: 'Viewer', scope: 'manufacturer', desc: 'Read-only reports.', perms: ['analytics'], legacy: true },
}
export const roleCan = (role, perm) => !!ROLES[role]?.perms.includes(perm)

const DEFAULT_USERS = [
  { id: 'u-carlos', name: 'Carlos Dominguez', email: 'carlos@qualitymetalcarportsca.com', role: 'mfr_admin', orgId: MFR_ORG_ID, active: true },
  { id: 'u-gabriel', name: 'Gabriel Rios', email: 'gabriel@qualitymetalcarportsca.com', role: 'mfr_admin', orgId: MFR_ORG_ID, active: true },
  { id: 'u-piper', name: 'Piper Vance', email: 'piper@qualitymetalcarportsca.com', role: 'mfr_staff', orgId: MFR_ORG_ID, active: true },
  { id: 'u-gladis', name: 'Gladis Romero', email: 'gladis@qualitymetalcarportsca.com', role: 'mfr_staff', orgId: MFR_ORG_ID, active: true },
]
// Normalize on read so pre-existing localStorage users (no orgId) still resolve
// as manufacturer-scope, and legacy roles keep working.
const normalizeUser = (u) => ({ orgId: MFR_ORG_ID, ...u })
export function getUsers() {
  let u = read(K.users, null)
  if (!u) { u = DEFAULT_USERS; try { localStorage.setItem(K.users, JSON.stringify(u)) } catch { /* demo */ } }
  return u.map(normalizeUser)
}
export const getUser = (id) => getUsers().find((u) => u.id === id) || null
export const getUserName = (id) => getUser(id)?.name || null
export function addUser(u) {
  const arr = read(K.users, null) || DEFAULT_USERS
  const rec = { id: uid(), active: true, role: 'dealer_sales', orgId: MFR_ORG_ID, ...u }
  arr.push(rec); write(K.users, arr); return rec
}
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
  { id: 't-purchase', name: 'Purchase Agreement', type: 'document', subject: 'Purchase Agreement — Quality Metal Carports', body: '<h2>Purchase Agreement</h2><p>This Purchase Agreement is entered into by Quality Metal Carports, Inc. ("QMC") and the Buyer named below. By signing, the Buyer agrees to the terms outlined here.</p><h3>Payment</h3><p>Full payment is due to the installation crew on the day of installation (COD). Credit card payments add a 3.5% processing fee. Deposits are non-refundable after the 72-hour grace period.</p><h3>Permits</h3><p>Obtaining any required permit is the Buyer\'s responsibility. QMC provides all the documentation it can, including engineer-stamped drawings. The Buyer gets the permit application form from the local building department, fills it out, and submits it with QMC\'s paperwork.</p><h3>Site preparation</h3><p>The install site must be level, accessible, and clear of obstructions. Site prep and the foundation are the Buyer\'s responsibility. QMC does not install foundations.</p><h3>Warranties</h3><p>12-gauge frames carry a 20-year rust-through warranty. Certified units include a 5-year limited warranty; non-certified units a 30-day limited warranty. Vertical-roof units with full foam closure qualify for the leak warranty, and proper anchoring qualifies for the 90 MPH wind warranty.</p><h3>Anchoring</h3><p>The structure must be anchored with a manufacturer-certified anchoring system to keep the wind warranty valid.</p>' },
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
  ;['leads', 'quotes', 'designs', 'convos', 'docs', 'social', 'analytics', 'folders', 'files'].forEach((k) => write(K[k], []))
  resetReviews(); resetBlog()
  ;[K.pages, K.users, K.templates, K.orgs, K.session].forEach((k) => localStorage.removeItem(k))
  emit()
}
export function loadSampleData() {
  // QMC-direct customers, each with one or more quotes/orders.
  const marcus = addLead({ firstName: 'Marcus', lastName: 'Hill', email: 'm.hill@example.com', phone: '(559) 555-0142', billingAddress: 'Clovis, CA 93611', structureType: 'Metal Garage', message: '24x30 enclosed garage with a roll-up door in Clovis.', status: 'quoted' })
  const diane = addLead({ firstName: 'Diane', lastName: 'Roberts', email: 'diane.r@example.com', phone: '(661) 555-0199', structureType: 'RV Cover', message: 'Tall cover for a 40ft Class A near Bakersfield.', status: 'contacted' })
  const sal = addLead({ firstName: 'Sal', lastName: 'Romero', email: 'sromero@example.com', phone: '(209) 555-0167', structureType: 'Agricultural Building', message: '60x100 open hay barn outside Merced.', status: 'quoted' })

  // Marcus: an ordered garage (deposit paid → became an order) + a second open quote.
  const mq1 = addQuote({ leadId: marcus.id, assignee: 'u-piper', name: '24×30 Metal Garage', config: '24×30×12ft – A-Frame Vertical', price: 16850, status: 'accepted',
    buildConfig: { width: 24, length: 30, height: 12, roofStyle: 'a_frame_vertical', windSpeed: 105, groundSnow: 30, gauge: 14, installationSurface: 'concrete', roofColor: { name: 'Pewter Gray' }, trimColor: { name: 'Black' }, wallColor: { name: 'Galvalume' }, walls: { front: 'closed', back: 'closed', left: 'closed', right: 'closed' }, doors: [{ type: 'roll_up', sizeLabel: '10×10', wall: 'front' }] } })
  setQuotePipelineStage(mq1.id, 'quoted', true)
  setQuotePipelineStage(mq1.id, 'deposit', 'paid')        // auto-promotes to an order
  setQuotePipelineStage(mq1.id, 'permitting', 'waiting_on_them')
  setQuotePipelineStage(mq1.id, 'manufacturing', 'sent')
  addQuote({ leadId: marcus.id, assignee: 'u-piper', name: '30×40 Shop (alternate)', config: '30×40×12ft – A-Frame Vertical', price: 24500, status: 'sent', buildConfig: { width: 30, length: 40, height: 12, roofStyle: 'a_frame_vertical' } })

  // Diane: one open quote.
  addQuote({ leadId: diane.id, assignee: 'u-gladis', name: 'RV Cover', config: '18×40×14ft – A-Frame Vertical', price: 9400, status: 'sent', buildConfig: { width: 18, length: 40, height: 14, roofStyle: 'a_frame_vertical' } })

  // Sal: a large ag order in production, on hold, with a payment due.
  const sq = addQuote({ leadId: sal.id, assignee: 'u-gabriel', name: '60×100 Hay Barn', config: '60×100×16ft – A-Frame Vertical', price: 48200, status: 'ordered', buildConfig: { width: 60, length: 100, height: 16, roofStyle: 'a_frame_vertical', windSpeed: 105, groundSnow: 30 } })
  setQuotePipelineStage(sq.id, 'quoted', true)
  setQuotePipelineStage(sq.id, 'deposit', 'paid')
  setQuotePipelineStage(sq.id, 'permit_status', 'required')
  setQuotePipelineStage(sq.id, 'engineering_plans', 'site_specific')
  setQuotePipelineStage(sq.id, 'manufacturing', 'on_hold')
  setQuotePipelineStage(sq.id, 'scheduling_fee', 'due')
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
  spread('convos', ['u-piper', 'u-gladis'])
  spread('docs', ['u-gabriel', 'u-piper', 'u-gladis'])

  // ── Dealerships + their users + org-tagged leads (multi-tenant demo) ─────────
  // Added AFTER the spread above so these dealer leads keep their salespersonId
  // and are NOT reassigned to QMC staff.
  const sierra = addOrg({ name: 'Sierra Steel Structures', slug: 'sierra-steel', phone: '(775) 555-0110', brandColor: '#0b6e4f' })
  const desert = addOrg({ name: 'Desert Sun Carports', slug: 'desert-sun', phone: '(702) 555-0144', brandColor: '#d4761a' })
  const rita = addUser({ name: 'Rita Calderon', email: 'rita@sierrasteel.example', role: 'dealer_admin', orgId: sierra.id })
  const owen = addUser({ name: 'Owen Pratt', email: 'owen@sierrasteel.example', role: 'dealer_sales', orgId: sierra.id })
  const bianca = addUser({ name: 'Bianca Flores', email: 'bianca@desertsun.example', role: 'dealer_admin', orgId: desert.id })
  const seth = addUser({ name: 'Seth Wong', email: 'seth@desertsun.example', role: 'dealer_sales', orgId: desert.id })
  // Dealer customers + their quotes (stay scoped to the dealership).
  const wade = addLead({ firstName: 'Wade', lastName: 'Hooper', email: 'wade.h@example.com', phone: '(775) 555-0188', structureType: 'Metal Garage', message: '30×40 enclosed shop in Spanish Springs.', orgId: sierra.id, salespersonId: owen.id, status: 'quoted' })
  addQuote({ leadId: wade.id, orgId: sierra.id, assignee: owen.id, name: '30×40 Enclosed Shop', config: '30×40×12ft – A-Frame Vertical', price: 23800, status: 'sent', buildConfig: { width: 30, length: 40, height: 12, roofStyle: 'a_frame_vertical', walls: { front: 'closed', back: 'closed', left: 'closed', right: 'closed' } } })
  const lena = addLead({ firstName: 'Lena', lastName: 'Ortiz', email: 'lena.o@example.com', phone: '(775) 555-0177', structureType: 'RV Cover', message: 'Tall RV cover near Reno.', orgId: sierra.id, salespersonId: rita.id, status: 'new' })
  addQuote({ leadId: lena.id, orgId: sierra.id, assignee: rita.id, name: 'RV Cover', config: '14×40×14ft – A-Frame Vertical', price: 8200, status: 'draft', buildConfig: { width: 14, length: 40, height: 14, roofStyle: 'a_frame_vertical' } })
  const cole = addLead({ firstName: 'Cole', lastName: 'Jensen', email: 'cole.j@example.com', phone: '(702) 555-0166', structureType: 'Metal Carport', message: 'Double carport in Henderson.', orgId: desert.id, salespersonId: bianca.id, status: 'contacted' })
  addQuote({ leadId: cole.id, orgId: desert.id, assignee: bianca.id, name: 'Double Carport', config: '22×25×10ft – A-Frame Vertical', price: 6400, status: 'sent', buildConfig: { width: 22, length: 25, height: 10, roofStyle: 'a_frame_vertical' } })
  const mara = addLead({ firstName: 'Mara', lastName: 'Singh', email: 'mara.s@example.com', phone: '(702) 555-0155', structureType: 'Agricultural Building', message: '40×60 equipment shelter outside Pahrump.', orgId: desert.id, salespersonId: seth.id, status: 'quoted' })
  const maraQ = addQuote({ leadId: mara.id, orgId: desert.id, assignee: seth.id, name: '40×60 Equipment Shelter', config: '40×60×14ft – A-Frame Vertical', price: 19900, status: 'ordered', buildConfig: { width: 40, length: 60, height: 14, roofStyle: 'a_frame_vertical' } })
  setQuotePipelineStage(maraQ.id, 'quoted', true)
  setQuotePipelineStage(maraQ.id, 'deposit', 'paid')
  setQuotePipelineStage(maraQ.id, 'manufacturing', 'complete')
  setQuotePipelineStage(maraQ.id, 'scheduling', 'scheduled')
  setQuotePipelineStage(maraQ.id, 'install_date', new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10))
  setQuotePipelineStage(maraQ.id, 'final_payment', 'due')
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
