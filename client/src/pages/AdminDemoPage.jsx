import { useEffect, useReducer, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, FileText, Box, Star, Newspaper, Files,
  MessageSquare, BarChart3, PenSquare, Share2, Rocket, Calendar, Map, CheckCircle2,
  ArrowLeft, Trash2, ExternalLink, Eraser, Sparkles, Send, Plus, Check, Pencil, X, Copy,
  Users, Shield, LayoutTemplate, UserPlus, AlertTriangle, PenLine, Printer, Lock,
  Building2, Store, ChevronDown, ChevronRight,
  Folder, FolderPlus, Upload, GripVertical, Image as ImageIcon, Link2,
} from 'lucide-react'
import {
  getLeads, getQuotes, getDesigns,
  getConversations, addMessage, markConversationRead,
  getDocuments, getDocument, addDocument, updateDocument, sendDocument, signDocumentBy,
  getSocialPosts, addSocialPost,
  getAnalytics,
  getSiteReviews, getReviewSummary, saveReview, deleteReview,
  getSiteBlog, saveBlogPost, deleteBlogPost,
  getAllPages, getGeneratedPages, getPageFields, savePageFields,
  getCustomPage, saveCustomPage, duplicatePage, createPage, deleteCustomPage,
  getUsers, getUserName, addUser, updateUser, removeUser, assignedCount, assign,
  ROLES, PERMISSIONS, roleCan,
  getTemplates, getTemplate, saveTemplate, removeTemplate,
  setStatus, removeRecord, loadSampleData, clearDemoData,
  effectiveUser, currentOrg, scopeRecords, scopedUsers, roleScope,
  getOrgs, getOrgName, setSession, MFR_ORG_ID,
  getDealerOrgs, getOrg, addOrg, updateOrg, removeOrg,
  getLead, leadName,
  getQuote, getLeadQuotes, addQuote, updateQuote, promoteToOrder, setQuotePipelineStage,
  getFolders, addFolder, renameFolder, removeFolder, reorderFolders,
  getFiles, addFile, removeFile, moveFile, reorderFiles, getLeadFiles, tagFileLead,
} from '../data/adminData'
import {
  STAGES, STAGE_GROUPS, TRACKS, trackProgress, overallProgress, enumLabel,
} from '../data/pipeline'
import { encodeConfig } from '../data/builderLink'
import { INTEGRATIONS, BRAND } from '../data/integrations'
import ContentEditor from '../components/admin/ContentEditor'

const ICONS = { Inbox, MessageSquare, BarChart3, PenSquare, Share2, Calendar, Newspaper, Map }

// Nav — each maps to one of the self-hosted services, all demoed locally.
// `perm` gates a tab to roles that hold it; `mfrOnly` restricts to QMC (manufacturer)
// users. Dealer users see only their scoped subset (leads/quotes/designs/docs/team).
const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'setup', label: 'Setup', svc: 'Get started', icon: Rocket, mfrOnly: true },
  { id: 'dealers', label: 'Dealerships', svc: 'Tenants', icon: Building2, perm: 'dealers' },
  { id: 'leads', label: 'Leads', svc: 'Twenty CRM', icon: Inbox, perm: 'leads' },
  { id: 'quotes', label: 'Quotes', svc: 'Twenty CRM', icon: FileText, perm: 'quotes' },
  { id: 'designs', label: 'Designs', svc: '3D Builder', icon: Box, perm: 'leads' },
  { id: 'inbox', label: 'Inbox', svc: 'Chatwoot', icon: MessageSquare, perm: 'chat' },
  { id: 'analytics', label: 'Analytics', svc: 'Plausible', icon: BarChart3, perm: 'analytics' },
  { id: 'documents', label: 'Documents', svc: 'Documenso', icon: PenSquare, perm: 'documents' },
  { id: 'files', label: 'Files', svc: 'Folders', icon: Folder, perm: 'files' },
  { id: 'templates', label: 'Templates', svc: 'Quotes & docs', icon: LayoutTemplate, mfrOnly: true },
  { id: 'social', label: 'Social', svc: 'Postiz', icon: Share2, mfrOnly: true },
  { id: 'reviews', label: 'Reviews', svc: 'Editable', icon: Star, mfrOnly: true },
  { id: 'blog', label: 'Blog', svc: 'Ghost / CMS', icon: Newspaper, mfrOnly: true },
  { id: 'pages', label: 'Pages', icon: Files, mfrOnly: true },
  { id: 'team', label: 'Team', svc: 'Users & roles', icon: Users, perm: 'users' },
  { id: 'embed', label: 'Builder & Embed', svc: 'White-label', icon: Box, dealerOnly: true },
]
// Which NAV tabs a given user may see.
function visibleNavFor(user) {
  const scope = roleScope(user?.role)
  return NAV.filter((n) => {
    if (n.mfrOnly) return scope === 'manufacturer'
    if (n.dealerOnly) return scope === 'dealer'
    if (n.perm) return roleCan(user?.role, n.perm)
    return true
  })
}

const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost']
const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'ordered', 'declined']
const STATUS_COLOR = {
  new: 'bg-blue-500/15 text-blue-300', contacted: 'bg-amber-500/15 text-amber-300',
  quoted: 'bg-violet-500/15 text-violet-300', won: 'bg-emerald-500/15 text-emerald-300',
  lost: 'bg-slate-500/15 text-slate-400', open: 'bg-blue-500/15 text-blue-300',
  sent: 'bg-amber-500/15 text-amber-300', accepted: 'bg-emerald-500/15 text-emerald-300',
  declined: 'bg-slate-500/15 text-slate-400', draft: 'bg-slate-500/15 text-slate-400',
  ordered: 'bg-emerald-500/15 text-emerald-300',
  signed: 'bg-emerald-500/15 text-emerald-300', scheduled: 'bg-blue-500/15 text-blue-300',
  posted: 'bg-emerald-500/15 text-emerald-300',
}
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' } }
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) } catch { return '' } }

function useAdmin() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    const h = () => force()
    window.addEventListener('qmc-admin-change', h)
    window.addEventListener('storage', h)
    return () => { window.removeEventListener('qmc-admin-change', h); window.removeEventListener('storage', h) }
  }, [])
  return force
}

const Card = ({ children, className = '' }) => <div className={`rounded-xl border border-white/8 bg-white/[0.03] ${className}`}>{children}</div>
const Badge = ({ value }) => <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_COLOR[value] || 'bg-slate-500/15 text-slate-400'}`}>{value}</span>
function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 py-14 text-center">
      <Icon size={26} className="mx-auto text-slate-600 mb-3" />
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">{hint}</p>
    </div>
  )
}
function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <Icon size={16} className="text-brand" />
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}
const Field = ({ label, ...p }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
    <input {...p} className="w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none" />
  </label>
)
const ROLE_COLOR = { admin: 'bg-rose-500/15 text-rose-300', manager: 'bg-violet-500/15 text-violet-300', sales: 'bg-blue-500/15 text-blue-300', viewer: 'bg-slate-500/15 text-slate-400' }
const initials = (name = '') => name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
function Avatar({ id, size = 24 }) {
  const name = getUserName(id)
  if (!name) return <span className="inline-flex items-center justify-center rounded-full bg-white/8 text-slate-500" style={{ width: size, height: size, fontSize: size * 0.42 }}>?</span>
  return <span title={name} className="inline-flex items-center justify-center rounded-full bg-brand/25 font-semibold text-brand-light" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials(name)}</span>
}
// Assign/reassign a record to a team member. Reusable across every module.
function AssigneeSelect({ kind, id, value }) {
  const users = scopedUsers(effectiveUser())
  return (
    <select value={value || ''} onChange={(e) => assign(kind, id, e.target.value || null)} title="Assigned to"
      className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none max-w-[8.5rem]">
      <option value="">Unassigned</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  )
}

// Header identity + simulated account/role switcher (demo stand-in for real auth).
function IdentityBar() {
  const me = effectiveUser()
  const org = currentOrg()
  const orgs = getOrgs()
  const users = getUsers()
  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex flex-col items-end leading-tight">
        <span className="text-xs font-semibold text-white">{me?.name || 'No user'}</span>
        <span className="text-[10px] text-slate-400">{ROLES[me?.role]?.label || me?.role} · {org?.name}</span>
      </div>
      <select value={me?.id || ''} onChange={(e) => setSession(e.target.value)} title="Switch account (demo)"
        className="rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-brand focus:outline-none max-w-[10rem]">
        {orgs.map((o) => {
          const members = users.filter((u) => (u.orgId || MFR_ORG_ID) === o.id)
          if (members.length === 0) return null
          return (
            <optgroup key={o.id} label={o.name}>
              {members.map((u) => <option key={u.id} value={u.id}>{u.name} — {ROLES[u.role]?.label || u.role}</option>)}
            </optgroup>
          )
        })}
      </select>
    </div>
  )
}

export default function AdminDemoPage() {
  const [tab, setTab] = useState('overview')
  useAdmin()

  const me = effectiveUser()
  const nav = visibleNavFor(me)
  // If the active tab isn't allowed for this user, fall back to Overview.
  const activeTab = nav.find((n) => n.id === tab) ? tab : 'overview'

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-slate-200">
      <header className="flex items-center justify-between gap-3 border-b border-white/8 bg-slate-900 px-3 sm:px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white shrink-0">
            <ArrowLeft size={15} /> <span className="hidden sm:inline">Back to site</span>
          </Link>
          <div className="hidden sm:block h-5 w-px bg-white/10" />
          <span className="font-display font-bold text-white truncate">{BRAND} Admin</span>
          <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-light">Demo</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <IdentityBar />
          {roleScope(me?.role) === 'manufacturer' && (
            <>
              <button onClick={loadSampleData} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"><Sparkles size={13} /> <span className="hidden lg:inline">Load sample data</span></button>
              <button onClick={clearDemoData} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10"><Eraser size={13} /> <span className="hidden lg:inline">Clear</span></button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="hidden sm:flex w-56 shrink-0 flex-col gap-0.5 border-r border-white/8 bg-slate-950 p-3 overflow-y-auto">
          {nav.map(({ id, label, svc, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeTab === id ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/6 hover:text-white'}`}>
              <Icon size={15} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {svc && <span className={`text-[9px] uppercase tracking-wide ${activeTab === id ? 'text-white/70' : 'text-slate-600'}`}>{svc}</span>}
            </button>
          ))}
        </nav>

        <div className="sm:hidden absolute bottom-0 inset-x-0 z-10 flex overflow-x-auto border-t border-white/8 bg-slate-900 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-0.5 px-4 py-2 text-[10px] font-medium shrink-0 ${activeTab === id ? 'text-brand' : 'text-slate-500'}`}><Icon size={16} /> {label}</button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-6">
          {activeTab === 'overview' && <Overview setTab={setTab} />}
          {activeTab === 'setup' && <Setup />}
          {activeTab === 'dealers' && <Dealerships />}
          {activeTab === 'leads' && <Leads />}
          {activeTab === 'quotes' && <Quotes />}
          {activeTab === 'designs' && <Designs />}
          {activeTab === 'inbox' && <InboxView />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'documents' && <Documents />}
          {activeTab === 'files' && <FilesView />}
          {activeTab === 'templates' && <Templates />}
          {activeTab === 'social' && <Social />}
          {activeTab === 'reviews' && <Reviews />}
          {activeTab === 'blog' && <Blog />}
          {activeTab === 'pages' && <Pages />}
          {activeTab === 'team' && <Team />}
          {activeTab === 'embed' && <EmbedView />}
        </main>
      </div>
    </div>
  )
}

// Small flag shown to QMC when a lead belongs to a dealership ("in their hands").
function OrgFlag({ orgId }) {
  if (!orgId || orgId === MFR_ORG_ID) return null
  return <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300" title="In the hands of this dealership">↳ {getOrgName(orgId)}</span>
}

function Overview({ setTab }) {
  const me = effectiveUser()
  const leads = scopeRecords(me, getLeads()), quotes = scopeRecords(me, getQuotes()), designs = scopeRecords(me, getDesigns())
  const convos = getConversations(), sum = getReviewSummary(), blog = getSiteBlog(), a = getAnalytics()
  const cards = [
    { id: 'leads', icon: Inbox, label: 'Leads', value: leads.length, sub: 'Twenty CRM' },
    { id: 'quotes', icon: FileText, label: 'Quotes', value: quotes.length, sub: 'open & sent' },
    { id: 'inbox', icon: MessageSquare, label: 'Conversations', value: convos.length, sub: 'Chatwoot' },
    { id: 'analytics', icon: BarChart3, label: 'Page views', value: a.total.toLocaleString(), sub: `${a.visitors} visitors` },
    { id: 'reviews', icon: Star, label: 'Reviews', value: sum.total, sub: `${sum.rating.toFixed(1)}★ avg` },
    { id: 'blog', icon: Newspaper, label: 'Blog posts', value: blog.length, sub: 'published' },
  ]
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => <button key={c.id} onClick={() => setTab(c.id)} className="text-left"><StatCard {...c} /></button>)}
      </div>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Recent leads</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-slate-500">No leads yet. Submit the <Link to="/contact" className="text-brand hover:underline">contact form</Link> or click “Load sample data”.</p>
        ) : leads.slice(0, 5).map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 px-4 py-2.5 mb-2">
            <div className="min-w-0"><div className="text-sm font-medium text-white truncate">{l.firstName} {l.lastName} <span className="text-slate-500 font-normal">· {l.structureType || 'General'}</span></div><div className="text-xs text-slate-500 truncate">{l.email}</div></div>
            <div className="flex items-center gap-3 shrink-0"><Badge value={l.status} /><span className="text-xs text-slate-500">{fmtDate(l.createdAt)}</span></div>
          </div>
        ))}
      </Card>
    </div>
  )
}

function Setup() {
  const live = INTEGRATIONS.filter((m) => m.mode() === 'live').length
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Get started</h1>
        <p className="mt-1 text-sm text-slate-400">
          Everything below already <span className="text-white font-medium">works in demo mode</span> — captured locally, no setup needed.
          Connect each service when you’re ready to go live. {live} of {INTEGRATIONS.length} modules are connected.
        </p>
      </div>

      <Card className="p-4 flex items-start gap-3 border-brand/30 bg-brand/5">
        <Rocket size={18} className="text-brand mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <span className="font-semibold text-white">Two ways to run this.</span> Keep it self-contained (everything runs in the browser, great for a demo or a small site),
          or stand up the self-hosted stack in <code className="text-brand-light">docker-compose.yml</code> and flip the env keys below to go fully live.
        </div>
      </Card>

      <div className="space-y-4">
        {INTEGRATIONS.map((m) => {
          const Icon = ICONS[m.icon] || Files
          const isLive = m.mode() === 'live'
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/6 text-brand"><Icon size={17} /></span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{m.name}</span>
                      <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">{m.service}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-400">{m.summary}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 ${isLive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {isLive ? <><CheckCircle2 size={12} /> Live</> : 'Demo'}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-500"><span className="font-semibold text-slate-400">In the demo:</span> {m.demo}</p>

              {!isLive && (
                <div className="mt-3 rounded-lg border border-white/8 bg-black/20 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">To go live</div>
                  <ol className="space-y-1.5">
                    {m.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[11px] font-bold text-slate-400">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  {(m.keys.length > 0 || m.link) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {m.keys.map((k) => <code key={k} className="rounded bg-white/8 px-1.5 py-0.5 text-[11px] text-brand-light">{k}</code>)}
                      {m.where !== '—' && <span className="text-[11px] text-slate-600">in {m.where}</span>}
                      {m.link && <a href={m.link} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Docs <ExternalLink size={11} /></a>}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// A labeled track progress bar (dealer or QMC).
function ProgressBar({ record, track }) {
  const t = TRACKS[track]
  const { pct, done, total, current } = trackProgress(record, track)
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-semibold text-slate-300">{t.label}</span>
        <span className="text-slate-500">{done}/{total} · {pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/8 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: t.color }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500">Next: <span className="text-slate-300">{current}</span></div>
    </div>
  )
}
// Thin overall bar for list rows.
function MiniProgress({ record }) {
  const { pct } = overallProgress(record)
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="h-1.5 flex-1 rounded-full bg-white/8 overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
      <span className="text-[10px] text-slate-500 w-7 text-right">{pct}%</span>
    </div>
  )
}
// One editable pipeline stage (bool / enum / date / text). `onSet(key,value)` writes.
function StageControl({ record, stage, disabled, onSet }) {
  const v = record.pipeline?.[stage.key]
  const set = (val) => onSet(stage.key, val)
  if (stage.type === 'bool') {
    return (
      <button disabled={disabled} onClick={() => set(!v)}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${v ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/[0.02] text-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/25'}`}>
        <span className={`flex h-4 w-4 items-center justify-center rounded border ${v ? 'border-emerald-400 bg-emerald-400 text-slate-900' : 'border-white/25'}`}>{v && <Check size={11} />}</span>
        {stage.label}
      </button>
    )
  }
  return (
    <label className="block rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{stage.label}</span>
      {stage.type === 'enum' && (
        <select disabled={disabled} value={v || stage.options[0].v} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-sm text-white disabled:opacity-50">
          {stage.options.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
      )}
      {stage.type === 'date' && <input type="date" disabled={disabled} value={v || ''} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-sm text-white disabled:opacity-50" />}
      {stage.type === 'text' && <input type="text" disabled={disabled} value={v || ''} placeholder={stage.placeholder} onChange={(e) => set(e.target.value)} className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-sm text-white disabled:opacity-50" />}
    </label>
  )
}
// "N quotes · M orders" summary for a lead row.
function LeadQuoteCount({ leadId }) {
  const qs = getLeadQuotes(leadId)
  const orders = qs.filter((q) => q.isOrder).length
  const quotes = qs.length - orders
  if (qs.length === 0) return <span className="text-slate-600">No quotes yet</span>
  return <span>{quotes} quote{quotes !== 1 ? 's' : ''}{orders ? ` · ${orders} order${orders !== 1 ? 's' : ''}` : ''}</span>
}

// A small quote/order number chip.
function QuoteRef({ quote }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${quote.isOrder ? 'bg-emerald-500/15 text-emerald-300' : 'bg-brand/15 text-brand-light'}`}>{quote.isOrder ? 'Order' : 'Quote'}</span>
      <span className="text-xs text-slate-400">{quote.isOrder ? quote.orderNumber : quote.quoteNumber}</span>
    </span>
  )
}

// One quote/order under a lead: dual progress bars + every pipeline stage, grouped.
function QuoteDetail({ quote, lead, onBack }) {
  const me = effectiveUser()
  const mfr = roleScope(me?.role) === 'manufacturer'
  const canEdit = (track) => mfr || track === 'dealer'
  const onSet = (key, value) => setQuotePipelineStage(quote.id, key, value)
  const [linkCopied, setLinkCopied] = useState(false)
  const num = quote.orderNumber || quote.quoteNumber
  const copyTracking = () => {
    try { navigator.clipboard?.writeText(`${window.location.origin}/status?n=${encodeURIComponent(num)}`) } catch { /* */ }
    setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1600)
  }
  return (
    <div className="space-y-5 max-w-3xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> {leadName(lead)}</button>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap"><h1 className="font-display text-2xl font-bold text-white">{quote.name || 'Quote'}</h1><Badge value={quote.status} /><OrgFlag orgId={quote.orgId} /></div>
            <div className="mt-1 text-xs text-slate-500">Quote {quote.quoteNumber}{quote.orderNumber ? ` · Order ${quote.orderNumber}` : ''}</div>
            {quote.config && <p className="mt-1 text-xs text-brand-light">{quote.config}{quote.price ? ` · $${Number(quote.price).toLocaleString()}` : ''}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link to={`/quote/${quote.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded bg-brand px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"><FileText size={13} /> Quote / contract</Link>
            <Link to={`/packing/${quote.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"><Files size={13} /> Packing list</Link>
            <button onClick={copyTracking} title="Copy a customer tracking link (no personal details shown)" className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10">{linkCopied ? <Check size={13} className="text-emerald-400" /> : <Link2 size={13} />} {linkCopied ? 'Copied' : 'Tracking link'}</button>
            {!quote.orderNumber && <button onClick={() => promoteToOrder(quote.id)} title="Sign + deposit accepted → make this an order" className="rounded border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10">Convert to order</button>}
            <select value={quote.status} onChange={(e) => setStatus('quotes', quote.id, e.target.value)} className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200">{QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <AssigneeSelect kind="quotes" id={quote.id} value={quote.assignee} />
          </div>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          <ProgressBar record={quote} track="dealer" />
          <ProgressBar record={quote} track="mfr" />
        </div>
      </Card>

      {STAGE_GROUPS.map((g) => {
        const stages = STAGES.filter((s) => s.group === g.id)
        const disabled = !canEdit(g.track)
        return (
          <Card key={g.id} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full" style={{ background: TRACKS[g.track].color }} />
              <h2 className="text-sm font-semibold text-white">{g.label}</h2>
              <span className="text-[10px] uppercase tracking-wide text-slate-600">{g.track === 'mfr' ? 'QMC' : 'Dealer'}{disabled ? ' · read-only' : ''}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {stages.map((s) => <StageControl key={s.key} record={quote} stage={s} disabled={disabled} onSet={onSet} />)}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// Lead = the customer/opportunity: contact + its quotes & orders (each opens its
// own pipeline) + shared photos/files.
function LeadDetail({ lead, onBack }) {
  const quotes = getLeadQuotes(lead.id)
  const [openQuoteId, setOpenQuoteId] = useState(null)
  const openQuote = openQuoteId ? getQuote(openQuoteId) : null
  if (openQuote) return <QuoteDetail quote={openQuote} lead={lead} onBack={() => setOpenQuoteId(null)} />

  const newQuote = () => {
    const q = addQuote({ leadId: lead.id, orgId: lead.orgId, salespersonId: lead.assignee || lead.salespersonId, assignee: lead.assignee, name: lead.structureType || 'New quote' })
    setOpenQuoteId(q.id)
  }
  return (
    <div className="space-y-5 max-w-3xl">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> All leads</button>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap"><h1 className="font-display text-2xl font-bold text-white">{leadName(lead)}</h1><Badge value={lead.status} /><OrgFlag orgId={lead.orgId} /></div>
            <div className="mt-1 text-sm text-slate-400">{lead.email}{lead.phone ? ` · ${lead.phone}` : ''}{lead.structureType ? ` · ${lead.structureType}` : ''}</div>
            {(lead.billingAddress || lead.address) && <div className="mt-1 text-xs text-slate-500">{lead.shippingAddress || lead.billingAddress || lead.address}</div>}
          </div>
          <div className="flex items-center gap-2">
            <select value={lead.status} onChange={(e) => setStatus('leads', lead.id, e.target.value)} className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200">{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <AssigneeSelect kind="leads" id={lead.id} value={lead.assignee} />
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Quotes &amp; orders <span className="text-slate-500">({quotes.length})</span></h2>
          <div className="flex items-center gap-2">
            <Link to={`/builder?lead=${lead.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"><Box size={13} /> Build a quote</Link>
            <button onClick={newQuote} className="flex items-center gap-1.5 rounded bg-brand px-2.5 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> New quote</button>
          </div>
        </div>
        {quotes.length === 0 ? <p className="text-xs text-slate-600">No quotes yet. “Build a quote” opens the 3D builder tied to this customer, or add a blank one.</p> : (
          <div className="divide-y divide-white/6 rounded-lg border border-white/8">
            {quotes.map((q) => (
              <button key={q.id} onClick={() => setOpenQuoteId(q.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><QuoteRef quote={q} /><span className="text-sm font-medium text-white truncate">{q.name || 'Quote'}</span><Badge value={q.status} /></div>
                  <div className="mt-1 text-xs text-slate-500">{q.config || '—'}{q.price ? ` · $${Number(q.price).toLocaleString()}` : ''}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0"><MiniProgress record={q} /><ChevronRight size={15} className="text-slate-500" /></div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <LeadFiles lead={lead} />
    </div>
  )
}

// Photos & documents attached to a single lead (level-site / installer photos).
function LeadFiles({ lead }) {
  const files = getLeadFiles(lead.id)
  const input = useRef(null)
  const upload = (list) => Array.from(list || []).forEach((f) => {
    if (f.type.startsWith('image/')) readImageFile(f, (url) => addFile({ orgId: lead.orgId, leadId: lead.id, name: f.name, kind: 'image', dataUrl: url }))
    else addFile({ orgId: lead.orgId, leadId: lead.id, name: f.name, kind: 'file' })
  })
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">Photos &amp; files <span className="text-slate-500">({files.length})</span></h2>
        <button onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"><Upload size={13} /> Upload</button>
        <input ref={input} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
      </div>
      {files.length === 0 ? <p className="text-xs text-slate-600">Level-site photos, installer photos, and documents attached to this lead show here.</p> : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {files.map((f) => (
            <div key={f.id} className="relative overflow-hidden rounded-lg border border-white/10 bg-black/30">
              {f.kind === 'image' && f.dataUrl ? <img src={f.dataUrl} alt={f.name} className="h-20 w-full object-cover" /> : <div className="flex h-20 items-center justify-center"><Files size={20} className="text-slate-500" /></div>}
              <button onClick={() => removeFile(f.id)} className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-slate-300 hover:text-red-400"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function Leads() {
  const me = effectiveUser()
  const leads = scopeRecords(me, getLeads())
  const [openId, setOpenId] = useState(null)
  const open = openId ? getLead(openId) : null
  if (open && scopeRecords(me, [open]).length) return <LeadDetail lead={open} onBack={() => setOpenId(null)} />
  const counts = LEAD_STATUSES.map((s) => ({ s, n: leads.filter((l) => l.status === s).length }))
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Leads <span className="text-slate-500 text-lg">({leads.length})</span></h1>
      <div className="flex flex-wrap gap-2">{counts.map(({ s, n }) => <div key={s} className="rounded-lg border border-white/8 px-3 py-1.5 text-xs"><Badge value={s} /> <span className="ml-1 text-slate-300 font-semibold">{n}</span></div>)}</div>
      {leads.length === 0 ? <Empty icon={Inbox} title="No leads yet" hint="Every contact-form submission lands here automatically. Try the form or “Load sample data”." /> : (
        <Card className="overflow-hidden"><div className="divide-y divide-white/6">
          {leads.map((l) => (
            <div key={l.id} className="grid sm:grid-cols-[1fr_auto] gap-3 p-4">
              <button onClick={() => setOpenId(l.id)} className="min-w-0 text-left group">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-white group-hover:text-brand-light">{leadName(l)}</span>{l.structureType && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[11px] text-slate-300">{l.structureType}</span>}<OrgFlag orgId={l.orgId} /></div>
                <div className="mt-0.5 text-xs text-slate-400">{l.email}{l.phone ? ` · ${l.phone}` : ''}</div>
                {l.message && <p className="mt-1.5 text-sm text-slate-400 line-clamp-2">{l.message}</p>}
                <div className="mt-2 text-xs text-slate-500"><LeadQuoteCount leadId={l.id} /></div>
              </button>
              <div className="flex sm:flex-col items-end gap-2 shrink-0">
                <span className="text-xs text-slate-500">{fmtDate(l.createdAt)}</span>
                <select value={l.status} onChange={(e) => setStatus('leads', l.id, e.target.value)} className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none">{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <AssigneeSelect kind="leads" id={l.id} value={l.assignee} />
                <button onClick={() => removeRecord('leads', l.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div></Card>
      )}
    </div>
  )
}

function Quotes() {
  const quotes = scopeRecords(effectiveUser(), getQuotes())
  const orders = quotes.filter((q) => q.isOrder).length
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Quotes &amp; orders <span className="text-slate-500 text-lg">({quotes.length})</span></h1>
      <p className="text-xs text-slate-500">{quotes.length - orders} open quote{quotes.length - orders !== 1 ? 's' : ''} · {orders} order{orders !== 1 ? 's' : ''}. A quote becomes an order once the agreement is signed and the deposit is placed.</p>
      {quotes.length === 0 ? <Empty icon={FileText} title="No quotes yet" hint="Build one from a lead (“Build a quote”) or when a dealer sends a design from the 3D builder." /> : (
        <Card className="overflow-hidden"><div className="divide-y divide-white/6">
          {quotes.map((q) => {
            const lead = getLead(q.leadId)
            return (
              <div key={q.id} className="grid sm:grid-cols-[1fr_auto] items-center gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><QuoteRef quote={q} /><span className="font-semibold text-white truncate">{q.name || 'Quote'}</span><Badge value={q.status} /><OrgFlag orgId={q.orgId} /></div>
                  <div className="mt-0.5 text-sm text-slate-400 truncate">{lead ? leadName(lead) : 'Unknown customer'}{q.config ? ` · ${q.config}` : ''}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {q.price != null && <span className="font-display text-base font-bold text-white">${Number(q.price).toLocaleString()}</span>}
                  <MiniProgress record={q} />
                  <Link to={`/quote/${q.id}`} target="_blank" rel="noopener noreferrer" title="Open quote / contract" className="text-brand hover:text-brand-light"><FileText size={15} /></Link>
                  <select value={q.status} onChange={(e) => setStatus('quotes', q.id, e.target.value)} className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none">{QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                  <button onClick={() => removeRecord('quotes', q.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div></Card>
      )}
    </div>
  )
}

function Designs() {
  const designs = scopeRecords(effectiveUser(), getDesigns())
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Customer designs <span className="text-slate-500 text-lg">({designs.length})</span></h1>
      {designs.length === 0 ? <Empty icon={Box} title="No saved designs yet" hint="Configurations from the 3D builder are saved here when a visitor requests a quote." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {designs.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{fmtDate(s.createdAt)}</span><div className="flex items-center gap-2"><OrgFlag orgId={s.orgId} /><button onClick={() => removeRecord('designs', s.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button></div></div>
              <div className="mt-2 font-display text-lg font-bold text-white">{s.width}×{s.length}×{s.height}ft</div>
              <div className="text-sm text-slate-400">{s.roofStyle || s.config}</div>
              {s.price != null && <div className="mt-3 font-display text-xl font-bold text-brand-light">${Number(s.price).toLocaleString()}</div>}
              <div className="mt-3 flex items-center justify-between gap-2">
                <Link to={s.buildConfig ? `/builder?design=${s.id}&d=${encodeConfig(s.buildConfig)}` : `/builder?design=${s.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Edit in builder <ExternalLink size={11} /></Link>
                <AssigneeSelect kind="designs" id={s.id} value={s.assignee} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function InboxView() {
  const convos = getConversations()
  const [sel, setSel] = useState(convos[0]?.id || null)
  const [text, setText] = useState('')
  const active = convos.find((c) => c.id === sel) || convos[0]
  useEffect(() => { if (active && active.unread) markConversationRead(active.id) }, [sel]) // eslint-disable-line
  if (convos.length === 0) return <div className="max-w-5xl"><h1 className="font-display text-2xl font-bold text-white mb-4">Inbox</h1><Empty icon={MessageSquare} title="No conversations" hint="Live chats from the Chatwoot widget appear here. Click “Load sample data” to preview." /></div>
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white mb-4">Inbox <span className="text-slate-500 text-lg">({convos.length})</span></h1>
      <div className="grid md:grid-cols-[260px_1fr] gap-4">
        <Card className="overflow-hidden self-start"><div className="divide-y divide-white/6">
          {convos.map((c) => (
            <button key={c.id} onClick={() => setSel(c.id)} className={`w-full text-left px-4 py-3 ${active?.id === c.id ? 'bg-white/6' : 'hover:bg-white/3'}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-medium text-white">{c.name}</span>{c.unread > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}</div>
              <div className="text-xs text-slate-500 truncate">{c.channel} · {c.messages?.[c.messages.length - 1]?.text || '—'}</div>
            </button>
          ))}
        </div></Card>
        <Card className="flex flex-col h-[60vh]">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div><div className="font-semibold text-white">{active?.name}</div><div className="text-xs text-slate-500">{active?.channel}</div></div>
            {active && <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><span className="hidden sm:inline">Assigned</span><AssigneeSelect kind="convos" id={active.id} value={active.assignee} /></div>}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(active?.messages || []).map((m, i) => (
              <div key={i} className={`flex ${m.from === 'agent' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.from === 'agent' ? 'bg-brand text-white' : 'bg-white/8 text-slate-200'}`}>{m.text}</div></div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { addMessage(active.id, text.trim(), 'agent'); setText('') } }} className="flex items-center gap-2 border-t border-white/8 p-3">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply…" className="flex-1 rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none" />
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white"><Send size={15} /></button>
          </form>
        </Card>
      </div>
    </div>
  )
}

function Analytics() {
  const a = getAnalytics()
  const max = Math.max(1, ...a.days.map((d) => d.views))
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">Analytics <span className="text-slate-500 text-sm">· Plausible-style, cookieless</span></h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard icon={BarChart3} label="Page views" value={a.total.toLocaleString()} sub="all time (this browser)" />
        <StatCard icon={Inbox} label="Visitors" value={a.visitors.toLocaleString()} sub="unique sessions" />
        <StatCard icon={Files} label="Pages tracked" value={a.topPages.length} sub="distinct paths" />
      </div>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Last 14 days</h2>
        {a.total === 0 ? <p className="text-sm text-slate-500">Browse the site (or “Load sample data”) — page views are tracked here automatically.</p> : (
          <>
            <div className="flex items-end gap-1.5 h-40">
              {a.days.map((d) => (
                <div key={d.key} className="flex-1 rounded-t bg-brand/70 hover:bg-brand transition-colors" style={{ height: `${Math.max((d.views / max) * 100, d.views ? 2 : 0)}%` }} title={`${d.label}: ${d.views} views`} />
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
              {a.days.map((d) => <span key={d.key} className="flex-1 text-center text-[9px] text-slate-600">{d.label}</span>)}
            </div>
          </>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Top pages</h2>
        {a.topPages.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : a.topPages.map((p) => (
          <div key={p.path} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"><span className="text-sm text-slate-300 truncate">{p.path}</span><span className="text-sm font-semibold text-white">{p.views.toLocaleString()}</span></div>
        ))}
      </Card>
    </div>
  )
}

function Documents() {
  const docs = getDocuments()
  const templates = getTemplates(); const users = getUsers()
  const [form, setForm] = useState({ title: '', recipient: '', amount: '', template: '', assignee: '' })
  const [openId, setOpenId] = useState(null)
  const selCls = 'w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-brand focus:outline-none'
  const create = (e) => {
    e.preventDefault()
    if (!form.title) return
    const tmpl = form.template ? getTemplate(form.template) : null
    addDocument({
      title: form.title, recipient: form.recipient,
      amount: form.amount ? Number(form.amount) : null,
      status: 'draft', templateId: form.template || null, assignee: form.assignee || null,
      body: { html: tmpl?.body || '' },
    })
    const created = getDocuments()[0]
    setForm({ title: '', recipient: '', amount: '', template: '', assignee: '' })
    if (created) setOpenId(created.id) // jump straight into building it out
  }
  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">Documents <span className="text-slate-500 text-sm">· Documenso e-sign</span></h1>
      <p className="text-xs text-slate-500">Create a document from a template, click it to build out the content and add signers, then send it for signature.</p>
      <Card className="p-4 space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Start from template</span>
            <select value={form.template} onChange={(e) => { const t = getTemplate(e.target.value); setForm({ ...form, template: e.target.value, title: t ? `${t.name} — ` : form.title }) }} className={selCls}>
              <option value="">Blank document</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.type}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Assign to</span>
            <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className={selCls}>
              <option value="">Unassigned</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        </div>
        <form onSubmit={create} className="grid sm:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
          <Field label="Document" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Quote #1043 — …" />
          <Field label="Recipient email" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="customer@example.com" />
          <Field label="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          <button className="flex items-center justify-center gap-1.5 rounded bg-brand px-3 py-2 text-sm font-semibold text-white"><Plus size={14} /> Create &amp; build</button>
        </form>
      </Card>
      {docs.length === 0 ? <Empty icon={PenSquare} title="No documents yet" hint="Create a quote or agreement above, build it out, send it for signature, and track its status." /> : (
        <Card className="overflow-hidden"><div className="divide-y divide-white/6">
          {docs.map((d) => {
            const signed = (d.signers || []).filter((s) => s.signed).length
            return (
              <div key={d.id} className="flex items-center justify-between gap-3 p-4 hover:bg-white/[0.02]">
                <button onClick={() => setOpenId(d.id)} className="min-w-0 flex-1 text-left">
                  <div className="font-medium text-white truncate">{d.title}</div>
                  <div className="text-xs text-slate-500">
                    {d.recipientName || d.recipient || 'no recipient'}{d.amount ? ` · $${Number(d.amount).toLocaleString()}` : ''} · {fmtDate(d.createdAt)}
                    {d.signers?.length ? ` · ${signed}/${d.signers.length} signed` : ''}
                  </div>
                </button>
                <div className="flex items-center gap-2.5 shrink-0">
                  <Badge value={d.status} />
                  <AssigneeSelect kind="docs" id={d.id} value={d.assignee} />
                  <button onClick={() => setOpenId(d.id)} className="flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">
                    {d.status === 'draft' ? <><Pencil size={12} /> Build</> : d.status === 'sent' ? <><PenLine size={12} /> Sign</> : <><FileText size={12} /> View</>}
                  </button>
                  <button onClick={() => removeRecord('docs', d.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div></Card>
      )}
      {openId && <DocumentEditor docId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}

const sigUid = () => globalThis.crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

// Open a single document to build out its content, configure signers, send it for
// signature, and capture typed signatures — with a live, printable preview.
function DocumentEditor({ docId, onClose }) {
  const doc = getDocument(docId)
  const [draft, setDraft] = useState(() => ({
    title: doc?.title || '',
    recipientName: doc?.recipientName || '',
    recipient: doc?.recipient || '',
    amount: doc?.amount ?? '',
    body: doc?.body || { html: '' },
    signers: (doc?.signers?.length ? doc.signers : [
      { id: sigUid(), role: 'Customer', name: doc?.recipientName || '', email: doc?.recipient || '', signed: false },
      { id: sigUid(), role: 'Quality Metal Carports', name: 'Quality Metal Carports, Inc.', email: 'sales@qualitymetalcarportsca.com', signed: false },
    ]),
  }))
  const [signing, setSigning] = useState(null)
  const [typed, setTyped] = useState('')
  const [saved, setSaved] = useState(false)

  if (!doc) return null
  const locked = doc.status !== 'draft'           // content locks once sent
  const v = locked ? doc : draft
  const signers = locked ? (doc.signers || []) : draft.signers
  const bodyHtml = (locked ? doc.body?.html : draft.body?.html) || ''

  const setF = (k, val) => setDraft((d) => ({ ...d, [k]: val }))
  const persist = (extra = {}) => updateDocument(docId, {
    title: draft.title, recipientName: draft.recipientName, recipient: draft.recipient,
    amount: draft.amount === '' ? null : Number(draft.amount), body: draft.body, signers: draft.signers, ...extra,
  })
  const save = () => { persist(); setSaved(true); setTimeout(() => setSaved(false), 1500) }
  const sendForSig = () => {
    if (!draft.title.trim()) return alert('Give the document a title first.')
    if (!draft.signers.some((s) => s.name.trim())) return alert('Add at least one signer with a name.')
    persist(); sendDocument(docId)
  }
  const addSigner = () => setF('signers', [...draft.signers, { id: sigUid(), role: 'Customer', name: '', email: '', signed: false }])
  const setSigner = (id, patch) => setF('signers', draft.signers.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const removeSigner = (id) => setF('signers', draft.signers.filter((s) => s.id !== id))
  const doSign = (id) => { if (typed.trim()) { signDocumentBy(docId, id, typed.trim()); setSigning(null); setTyped('') } }

  const printDoc = () => {
    const w = window.open('', '_blank', 'width=850,height=1100'); if (!w) return
    const sigRows = signers.map((s) =>
      `<div style="margin-top:26px"><div style="height:42px;border-bottom:2px solid #cbd5e1;font-family:'Segoe Script','Brush Script MT',cursive;font-style:italic;font-size:24px;color:#0f172a;padding-bottom:2px">${s.signed ? (s.signature || s.name) : ''}</div><div style="font-size:13px;color:#334155;margin-top:5px"><b>${s.name || ''}</b> &mdash; ${s.role || ''}${s.signed && s.signedAt ? ` &middot; signed ${fmtDate(s.signedAt)}` : ''}</div></div>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${v.title || 'Document'}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:720px;margin:40px auto;padding:0 24px;line-height:1.55}h1{font-size:24px}h2{font-size:20px}h3{font-size:15px}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:22px}.head .r{text-align:right;font-size:11px;color:#64748b;line-height:1.4}</style></head><body><div class="head"><img src="${location.origin}/logo.png" style="height:44px"/><div class="r"><b>Quality Metal Carports, Inc.</b><br/>CA LIC# 1096004<br/>9191 W Whitesbridge Ave, Fresno, CA 93706<br/>559-755-4900</div></div><h1>${v.title || ''}</h1>${(v.recipientName || v.recipient) ? `<p style="color:#64748b">Prepared for ${v.recipientName || ''} ${v.recipient ? `(${v.recipient})` : ''}</p>` : ''}${bodyHtml}${v.amount ? `<p style="font-weight:700;margin-top:20px">Total: $${Number(v.amount).toLocaleString()}</p>` : ''}<div style="border-top:1px solid #e2e8f0;margin-top:34px;padding-top:16px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8">Signatures</div>${sigRows}</div></body></html>`)
    w.document.close(); w.focus(); setTimeout(() => w.print(), 350)
  }

  const inp = 'w-full rounded border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none'

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-slate-900 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <PenSquare size={16} className="text-brand shrink-0" />
          <span className="font-semibold text-white truncate">{v.title || 'Untitled document'}</span>
          <Badge value={doc.status} />
        </div>
        <button onClick={onClose} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10"><X size={14} /> Close</button>
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* LEFT — build it out */}
        <div className="w-full lg:w-[420px] shrink-0 overflow-y-auto border-b lg:border-b-0 lg:border-r border-white/8 p-4 space-y-4">
          {locked ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 flex items-start gap-2">
              <Lock size={14} className="mt-0.5 shrink-0" />
              <span>This document is out for signature, so its content is locked. Capture signatures on the right.</span>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <Field label="Document title" value={draft.title} onChange={(e) => setF('title', e.target.value)} placeholder="Purchase Agreement — Hill Garage" />
                <div className="grid sm:grid-cols-2 gap-2">
                  <Field label="Recipient name" value={draft.recipientName} onChange={(e) => setF('recipientName', e.target.value)} placeholder="Marcus Hill" />
                  <Field label="Recipient email" value={draft.recipient} onChange={(e) => setF('recipient', e.target.value)} placeholder="m.hill@example.com" />
                </div>
                <Field label="Amount (optional)" type="number" value={draft.amount} onChange={(e) => setF('amount', e.target.value)} placeholder="16850" />
              </div>

              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Document content</div>
                <ContentEditor value={draft.body} onChange={(val) => setF('body', val)} />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Signers</span>
                  <button onClick={addSigner} className="flex items-center gap-1 text-xs text-brand-light hover:text-white"><UserPlus size={13} /> Add signer</button>
                </div>
                <div className="space-y-2">
                  {draft.signers.map((s) => (
                    <div key={s.id} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={s.name} onChange={(e) => setSigner(s.id, { name: e.target.value })} placeholder="Full name" className={inp} />
                        <button onClick={() => removeSigner(s.id)} className="shrink-0 text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={s.email} onChange={(e) => setSigner(s.id, { email: e.target.value })} placeholder="email@example.com" className={`${inp} text-xs`} />
                        <input value={s.role} onChange={(e) => setSigner(s.id, { role: e.target.value })} placeholder="Role" className={`${inp} text-xs`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button onClick={save} className="flex items-center gap-1.5 rounded border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/10">
                  {saved ? <><Check size={14} className="text-emerald-400" /> Saved</> : 'Save draft'}
                </button>
                <button onClick={sendForSig} className="flex items-center gap-1.5 rounded bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"><Send size={14} /> Set up &amp; send for signature</button>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — live preview + signing */}
        <div className="flex-1 overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
          <div className="mx-auto max-w-[700px] rounded-lg bg-white text-slate-800 shadow-2xl p-8 sm:p-12">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-6 gap-4">
              <img src="/logo.png" alt="Quality Metal Carports" className="h-10 w-auto" />
              <div className="text-right text-[11px] text-slate-500 leading-tight">
                <div className="font-semibold text-slate-700">Quality Metal Carports, Inc.</div>
                <div>CA LIC# 1096004</div>
                <div>9191 W Whitesbridge Ave, Fresno, CA 93706</div>
                <div>559-755-4900</div>
              </div>
            </div>

            <h1 className="font-display text-2xl font-bold text-slate-900">{v.title || 'Untitled document'}</h1>
            {(v.recipientName || v.recipient) && (
              <p className="mt-1 text-sm text-slate-500">Prepared for {v.recipientName || ''} {v.recipient ? `(${v.recipient})` : ''}</p>
            )}

            <div className="prose prose-slate prose-sm max-w-none mt-6"
              dangerouslySetInnerHTML={{ __html: bodyHtml || '<p style="color:#94a3b8">Add content on the left to build out this document.</p>' }} />

            {v.amount ? <p className="mt-6 text-base font-semibold text-slate-900">Total: ${Number(v.amount).toLocaleString()}</p> : null}

            <div className="mt-10 border-t border-slate-200 pt-6">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Signatures</div>
              <div className="grid sm:grid-cols-2 gap-6">
                {signers.map((s) => (
                  <div key={s.id} className="min-w-0">
                    <div className="h-12 flex items-end border-b-2 border-slate-300 pb-1">
                      {s.signed
                        ? <span style={{ fontFamily: '"Segoe Script","Brush Script MT",cursive', fontStyle: 'italic' }} className="text-2xl text-slate-900">{s.signature || s.name}</span>
                        : signing === s.id
                          ? <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSign(s.id)} placeholder="Type full legal name" className="w-full bg-transparent text-lg text-slate-900 placeholder-slate-300 focus:outline-none" />
                          : <span className="text-sm text-slate-300">Awaiting signature</span>}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{s.name || 'Unnamed'}</div>
                        <div className="text-[11px] text-slate-500 truncate">{s.role}{s.email ? ` · ${s.email}` : ''}{s.signed && s.signedAt ? ` · signed ${fmtDate(s.signedAt)}` : ''}</div>
                      </div>
                      {locked && !s.signed && (
                        signing === s.id
                          ? <button onClick={() => doSign(s.id)} className="shrink-0 flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"><Check size={12} /> Apply</button>
                          : <button onClick={() => { setSigning(s.id); setTyped(s.name || '') }} className="shrink-0 flex items-center gap-1 rounded bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-dark"><PenLine size={12} /> Sign</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-[700px] mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {doc.status === 'draft' && 'Draft — not sent yet.'}
              {doc.status === 'sent' && `Out for signature · ${signers.filter((s) => s.signed).length}/${signers.length} signed`}
              {doc.status === 'signed' && `Completed · signed ${fmtDate(doc.signedAt)}`}
            </div>
            <button onClick={printDoc} className="flex items-center gap-1.5 rounded border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"><Printer size={13} /> Print / Save PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Social() {
  const posts = getSocialPosts()
  const [form, setForm] = useState({ platform: 'Instagram', content: '', when: '' })
  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">Social <span className="text-slate-500 text-sm">· Postiz scheduler</span></h1>
      <Card className="p-4 space-y-3">
        <div className="flex gap-2">
          {['Instagram', 'Facebook', 'X', 'LinkedIn'].map((p) => (
            <button key={p} onClick={() => setForm({ ...form, platform: p })} className={`rounded-full px-3 py-1 text-xs font-semibold ${form.platform === p ? 'bg-brand text-white' : 'border border-white/15 text-slate-300 hover:bg-white/10'}`}>{p}</button>
          ))}
        </div>
        <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} placeholder="Write a post…" className="w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand focus:outline-none resize-none" />
        <div className="flex items-center justify-between gap-2">
          <input type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} className="rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-brand focus:outline-none" />
          <button onClick={() => { if (form.content.trim()) { addSocialPost({ platform: form.platform, content: form.content.trim(), when: form.when ? new Date(form.when).toISOString() : new Date().toISOString(), status: 'scheduled' }); setForm({ platform: form.platform, content: '', when: '' }) } }} className="flex items-center gap-1.5 rounded bg-brand px-3.5 py-2 text-sm font-semibold text-white"><Plus size={14} /> Schedule</button>
        </div>
      </Card>
      {posts.length === 0 ? <Empty icon={Share2} title="Nothing scheduled" hint="Compose a post above to add it to the queue across your channels." /> : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-white/8 px-2 py-0.5 text-[11px] font-semibold text-slate-200">{p.platform}</span>
                <div className="flex items-center gap-2"><Badge value={p.status} /><span className="text-xs text-slate-500">{fmtTime(p.when)}</span><button onClick={() => removeRecord('social', p.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button></div>
              </div>
              <p className="mt-2 text-sm text-slate-300">{p.content}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Reviews() {
  const reviews = getSiteReviews(); const sum = getReviewSummary()
  const [edit, setEdit] = useState(null) // { idx, draft }
  const startNew = () => setEdit({ idx: -1, draft: { author: '', rating: 5, text: '', date: '' } })
  const save = () => { saveReview(edit.idx >= 0 ? { id: edit.idx, ...edit.draft } : edit.draft); setEdit(null) }
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-white">Reviews <span className="text-slate-500 text-lg">({reviews.length})</span></h1>
        <div className="flex items-center gap-3"><span className="text-sm text-slate-400">{sum.rating.toFixed(1)}★ · {sum.total} total</span><button onClick={startNew} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> Add</button></div>
      </div>
      <p className="text-xs text-slate-500">Edits here update the homepage reviews carousel live (in this browser).</p>
      {edit && (
        <Card className="p-4 space-y-3 border-brand/40">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Author" value={edit.draft.author} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, author: e.target.value } })} />
            <Field label="Date" value={edit.draft.date} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, date: e.target.value } })} placeholder="May 2026" />
          </div>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Rating</span>
            <select value={edit.draft.rating} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, rating: Number(e.target.value) } })} className="rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Review</span>
            <textarea value={edit.draft.text} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, text: e.target.value } })} rows={3} className="w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none resize-none" /></label>
          <div className="flex gap-2"><button onClick={save} className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white">Save</button><button onClick={() => setEdit(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button></div>
        </Card>
      )}
      <div className="space-y-3">
        {reviews.map((r, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2"><span className="font-semibold text-white">{r.author}</span><span className="text-amber-400 text-sm">{'★'.repeat(r.rating)}</span></div>
              <div className="flex items-center gap-2 shrink-0">{r.date && <span className="text-xs text-slate-500">{r.date}</span>}<button onClick={() => setEdit({ idx: i, draft: { author: r.author, rating: r.rating, text: r.text, date: r.date || '' } })} className="text-slate-500 hover:text-white"><Pencil size={13} /></button><button onClick={() => deleteReview(i)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button></div>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">{r.text}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Blog() {
  const posts = getSiteBlog()
  const [edit, setEdit] = useState(null)
  const startNew = () => setEdit({ slug: '', title: '', excerpt: '', tag: 'Article', html: '<p></p>', published_at: new Date().toISOString() })
  const save = () => {
    saveBlogPost({ ...edit, tags: [{ id: 0, name: edit.tag || 'Article' }], reading_time: Math.max(1, Math.round((edit.html || '').split(/\s+/).length / 200)) })
    setEdit(null)
  }
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-white">Blog <span className="text-slate-500 text-lg">({posts.length})</span></h1>
        <button onClick={startNew} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> New post</button>
      </div>
      <p className="text-xs text-slate-500">Edits here update the public blog live (in this browser).</p>
      {edit && (
        <Card className="p-4 space-y-3 border-brand/40">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{edit.slug ? 'Edit post' : 'New post'}</span><button onClick={() => setEdit(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
          <Field label="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <div className="grid sm:grid-cols-2 gap-3"><Field label="Tag" value={edit.tag} onChange={(e) => setEdit({ ...edit, tag: e.target.value })} /><Field label="Date" value={fmtDate(edit.published_at)} disabled /></div>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Excerpt</span><textarea value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} rows={2} className="w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none resize-none" /></label>
          <div><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Body</span>
            <ContentEditor value={{ html: edit.html, ...(edit.editor || {}) }} onChange={(c) => setEdit((e) => ({ ...e, html: c.html, editor: { format: c.format, text: c.text, blocks: c.blocks } }))} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white">Save & publish</button><button onClick={() => setEdit(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button></div>
        </Card>
      )}
      <Card className="overflow-hidden"><div className="divide-y divide-white/6">
        {posts.map((p) => (
          <div key={p.slug} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0"><div className="font-medium text-white truncate">{p.title}</div><div className="mt-0.5 text-xs text-slate-500">{fmtDate(p.published_at)} · {p.tags?.[0]?.name || 'Article'} · {p.reading_time} min read</div></div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">Published</span>
              <button onClick={() => setEdit({ slug: p.slug, title: p.title, excerpt: p.excerpt, tag: p.tags?.[0]?.name || 'Article', html: p.html, published_at: p.published_at })} className="text-slate-500 hover:text-white"><Pencil size={13} /></button>
              <Link to={`/blog/${p.slug}`} target="_blank" className="text-slate-500 hover:text-white"><ExternalLink size={14} /></Link>
              <button onClick={() => deleteBlogPost(p.slug)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div></Card>
    </div>
  )
}

function Pages() {
  const pages = getAllPages()
  const generated = getGeneratedPages()
  const [edit, setEdit] = useState(null) // { kind:'core'|'custom', id, draft }

  const openEdit = (pg) => {
    if (pg.custom) setEdit({ kind: 'custom', id: pg.id, draft: { ...getCustomPage(pg.id) } })
    else setEdit({ kind: 'core', id: pg.id, draft: { ...getPageFields(pg.id) } })
  }
  const save = () => {
    if (edit.kind === 'custom') saveCustomPage(edit.draft)
    else savePageFields(edit.id, edit.draft)
    setEdit(null)
  }
  const set = (k, v) => setEdit((e) => ({ ...e, draft: { ...e.draft, [k]: v } }))

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-white">Pages <span className="text-slate-500 text-lg">({pages.length})</span></h1>
        <button onClick={() => { const slug = createPage(); setEdit({ kind: 'custom', id: slug, draft: { ...getCustomPage(slug) } }) }} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> New page</button>
      </div>
      <p className="text-xs text-slate-500">Edit a page’s hero, or duplicate one to spin up a new page. Changes show on the site live (in this browser).</p>

      {edit && (
        <Card className="p-4 space-y-3 border-brand/40">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">Editing: {edit.kind === 'custom' ? (edit.draft.name || 'Custom page') : edit.id}</span><button onClick={() => setEdit(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
          {edit.kind === 'custom' && <Field label="Page name" value={edit.draft.name || ''} onChange={(e) => set('name', e.target.value)} />}
          <Field label="Eyebrow" value={edit.draft.eyebrow || ''} onChange={(e) => set('eyebrow', e.target.value)} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Headline" value={edit.draft.title1 || ''} onChange={(e) => set('title1', e.target.value)} />
            <Field label="Headline accent (2nd line)" value={edit.draft.title2 || ''} onChange={(e) => set('title2', e.target.value)} />
          </div>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Intro</span><textarea value={edit.draft.intro || ''} onChange={(e) => set('intro', e.target.value)} rows={3} className="w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none resize-none" /></label>
          {edit.id === 'home' && edit.kind === 'core' && <Field label="Primary button label" value={edit.draft.cta || ''} onChange={(e) => set('cta', e.target.value)} />}
          {edit.kind === 'custom' && (
            <div><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Body</span>
              <ContentEditor value={{ html: edit.draft.body || '', ...(edit.draft.bodyEditor || {}) }} onChange={(c) => setEdit((e) => ({ ...e, draft: { ...e.draft, body: c.html, bodyEditor: { format: c.format, text: c.text, blocks: c.blocks } } }))} />
            </div>
          )}
          <div className="flex gap-2"><button onClick={save} className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white">Save</button><button onClick={() => setEdit(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button></div>
        </Card>
      )}

      <Card className="overflow-hidden"><div className="divide-y divide-white/6">
        {pages.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-medium text-white truncate">{p.name}</div>
              <div className="text-xs text-slate-500">{p.path}{!p.editable && p.note ? ` · ${p.note}` : ''}</div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${p.type === 'Custom' ? 'bg-violet-500/15 text-violet-300' : 'bg-white/8 text-slate-300'}`}>{p.type}</span>
              {p.editable && <button onClick={() => openEdit(p)} title="Edit" className="text-slate-500 hover:text-white"><Pencil size={13} /></button>}
              <button onClick={() => duplicatePage(p.id)} title="Duplicate" className="text-slate-500 hover:text-white"><Copy size={13} /></button>
              <Link to={p.path} target="_blank" title="View" className="text-slate-500 hover:text-white"><ExternalLink size={14} /></Link>
              {p.custom && <button onClick={() => deleteCustomPage(p.id)} title="Delete" className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>}
            </div>
          </div>
        ))}
      </div></Card>

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Auto-generated</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {generated.map((g) => (
            <Card key={g.name} className="p-5"><div className="font-display text-3xl font-bold text-white">{g.count.toLocaleString()}</div><div className="text-sm text-slate-300">{g.name}</div><Link to={g.sample} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline">View sample <ExternalLink size={11} /></Link></Card>
          ))}
        </div>
      </div>
    </div>
  )
}

const stripHtml = (h = '') => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const selCls = 'w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-brand focus:outline-none'

function Templates() {
  const templates = getTemplates()
  const [edit, setEdit] = useState(null)
  const save = () => { if (edit.name) { saveTemplate(edit); setEdit(null) } }
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-white">Templates <span className="text-slate-500 text-lg">({templates.length})</span></h1>
        <button onClick={() => setEdit({ name: 'Untitled template', type: 'document', subject: '', body: '<p></p>' })} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> New template</button>
      </div>
      <p className="text-xs text-slate-500">Control what your quotes and documents look like. Pick a template when you create a document.</p>

      {edit && (
        <Card className="p-4 space-y-3 border-brand/40">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{edit.id ? 'Edit template' : 'New template'}</span><button onClick={() => setEdit(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Template name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Type</span>
              <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} className={selCls}><option value="quote">Quote</option><option value="document">Document</option></select>
            </label>
          </div>
          <Field label="Subject / heading" value={edit.subject || ''} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} placeholder="Your custom metal building quote" />
          <div><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Body</span>
            <ContentEditor value={{ html: edit.body, ...(edit.bodyEditor || {}) }} onChange={(c) => setEdit((e) => ({ ...e, body: c.html, bodyEditor: { format: c.format, text: c.text, blocks: c.blocks } }))} />
          </div>
          <div className="flex gap-2"><button onClick={save} className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white">Save</button><button onClick={() => setEdit(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button></div>
        </Card>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <Card key={t.id} className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2"><span className="font-medium text-white">{t.name}</span><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.type === 'quote' ? 'bg-violet-500/15 text-violet-300' : 'bg-blue-500/15 text-blue-300'}`}>{t.type}</span></div>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{stripHtml(t.body)}</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button onClick={() => setEdit({ ...t })} title="Edit" className="text-slate-500 hover:text-white"><Pencil size={14} /></button>
              <button onClick={() => removeTemplate(t.id)} title="Delete" className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Read a chosen image file into a data URL (demo "upload"; stored in localStorage).
function readImageFile(file, cb) {
  if (!file) return
  const r = new FileReader()
  r.onload = () => cb(r.result)
  r.readAsDataURL(file)
}

// A single file tile — drag to reorder, drag onto a folder to move.
function FileTile({ file, leads, drag, setDrag, onDropFile }) {
  return (
    <div
      draggable
      onDragStart={() => setDrag({ type: 'file', id: file.id })}
      onDragEnd={() => setDrag(null)}
      onDragOver={(e) => { if (drag?.type === 'file') e.preventDefault() }}
      onDrop={() => onDropFile(file.id)}
      className={`group relative rounded-lg border border-white/10 bg-white/[0.02] p-2 ${drag?.id === file.id ? 'opacity-40' : ''}`}
    >
      <div className="flex h-24 items-center justify-center overflow-hidden rounded bg-black/30">
        {file.kind === 'image' && file.dataUrl
          ? <img src={file.dataUrl} alt={file.name} className="h-full w-full object-cover" />
          : <Files size={26} className="text-slate-500" />}
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        <GripVertical size={12} className="shrink-0 cursor-grab text-slate-600" />
        <span className="truncate text-xs text-slate-300" title={file.name}>{file.name}</span>
        <button onClick={() => removeFile(file.id)} className="ml-auto text-slate-600 hover:text-red-400"><Trash2 size={12} /></button>
      </div>
      <select value={file.leadId || ''} onChange={(e) => tagFileLead(file.id, e.target.value || null)} title="Attach to a lead"
        className="mt-1 w-full rounded border border-white/10 bg-slate-900 px-1.5 py-1 text-[11px] text-slate-300">
        <option value="">Unattached</option>
        {leads.map((l) => <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>)}
      </select>
    </div>
  )
}

// Folders (left) + files (right). Native HTML5 drag-and-drop: reorder folders,
// reorder files, and drag a file onto a folder to move it. Scoped to the org.
function FilesView() {
  const me = effectiveUser()
  const orgId = me?.orgId || MFR_ORG_ID
  const folders = getFolders(orgId)
  const leads = scopeRecords(me, getLeads())
  const [sel, setSel] = useState(folders[0]?.id || null)
  const [drag, setDrag] = useState(null)        // { type:'folder'|'file', id }
  const [overFolder, setOverFolder] = useState(null)
  const fileInput = useRef(null)

  const selFolder = folders.find((f) => f.id === sel) || folders[0] || null
  const files = selFolder ? getFiles(selFolder.id) : []

  const upload = (fileList) => {
    if (!selFolder) return
    Array.from(fileList || []).forEach((f) => {
      if (f.type.startsWith('image/')) readImageFile(f, (url) => addFile({ orgId, folderId: selFolder.id, name: f.name, kind: 'image', dataUrl: url }))
      else addFile({ orgId, folderId: selFolder.id, name: f.name, kind: 'file' })
    })
  }
  const dropOnFolder = (folderId) => {
    if (!drag) return
    if (drag.type === 'file') moveFile(drag.id, folderId)
    else if (drag.type === 'folder' && drag.id !== folderId) {
      const ids = folders.map((f) => f.id).filter((id) => id !== drag.id)
      ids.splice(Math.max(0, ids.indexOf(folderId)), 0, drag.id)
      reorderFolders(ids)
    }
    setDrag(null); setOverFolder(null)
  }
  const dropOnFile = (fileId) => {
    if (!drag || drag.type !== 'file' || drag.id === fileId) { setDrag(null); return }
    const ids = files.map((f) => f.id).filter((id) => id !== drag.id)
    ids.splice(Math.max(0, ids.indexOf(fileId)), 0, drag.id)
    reorderFiles(ids); setDrag(null)
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Files</h1>
          <p className="mt-1 text-xs text-slate-500">Folders &amp; files for {getOrgName(orgId)}. Drag to reorder; drag a file onto a folder to move it. Photos can be attached to a lead.</p>
        </div>
        <button onClick={() => { const f = addFolder({ orgId, name: 'New folder' }); setSel(f.id) }} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><FolderPlus size={14} /> New folder</button>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-4">
        {/* Folders */}
        <div className="space-y-1">
          {folders.length === 0 && <p className="text-xs text-slate-600 px-1">No folders yet.</p>}
          {folders.map((f) => {
            const count = getFiles(f.id).length
            return (
              <div key={f.id}
                draggable
                onDragStart={() => setDrag({ type: 'folder', id: f.id })}
                onDragEnd={() => { setDrag(null); setOverFolder(null) }}
                onDragOver={(e) => { e.preventDefault(); setOverFolder(f.id) }}
                onDragLeave={() => setOverFolder((o) => (o === f.id ? null : o))}
                onDrop={() => dropOnFolder(f.id)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm cursor-pointer ${selFolder?.id === f.id ? 'border-brand/50 bg-brand/10 text-white' : 'border-white/8 text-slate-300 hover:bg-white/5'} ${overFolder === f.id && drag ? 'ring-1 ring-brand' : ''}`}
                onClick={() => setSel(f.id)}>
                <GripVertical size={12} className="shrink-0 cursor-grab text-slate-600" />
                <Folder size={14} className="shrink-0 text-slate-400" />
                <input
                  value={f.name}
                  onChange={(e) => renameFolder(f.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 bg-transparent text-sm text-inherit focus:outline-none"
                />
                <span className="text-[10px] text-slate-500">{count}</span>
                <button onClick={(e) => { e.stopPropagation(); removeFolder(f.id) }} className="text-slate-600 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            )
          })}
        </div>

        {/* Files in selected folder */}
        <div>
          {!selFolder ? (
            <Empty icon={Folder} title="Create a folder to start" hint="Add a folder on the left, then upload photos and documents into it." />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-white">{selFolder.name} <span className="text-slate-500">({files.length})</span></span>
                <button onClick={() => fileInput.current?.click()} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"><Upload size={13} /> Upload</button>
                <input ref={fileInput} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
              </div>
              {files.length === 0 ? (
                <div onDragOver={(e) => e.preventDefault()} className="rounded-xl border border-dashed border-white/12 py-12 text-center text-sm text-slate-500">
                  <ImageIcon size={22} className="mx-auto mb-2 text-slate-600" /> Upload photos (level-site, installer) or documents here.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {files.map((file) => <FileTile key={file.id} file={file} leads={leads} drag={drag} setDrag={setDrag} onDropFile={dropOnFile} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
function DealerLogo({ org, size = 36 }) {
  if (org?.logoDataUrl) return <img src={org.logoDataUrl} alt={org.name} className="rounded object-contain bg-white" style={{ width: size, height: size }} />
  return <span className="flex items-center justify-center rounded font-bold text-white" style={{ width: size, height: size, background: org?.brandColor || '#64748b', fontSize: size * 0.42 }}>{(org?.name || '?').slice(0, 1)}</span>
}

// Manufacturer-only: create & manage dealerships, invite their users, and see
// each dealership's leads/designs/team as its own cluster ("group by dealership").
function Dealerships() {
  const dealers = getDealerOrgs()
  const leads = getLeads(), designs = getDesigns(), users = getUsers()
  const [edit, setEdit] = useState(null)     // dealership draft (id => editing)
  const [openId, setOpenId] = useState(null) // expanded cluster
  const [del, setDel] = useState(null)       // dealership pending delete
  const [invite, setInvite] = useState(null) // { orgId, name, email, role }

  const blank = { name: '', phone: '', brandColor: '#c8102e', logoDataUrl: '', active: true }
  const saveDealer = () => { if (!edit.name) return; if (edit.id) updateOrg(edit.id, edit); else addOrg(edit); setEdit(null) }
  const saveInvite = () => { if (!invite.name) return; addUser({ name: invite.name, email: invite.email, role: invite.role, orgId: invite.orgId }); setInvite(null) }
  const countsFor = (orgId) => ({
    leads: leads.filter((l) => (l.orgId || MFR_ORG_ID) === orgId).length,
    designs: designs.filter((d) => (d.orgId || MFR_ORG_ID) === orgId).length,
    team: users.filter((u) => (u.orgId || MFR_ORG_ID) === orgId).length,
  })
  const mfrCounts = countsFor(MFR_ORG_ID)

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Dealerships <span className="text-slate-500 text-lg">({dealers.length})</span></h1>
          <p className="mt-1 text-xs text-slate-500">Each dealership is its own tenant — its users and leads stay separate. You see everything; they only see their own.</p>
        </div>
        <button onClick={() => setEdit({ ...blank })} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><Plus size={13} /> Add dealership</button>
      </div>

      {edit && (
        <Card className="p-4 space-y-3 border-brand/40">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{edit.id ? `Edit ${edit.name}` : 'New dealership'}</span><button onClick={() => setEdit(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Dealership name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Sierra Steel Structures" />
            <Field label="Phone" value={edit.phone || ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="(775) 555-0110" />
          </div>
          <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-end">
            <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Brand color</span>
              <input type="color" value={edit.brandColor || '#c8102e'} onChange={(e) => setEdit({ ...edit, brandColor: e.target.value })} className="h-9 w-16 rounded border border-white/10 bg-slate-900" />
            </label>
            <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Logo (shown on their white-label builder)</span>
              <div className="flex items-center gap-3">
                <DealerLogo org={edit} size={40} />
                <input type="file" accept="image/*" onChange={(e) => readImageFile(e.target.files?.[0], (url) => setEdit({ ...edit, logoDataUrl: url }))} className="text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-slate-200" />
                {edit.logoDataUrl && <button onClick={() => setEdit({ ...edit, logoDataUrl: '' })} className="text-xs text-slate-500 hover:text-red-400">remove</button>}
              </div>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="accent-brand" /> Active</label>
          <div className="flex gap-2"><button onClick={saveDealer} className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white">Save</button><button onClick={() => setEdit(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button></div>
        </Card>
      )}

      {/* QMC-direct cluster */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-brand/20 text-brand"><Store size={17} /></span>
          <div className="flex-1 min-w-0"><div className="font-semibold text-white">Quality Metal Carports <span className="text-xs font-normal text-slate-500">· direct</span></div><div className="text-xs text-slate-500">{mfrCounts.leads} leads · {mfrCounts.designs} designs · {mfrCounts.team} staff</div></div>
        </div>
      </Card>

      {/* Dealership clusters */}
      {dealers.length === 0 ? <Empty icon={Building2} title="No dealerships yet" hint="Add a dealership, then invite its admin and salespeople. Their leads stay walled off from other dealers and from your direct leads." /> : dealers.map((o) => {
        const c = countsFor(o.id)
        const open = openId === o.id
        const team = users.filter((u) => u.orgId === o.id)
        const orgLeads = leads.filter((l) => l.orgId === o.id)
        return (
          <Card key={o.id} className="overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <DealerLogo org={o} size={40} />
              <button onClick={() => setOpenId(open ? null : o.id)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2"><span className="font-semibold text-white truncate">{o.name}</span>{o.active === false && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">Inactive</span>}</div>
                <div className="text-xs text-slate-500">{c.leads} leads · {c.designs} designs · {c.team} team</div>
              </button>
              <button onClick={() => setEdit({ ...o })} title="Edit" className="text-slate-500 hover:text-white"><Pencil size={14} /></button>
              <button onClick={() => setDel(o)} title="Delete" className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
              <button onClick={() => setOpenId(open ? null : o.id)} className="text-slate-400">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            </div>

            {open && (
              <div className="border-t border-white/8 p-4 space-y-4 bg-black/20">
                {/* Team */}
                <div>
                  <div className="flex items-center justify-between mb-2"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Salespeople</span><button onClick={() => setInvite({ orgId: o.id, name: '', email: '', role: 'dealer_sales' })} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><UserPlus size={12} /> Invite user</button></div>
                  {invite?.orgId === o.id && (
                    <div className="mb-2 grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 rounded-lg border border-brand/30 p-2">
                      <input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="Name" className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white" />
                      <input value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="email" className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white" />
                      <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })} className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200"><option value="dealer_admin">Dealer Admin</option><option value="dealer_sales">Salesperson</option></select>
                      <button onClick={saveInvite} className="rounded bg-brand px-2 py-1 text-xs font-semibold text-white">Add</button>
                    </div>
                  )}
                  {team.length === 0 ? <p className="text-xs text-slate-600">No users yet.</p> : (
                    <div className="flex flex-wrap gap-2">{team.map((u) => <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300"><Avatar id={u.id} size={18} /> {u.name} <span className="text-slate-600">· {ROLES[u.role]?.label}</span></span>)}</div>
                  )}
                </div>
                {/* Lead cluster */}
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">Leads in this dealership</span>
                  {orgLeads.length === 0 ? <p className="mt-1 text-xs text-slate-600">No leads yet.</p> : (
                    <div className="mt-2 divide-y divide-white/6 rounded-lg border border-white/8">
                      {orgLeads.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0"><span className="text-sm text-white truncate">{l.firstName} {l.lastName}</span> <span className="text-xs text-slate-500">{l.structureType}</span></div>
                          <div className="flex items-center gap-2 shrink-0"><Badge value={l.status} /><AssigneeSelect kind="leads" id={l.id} value={l.assignee} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        )
      })}

      {del && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4" onClick={() => setDel(null)}>
          <Card className="max-w-sm w-full p-5 bg-slate-900" >
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} className="text-amber-400" /><span className="font-semibold text-white">Delete {del.name}?</span></div>
            <p className="text-sm text-slate-400 mb-4">This removes the dealership. Its leads stay in the system (you keep them); its users remain but lose their dealership. This can’t be undone.</p>
            <div className="flex justify-end gap-2"><button onClick={() => setDel(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button><button onClick={() => { removeOrg(del.id); setDel(null) }} className="rounded bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white">Delete</button></div>
          </Card>
        </div>
      )}
    </div>
  )
}

// Dealer-facing: white-label branding + a copy-paste embed snippet for their site.
function EmbedView() {
  const org = currentOrg()
  const [copied, setCopied] = useState(null)
  if (!org || org.kind !== 'dealer') return <Empty icon={Box} title="Dealer builder & embed" hint="Sign in as a dealership to brand and embed your builder." />
  const origin = window.location.origin
  const builderUrl = `${origin}/builder?org=${org.embedKey}`
  const embedUrl = `${origin}/embed/builder?org=${org.embedKey}`
  const iframe = `<iframe src="${embedUrl}" width="100%" height="720" style="border:0;border-radius:12px" title="Design your building"></iframe>`
  const copy = (txt, key) => { try { navigator.clipboard?.writeText(txt) } catch { /* */ } setCopied(key); setTimeout(() => setCopied(null), 1500) }
  const CopyField = ({ label, value, k, mono }) => (
    <div>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={value} className={`min-w-0 flex-1 rounded border border-white/10 bg-slate-900 px-2.5 py-2 text-xs text-slate-300 ${mono ? 'font-mono' : ''}`} />
        <button onClick={() => copy(value, k)} className="flex items-center gap-1 rounded border border-white/15 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">{copied === k ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">Builder &amp; Embed</h1>
        <p className="mt-1 text-xs text-slate-500">Brand the 3D builder with your logo and drop it on your own website. Designs customers start there come straight to your leads — and on to Quality Metal to manufacture.</p>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Branding</h2>
        <div className="flex items-center gap-4">
          <DealerLogo org={org} size={48} />
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Logo</span>
            <input type="file" accept="image/*" onChange={(e) => readImageFile(e.target.files?.[0], (url) => updateOrg(org.id, { logoDataUrl: url }))} className="text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-slate-200" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Brand color</span>
            <input type="color" value={org.brandColor || '#c8102e'} onChange={(e) => updateOrg(org.id, { brandColor: e.target.value })} className="h-9 w-16 rounded border border-white/10 bg-slate-900" />
          </label>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Share links</h2>
        <CopyField label="Branded builder link (send to a customer)" value={builderUrl} k="builder" />
        <CopyField label="Embed URL" value={embedUrl} k="embed" />
      </Card>

      <Card className="p-4 space-y-2">
        <h2 className="text-sm font-semibold text-white">Embed on your website</h2>
        <p className="text-xs text-slate-500">Paste this where you want the builder to appear.</p>
        <div className="flex gap-2">
          <textarea readOnly value={iframe} rows={3} className="min-w-0 flex-1 rounded border border-white/10 bg-slate-900 px-2.5 py-2 text-xs font-mono text-slate-300" />
          <button onClick={() => copy(iframe, 'iframe')} className="flex items-start gap-1 rounded border border-white/15 px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10">{copied === 'iframe' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}</button>
        </div>
      </Card>
    </div>
  )
}

function Team() {
  const me = effectiveUser()
  const mfr = roleScope(me?.role) === 'manufacturer'
  const users = scopedUsers(me)
  // Dealers can only create dealer-scoped roles inside their own dealership.
  const roleOptions = Object.entries(ROLES).filter(([, r]) => !r.legacy && (mfr ? true : r.scope === 'dealer'))
  const newUserDefaults = { name: '', email: '', role: mfr ? 'mfr_staff' : 'dealer_sales', orgId: me?.orgId || MFR_ORG_ID, active: true }
  const [edit, setEdit] = useState(null) // user draft (with id = editing)
  const [del, setDel] = useState(null)   // { user, reassignTo }
  const saveUser = () => { if (!edit.name) return; if (edit.id) updateUser(edit.id, edit); else addUser(edit); setEdit(null) }
  const confirmDelete = () => { removeUser(del.user.id, del.reassignTo || null); setDel(null) }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-white">{mfr ? 'Team' : `${currentOrg()?.name || 'Dealership'} team`} <span className="text-slate-500 text-lg">({users.length})</span></h1>
        <button onClick={() => setEdit({ ...newUserDefaults })} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><UserPlus size={13} /> Add user</button>
      </div>
      <p className="text-xs text-slate-500">{mfr ? 'Manage who can sign in, what each role can do, and who owns every lead, quote, chat and document.' : 'Manage your dealership’s salespeople and who owns each of your leads and quotes.'}</p>

      {edit && (
        <Card className="p-4 space-y-3 border-brand/40">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{edit.id ? `Edit ${edit.name}` : 'Add team member'}</span><button onClick={() => setEdit(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Jane Doe" />
            <Field label="Email" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="jane@company.com" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Role</span>
              <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} className={selCls}>{roleOptions.map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 pb-2"><input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="accent-brand" /> Active (can sign in)</label>
          </div>
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{ROLES[edit.role]?.label} can</span>
            <div className="mt-1.5 flex flex-wrap gap-1">{PERMISSIONS.map((p) => <span key={p.id} className={`rounded px-1.5 py-0.5 text-[10px] ${roleCan(edit.role, p.id) ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-600 line-through'}`}>{p.label}</span>)}</div>
          </div>
          <div className="flex gap-2"><button onClick={saveUser} className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-white">Save</button><button onClick={() => setEdit(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button></div>
        </Card>
      )}

      <Card className="overflow-hidden"><div className="divide-y divide-white/6">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar id={u.id} size={38} />
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-medium text-white truncate">{u.name}</span>{!u.active && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">Inactive</span>}</div>
                <div className="text-xs text-slate-500 truncate">{u.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-500">{assignedCount(u.id)} assigned</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${ROLE_COLOR[u.role] || 'bg-white/8 text-slate-300'}`}>{ROLES[u.role]?.label || u.role}</span>
              <button onClick={() => setEdit({ ...u })} title="Edit" className="text-slate-500 hover:text-white"><Pencil size={14} /></button>
              <button onClick={() => setDel({ user: u, reassignTo: '' })} title="Remove" className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div></Card>

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Roles &amp; permissions</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {roleOptions.map(([key, r]) => (
            <Card key={key} className="p-4">
              <div className="flex items-center gap-2 mb-1"><Shield size={14} className="text-brand" /><span className="font-semibold text-white">{r.label}</span><span className="text-xs text-slate-600">{users.filter((u) => u.role === key).length} {users.filter((u) => u.role === key).length === 1 ? 'person' : 'people'}</span></div>
              <p className="text-xs text-slate-500 mb-2">{r.desc}</p>
              <div className="flex flex-wrap gap-1">{PERMISSIONS.map((p) => <span key={p.id} className={`rounded px-1.5 py-0.5 text-[10px] ${r.perms.includes(p.id) ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-600 line-through'}`}>{p.label}</span>)}</div>
            </Card>
          ))}
        </div>
      </div>

      {del && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4" onClick={() => setDel(null)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={18} className="text-amber-400" /><h3 className="font-semibold text-white">Remove {del.user.name}?</h3></div>
            <p className="text-sm text-slate-400 mb-4">
              {assignedCount(del.user.id) > 0
                ? <><span className="font-semibold text-white">{assignedCount(del.user.id)}</span> record{assignedCount(del.user.id) === 1 ? ' is' : 's are'} assigned to them. Choose who takes over — everything is reassigned automatically.</>
                : 'They have no assigned work. This removes their access.'}
            </p>
            {assignedCount(del.user.id) > 0 && (
              <label className="block mb-4"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Reassign their work to</span>
                <select value={del.reassignTo} onChange={(e) => setDel({ ...del, reassignTo: e.target.value })} className={selCls}>
                  <option value="">Leave unassigned</option>
                  {users.filter((u) => u.id !== del.user.id).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2"><button onClick={() => setDel(null)} className="rounded border border-white/15 px-3 py-1.5 text-sm text-slate-300">Cancel</button><button onClick={confirmDelete} className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500">Remove &amp; reassign</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
