import { useEffect, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard, Inbox, FileText, Box, Star, Newspaper, Files,
  ArrowLeft, Trash2, ExternalLink, Database, Eraser, Sparkles,
} from 'lucide-react'
import {
  getLeads, getQuotes, getDesigns, getReviews, reviewSummary, getBlogPosts, getPages,
  setStatus, removeRecord, loadSampleData, clearDemoData,
} from '../data/adminData'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Inbox },
  { id: 'quotes', label: 'Quotes', icon: FileText },
  { id: 'designs', label: 'Designs', icon: Box },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'blog', label: 'Blog', icon: Newspaper },
  { id: 'pages', label: 'Pages', icon: Files },
]

const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost']
const QUOTE_STATUSES = ['open', 'sent', 'accepted', 'declined']
const STATUS_COLOR = {
  new: 'bg-blue-500/15 text-blue-300', contacted: 'bg-amber-500/15 text-amber-300',
  quoted: 'bg-violet-500/15 text-violet-300', won: 'bg-emerald-500/15 text-emerald-300',
  lost: 'bg-slate-500/15 text-slate-400', open: 'bg-blue-500/15 text-blue-300',
  sent: 'bg-amber-500/15 text-amber-300', accepted: 'bg-emerald-500/15 text-emerald-300',
  declined: 'bg-slate-500/15 text-slate-400',
}

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '' }
}

// Re-read on any data change (same tab via custom event, other tabs via storage).
function useAdmin() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    const h = () => force()
    window.addEventListener('qmc-admin-change', h)
    window.addEventListener('storage', h)
    return () => { window.removeEventListener('qmc-admin-change', h); window.removeEventListener('storage', h) }
  }, [])
  return {
    leads: getLeads(), quotes: getQuotes(), designs: getDesigns(),
    reviews: getReviews(), reviewSum: reviewSummary(), blog: getBlogPosts(), pages: getPages(),
  }
}

function StatusBadge({ value }) {
  return <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_COLOR[value] || 'bg-slate-500/15 text-slate-400'}`}>{value}</span>
}

function Empty({ icon: Icon, title, hint }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 py-16 text-center">
      <Icon size={28} className="mx-auto text-slate-600 mb-3" />
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">{hint}</p>
    </div>
  )
}

function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-white/8 bg-white/[0.03] ${className}`}>{children}</div>
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

export default function AdminDemoPage() {
  const [tab, setTab] = useState('overview')
  const d = useAdmin()

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-slate-200">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-white/8 bg-slate-900 px-3 sm:px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white shrink-0">
            <ArrowLeft size={15} /> <span className="hidden sm:inline">Back to site</span>
          </Link>
          <div className="hidden sm:block h-5 w-px bg-white/10" />
          <span className="font-display font-bold text-white truncate">QMC Admin</span>
          <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-light">Demo</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={loadSampleData} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10" title="Write example rows into local storage">
            <Sparkles size={13} /> <span className="hidden sm:inline">Load sample data</span>
          </button>
          <button onClick={clearDemoData} className="flex items-center gap-1.5 rounded border border-white/15 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-white/10" title="Clear captured data">
            <Eraser size={13} /> <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <nav className="hidden sm:flex w-52 shrink-0 flex-col gap-0.5 border-r border-white/8 bg-slate-950 p-3 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => {
            const count = id === 'leads' ? d.leads.length : id === 'quotes' ? d.quotes.length
              : id === 'designs' ? d.designs.length : id === 'reviews' ? d.reviews.length
              : id === 'blog' ? d.blog.length : null
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'bg-brand text-white' : 'text-slate-400 hover:bg-white/6 hover:text-white'}`}>
                <span className="flex items-center gap-2.5"><Icon size={15} /> {label}</span>
                {count != null && <span className={`text-[11px] ${tab === id ? 'text-white/80' : 'text-slate-500'}`}>{count}</span>}
              </button>
            )
          })}
        </nav>

        {/* Mobile tab bar */}
        <div className="sm:hidden absolute bottom-0 inset-x-0 z-10 flex overflow-x-auto border-t border-white/8 bg-slate-900 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 text-[10px] font-medium shrink-0 ${tab === id ? 'text-brand' : 'text-slate-500'}`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-6">
          {tab === 'overview' && <Overview d={d} setTab={setTab} />}
          {tab === 'leads' && <Leads leads={d.leads} />}
          {tab === 'quotes' && <Quotes quotes={d.quotes} />}
          {tab === 'designs' && <Designs designs={d.designs} />}
          {tab === 'reviews' && <Reviews reviews={d.reviews} sum={d.reviewSum} />}
          {tab === 'blog' && <Blog posts={d.blog} />}
          {tab === 'pages' && <Pages pages={d.pages} />}
        </main>
      </div>
    </div>
  )
}

function Overview({ d, setTab }) {
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <button onClick={() => setTab('leads')} className="text-left"><StatCard icon={Inbox} label="Leads" value={d.leads.length} sub="from contact form" /></button>
        <button onClick={() => setTab('quotes')} className="text-left"><StatCard icon={FileText} label="Quote requests" value={d.quotes.length} sub="builder + contact" /></button>
        <button onClick={() => setTab('designs')} className="text-left"><StatCard icon={Box} label="Saved designs" value={d.designs.length} sub="from 3D builder" /></button>
        <button onClick={() => setTab('reviews')} className="text-left"><StatCard icon={Star} label="Reviews" value={d.reviewSum.total} sub={`${d.reviewSum.rating.toFixed(1)}★ average`} /></button>
        <button onClick={() => setTab('blog')} className="text-left"><StatCard icon={Newspaper} label="Blog posts" value={d.blog.length} sub="published" /></button>
        <button onClick={() => setTab('pages')} className="text-left"><StatCard icon={Files} label="Pages" value={d.pages.core.length} sub={`+ ${d.pages.generated.reduce((n, g) => n + g.count, 0).toLocaleString()} generated`} /></button>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Recent leads</h2>
        {d.leads.length === 0 ? (
          <p className="text-sm text-slate-500">No leads yet. Submit the <Link to="/contact" className="text-brand hover:underline">contact form</Link> (or “Load sample data”) to see them appear here live.</p>
        ) : (
          <div className="space-y-2">
            {d.leads.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/6 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{l.firstName} {l.lastName} <span className="text-slate-500 font-normal">· {l.structureType || 'General'}</span></div>
                  <div className="text-xs text-slate-500 truncate">{l.email}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0"><StatusBadge value={l.status} /><span className="text-xs text-slate-500">{fmtDate(l.createdAt)}</span></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Leads({ leads }) {
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Leads <span className="text-slate-500 text-lg">({leads.length})</span></h1>
      {leads.length === 0 ? (
        <Empty icon={Inbox} title="No leads captured yet" hint="Every contact-form submission lands here automatically. Try the contact form, or click “Load sample data”." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-white/6">
            {leads.map((l) => (
              <div key={l.id} className="grid sm:grid-cols-[1fr_auto] gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{l.firstName} {l.lastName}</span>
                    {l.structureType && <span className="rounded bg-white/8 px-1.5 py-0.5 text-[11px] text-slate-300">{l.structureType}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{l.email}{l.phone ? ` · ${l.phone}` : ''}</div>
                  {l.message && <p className="mt-1.5 text-sm text-slate-400 line-clamp-2">{l.message}</p>}
                  {l.config && <p className="mt-1 text-xs text-brand-light">Design: {l.config}{l.price ? ` · $${Number(l.price).toLocaleString()}` : ''}</p>}
                </div>
                <div className="flex sm:flex-col items-end gap-2 shrink-0">
                  <span className="text-xs text-slate-500">{fmtDate(l.createdAt)}</span>
                  <select value={l.status} onChange={(e) => setStatus('leads', l.id, e.target.value)}
                    className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none">
                    {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeRecord('leads', l.id)} className="text-slate-600 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Quotes({ quotes }) {
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Quote requests <span className="text-slate-500 text-lg">({quotes.length})</span></h1>
      {quotes.length === 0 ? (
        <Empty icon={FileText} title="No quote requests yet" hint="When a visitor clicks “Get Formal Quote” in the 3D builder, their configuration + price is captured here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-white/6">
            {quotes.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{q.name || 'Builder visitor'}</div>
                  <div className="mt-0.5 text-sm text-slate-400 truncate">{q.config}</div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {q.price != null && <span className="font-display text-lg font-bold text-white">${Number(q.price).toLocaleString()}</span>}
                  <select value={q.status} onChange={(e) => setStatus('quotes', q.id, e.target.value)}
                    className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-brand focus:outline-none">
                    {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeRecord('quotes', q.id)} className="text-slate-600 hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Designs({ designs }) {
  return (
    <div className="space-y-4 max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-white">Customer designs <span className="text-slate-500 text-lg">({designs.length})</span></h1>
      {designs.length === 0 ? (
        <Empty icon={Box} title="No saved designs yet" hint="Configurations built in the 3D builder are saved here when a visitor requests a quote." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {designs.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{fmtDate(s.createdAt)}</span>
                <button onClick={() => removeRecord('designs', s.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
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

function Reviews({ reviews, sum }) {
  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold text-white">Reviews <span className="text-slate-500 text-lg">({reviews.length})</span></h1>
        <span className="text-sm text-slate-400">{sum.rating.toFixed(1)}★ · {sum.total} total</span>
      </div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{r.author}</span>
                <span className="text-amber-400 text-sm">{'★'.repeat(r.rating)}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.date && <span className="text-xs text-slate-500">{r.date}</span>}
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">Published</span>
              </div>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">{r.text}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Blog({ posts }) {
  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">Blog <span className="text-slate-500 text-lg">({posts.length})</span></h1>
      <Card className="overflow-hidden">
        <div className="divide-y divide-white/6">
          {posts.map((p) => (
            <div key={p.slug} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{p.title}</div>
                <div className="mt-0.5 text-xs text-slate-500">{fmtDate(p.published_at)} · {p.tags?.[0]?.name || 'Article'} · {p.reading_time} min read</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">Published</span>
                <Link to={`/blog/${p.slug}`} target="_blank" className="text-slate-500 hover:text-white"><ExternalLink size={14} /></Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function Pages({ pages }) {
  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="font-display text-2xl font-bold text-white">Pages</h1>
      <Card className="overflow-hidden">
        <div className="divide-y divide-white/6">
          {pages.core.map((p) => (
            <div key={p.path} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium text-white">{p.name}</div>
                <div className="text-xs text-slate-500">{p.path}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-300">{p.type}</span>
                <Link to={p.path} target="_blank" className="text-slate-500 hover:text-white"><ExternalLink size={14} /></Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Auto-generated</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {pages.generated.map((g) => (
            <Card key={g.name} className="p-5">
              <div className="font-display text-3xl font-bold text-white">{g.count.toLocaleString()}</div>
              <div className="text-sm text-slate-300">{g.name}</div>
              <Link to={g.sample} target="_blank" className="mt-2 inline-flex items-center gap-1 text-xs text-brand hover:underline">View sample <ExternalLink size={11} /></Link>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
