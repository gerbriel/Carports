import { useEffect, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, FileText, Box, Star, Newspaper, Files,
  MessageSquare, BarChart3, PenSquare, Share2, Rocket, Calendar, Map, CheckCircle2,
  ArrowLeft, Trash2, ExternalLink, Eraser, Sparkles, Send, Plus, Check, Pencil, X, Copy,
  Users, Shield, LayoutTemplate, UserPlus, AlertTriangle,
} from 'lucide-react'
import {
  getLeads, getQuotes, getDesigns,
  getConversations, addMessage, markConversationRead,
  getDocuments, addDocument, signDocument,
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
} from '../data/adminData'
import { INTEGRATIONS, BRAND } from '../data/integrations'
import ContentEditor from '../components/admin/ContentEditor'

const ICONS = { Inbox, MessageSquare, BarChart3, PenSquare, Share2, Calendar, Newspaper, Map }

// Nav — each maps to one of the self-hosted services, all demoed locally.
const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'setup', label: 'Setup', svc: 'Get started', icon: Rocket },
  { id: 'leads', label: 'Leads', svc: 'Twenty CRM', icon: Inbox },
  { id: 'quotes', label: 'Quotes', svc: 'Twenty CRM', icon: FileText },
  { id: 'designs', label: 'Designs', svc: '3D Builder', icon: Box },
  { id: 'inbox', label: 'Inbox', svc: 'Chatwoot', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', svc: 'Plausible', icon: BarChart3 },
  { id: 'documents', label: 'Documents', svc: 'Documenso', icon: PenSquare },
  { id: 'templates', label: 'Templates', svc: 'Quotes & docs', icon: LayoutTemplate },
  { id: 'social', label: 'Social', svc: 'Postiz', icon: Share2 },
  { id: 'reviews', label: 'Reviews', svc: 'Editable', icon: Star },
  { id: 'blog', label: 'Blog', svc: 'Ghost / CMS', icon: Newspaper },
  { id: 'pages', label: 'Pages', icon: Files },
  { id: 'team', label: 'Team', svc: 'Users & roles', icon: Users },
]

const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost']
const QUOTE_STATUSES = ['open', 'sent', 'accepted', 'declined']
const STATUS_COLOR = {
  new: 'bg-blue-500/15 text-blue-300', contacted: 'bg-amber-500/15 text-amber-300',
  quoted: 'bg-violet-500/15 text-violet-300', won: 'bg-emerald-500/15 text-emerald-300',
  lost: 'bg-slate-500/15 text-slate-400', open: 'bg-blue-500/15 text-blue-300',
  sent: 'bg-amber-500/15 text-amber-300', accepted: 'bg-emerald-500/15 text-emerald-300',
  declined: 'bg-slate-500/15 text-slate-400', draft: 'bg-slate-500/15 text-slate-400',
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
  const users = getUsers()
  return (
    <select value={value || ''} onChange={(e) => assign(kind, id, e.target.value || null)} title="Assigned to"
      className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none max-w-[8.5rem]">
      <option value="">Unassigned</option>
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  )
}

export default function AdminDemoPage() {
  const [tab, setTab] = useState('overview')
  useAdmin()

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
          <button onClick={loadSampleData} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"><Sparkles size={13} /> <span className="hidden sm:inline">Load sample data</span></button>
          <button onClick={clearDemoData} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10"><Eraser size={13} /> <span className="hidden sm:inline">Clear</span></button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <nav className="hidden sm:flex w-56 shrink-0 flex-col gap-0.5 border-r border-white/8 bg-slate-950 p-3 overflow-y-auto">
          {NAV.map(({ id, label, svc, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/6 hover:text-white'}`}>
              <Icon size={15} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {svc && <span className={`text-[9px] uppercase tracking-wide ${tab === id ? 'text-white/70' : 'text-slate-600'}`}>{svc}</span>}
            </button>
          ))}
        </nav>

        <div className="sm:hidden absolute bottom-0 inset-x-0 z-10 flex overflow-x-auto border-t border-white/8 bg-slate-900 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-0.5 px-4 py-2 text-[10px] font-medium shrink-0 ${tab === id ? 'text-brand' : 'text-slate-500'}`}><Icon size={16} /> {label}</button>
          ))}
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-6">
          {tab === 'overview' && <Overview setTab={setTab} />}
          {tab === 'setup' && <Setup />}
          {tab === 'leads' && <Leads />}
          {tab === 'quotes' && <Quotes />}
          {tab === 'designs' && <Designs />}
          {tab === 'inbox' && <InboxView />}
          {tab === 'analytics' && <Analytics />}
          {tab === 'documents' && <Documents />}
          {tab === 'templates' && <Templates />}
          {tab === 'social' && <Social />}
          {tab === 'reviews' && <Reviews />}
          {tab === 'blog' && <Blog />}
          {tab === 'pages' && <Pages />}
          {tab === 'team' && <Team />}
        </main>
      </div>
    </div>
  )
}

function Overview({ setTab }) {
  const leads = getLeads(), quotes = getQuotes(), designs = getDesigns()
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

function Leads() {
  const leads = getLeads()
  const counts = LEAD_STATUSES.map((s) => ({ s, n: leads.filter((l) => l.status === s).length }))
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Leads <span className="text-slate-500 text-lg">({leads.length})</span></h1>
      <div className="flex flex-wrap gap-2">{counts.map(({ s, n }) => <div key={s} className="rounded-lg border border-white/8 px-3 py-1.5 text-xs"><Badge value={s} /> <span className="ml-1 text-slate-300 font-semibold">{n}</span></div>)}</div>
      {leads.length === 0 ? <Empty icon={Inbox} title="No leads yet" hint="Every contact-form submission lands here automatically. Try the form or “Load sample data”." /> : (
        <Card className="overflow-hidden"><div className="divide-y divide-white/6">
          {leads.map((l) => (
            <div key={l.id} className="grid sm:grid-cols-[1fr_auto] gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-white">{l.firstName} {l.lastName}</span>{l.structureType && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[11px] text-slate-300">{l.structureType}</span>}</div>
                <div className="mt-0.5 text-xs text-slate-400">{l.email}{l.phone ? ` · ${l.phone}` : ''}</div>
                {l.message && <p className="mt-1.5 text-sm text-slate-400 line-clamp-2">{l.message}</p>}
                {l.config && <p className="mt-1 text-xs text-brand-light">Design: {l.config}{l.price ? ` · $${Number(l.price).toLocaleString()}` : ''}</p>}
              </div>
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
  const quotes = getQuotes()
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Quote requests <span className="text-slate-500 text-lg">({quotes.length})</span></h1>
      {quotes.length === 0 ? <Empty icon={FileText} title="No quote requests yet" hint="When a visitor clicks “Get Formal Quote” in the 3D builder, their config + price lands here." /> : (
        <Card className="overflow-hidden"><div className="divide-y divide-white/6">
          {quotes.map((q) => (
            <div key={q.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0"><div className="font-semibold text-white truncate">{q.name || 'Builder visitor'}</div><div className="mt-0.5 text-sm text-slate-400 truncate">{q.config}</div></div>
              <div className="flex items-center gap-4 shrink-0">
                {q.price != null && <span className="font-display text-lg font-bold text-white">${Number(q.price).toLocaleString()}</span>}
                <select value={q.status} onChange={(e) => setStatus('quotes', q.id, e.target.value)} className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none">{QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                <AssigneeSelect kind="quotes" id={q.id} value={q.assignee} />
                <button onClick={() => removeRecord('quotes', q.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div></Card>
      )}
    </div>
  )
}

function Designs() {
  const designs = getDesigns()
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Customer designs <span className="text-slate-500 text-lg">({designs.length})</span></h1>
      {designs.length === 0 ? <Empty icon={Box} title="No saved designs yet" hint="Configurations from the 3D builder are saved here when a visitor requests a quote." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {designs.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{fmtDate(s.createdAt)}</span><button onClick={() => removeRecord('designs', s.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button></div>
              <div className="mt-2 font-display text-lg font-bold text-white">{s.width}×{s.length}×{s.height}ft</div>
              <div className="text-sm text-slate-400">{s.roofStyle || s.config}</div>
              {s.price != null && <div className="mt-3 font-display text-xl font-bold text-brand-light">${Number(s.price).toLocaleString()}</div>}
              <Link to="/builder" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Open builder <ExternalLink size={11} /></Link>
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
  const selCls = 'w-full rounded border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-brand focus:outline-none'
  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">Documents <span className="text-slate-500 text-sm">· Documenso e-sign</span></h1>
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
        <form onSubmit={(e) => { e.preventDefault(); if (form.title) { addDocument({ title: form.title, recipient: form.recipient, amount: form.amount ? Number(form.amount) : null, status: 'draft', templateId: form.template || null, assignee: form.assignee || null }); setForm({ title: '', recipient: '', amount: '', template: '', assignee: '' }) } }} className="grid sm:grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
          <Field label="Document" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Quote #1043 — …" />
          <Field label="Recipient email" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="customer@example.com" />
          <Field label="Amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
          <button className="flex items-center justify-center gap-1.5 rounded bg-brand px-3 py-2 text-sm font-semibold text-white"><Plus size={14} /> New</button>
        </form>
      </Card>
      {docs.length === 0 ? <Empty icon={PenSquare} title="No documents yet" hint="Create a quote or agreement above, send it for signature, and track its status." /> : (
        <Card className="overflow-hidden"><div className="divide-y divide-white/6">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0"><div className="font-medium text-white truncate">{d.title}</div><div className="text-xs text-slate-500">{d.recipient || 'no recipient'}{d.amount ? ` · $${Number(d.amount).toLocaleString()}` : ''} · {fmtDate(d.createdAt)}{d.templateId && getTemplate(d.templateId) ? ` · ${getTemplate(d.templateId).name}` : ''}</div></div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Badge value={d.status} />
                <AssigneeSelect kind="docs" id={d.id} value={d.assignee} />
                {d.status === 'draft' && <button onClick={() => setStatus('docs', d.id, 'sent')} className="rounded border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10">Send</button>}
                {d.status === 'sent' && <button onClick={() => signDocument(d.id)} className="flex items-center gap-1 rounded bg-emerald-600/80 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600"><Check size={12} /> Sign</button>}
                <button onClick={() => removeRecord('docs', d.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div></Card>
      )}
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

function Team() {
  const users = getUsers()
  const [edit, setEdit] = useState(null) // user draft (with id = editing)
  const [del, setDel] = useState(null)   // { user, reassignTo }
  const saveUser = () => { if (!edit.name) return; if (edit.id) updateUser(edit.id, edit); else addUser(edit); setEdit(null) }
  const confirmDelete = () => { removeUser(del.user.id, del.reassignTo || null); setDel(null) }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-white">Team <span className="text-slate-500 text-lg">({users.length})</span></h1>
        <button onClick={() => setEdit({ name: '', email: '', role: 'sales', active: true })} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white"><UserPlus size={13} /> Add user</button>
      </div>
      <p className="text-xs text-slate-500">Manage who can sign in, what each role can do, and who owns every lead, quote, chat and document.</p>

      {edit && (
        <Card className="p-4 space-y-3 border-brand/40">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold text-white">{edit.id ? `Edit ${edit.name}` : 'Add team member'}</span><button onClick={() => setEdit(null)} className="text-slate-500 hover:text-white"><X size={16} /></button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Jane Doe" />
            <Field label="Email" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} placeholder="jane@company.com" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 items-end">
            <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Role</span>
              <select value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value })} className={selCls}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</select>
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
          {Object.entries(ROLES).map(([key, r]) => (
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
