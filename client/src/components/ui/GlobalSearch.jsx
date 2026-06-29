import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, MapPin, Wrench, FileText, Newspaper, Box, CornerDownLeft } from 'lucide-react'
import { SEARCH_ENTRIES, TYPE_ORDER } from '../../data/searchIndex'
import { BLOG_POSTS } from '../../data/blogPosts'

const TYPE_META = {
  Page: { icon: FileText, label: 'Page' },
  Service: { icon: Wrench, label: 'Service' },
  Location: { icon: MapPin, label: 'Location' },
  Article: { icon: Newspaper, label: 'Article' },
}

// Lower score = better match.
function rank(e, q, words) {
  if (e._title === q) return 0
  if (e._title.startsWith(q)) return 1
  if (e._title.split(/\s+/).some((w) => w.startsWith(q))) return 2
  if (e._title.includes(q)) return 3
  if (words.every((w) => e._hay.includes(w))) return 4
  return 99
}

// Rendered only while open (so the Ghost fetch is deferred). `onClose` dismisses.
export default function GlobalSearch({ onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Bundled blog posts become searchable entries.
  const blogEntries = useMemo(
    () =>
      BLOG_POSTS.map((p, i) => ({
        id: `Article-${i}`,
        type: 'Article',
        title: p.title,
        subtitle: p.tags?.[0]?.name || 'Article',
        path: `/blog/${p.slug}`,
        _title: (p.title || '').toLowerCase(),
        _hay: `${p.title || ''} ${p.excerpt || ''} ${(p.tags || []).map((t) => t.name).join(' ')}`.toLowerCase(),
      })),
    [],
  )

  const all = useMemo(() => [...SEARCH_ENTRIES, ...blogEntries], [blogEntries])

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return []
    const words = query.split(/\s+/).filter(Boolean)
    return all
      .map((e) => ({ e, s: rank(e, query, words) }))
      .filter((r) => r.s < 99)
      .sort(
        (a, b) =>
          a.s - b.s ||
          (TYPE_ORDER[a.e.type] ?? 9) - (TYPE_ORDER[b.e.type] ?? 9) ||
          a.e.title.localeCompare(b.e.title),
      )
      .slice(0, 12)
      .map((r) => r.e)
  }, [q, all])

  // Focus the input on mount.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => setActive(0), [q])

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function go(item) {
    if (!item) return
    onClose?.()
    navigate(item.path)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Escape') {
      onClose?.()
    }
  }

  const typed = q.trim().length >= 2
  const showEmpty = typed && results.length === 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Search the site"
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Input row */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search carports, garages, locations, articles..."
            aria-label="Search all content"
            autoComplete="off"
            className="w-full bg-transparent py-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results / states */}
        {!typed ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Search services, every California, Arizona &amp; Nevada location, articles, and more.
          </div>
        ) : showEmpty ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            No matches for &ldquo;{q.trim()}&rdquo;. Try a service or a city, or{' '}
            <button type="button" onClick={() => go({ path: '/contact' })} className="font-medium text-brand">
              contact us
            </button>
            .
          </div>
        ) : (
          <ul ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
            {results.map((item, i) => {
              const meta = TYPE_META[item.type] || TYPE_META.Page
              const Icon = item.path === '/builder' ? Box : meta.icon
              return (
                <li key={item.id || item.path}>
                  <button
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === active ? 'bg-brand/8' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        i === active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>
                    </span>
                    <span className="hidden shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:block">
                      {meta.label}
                    </span>
                    {i === active && <CornerDownLeft size={14} className="shrink-0 text-brand" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-300 bg-white px-1">↑</kbd>
            <kbd className="rounded border border-slate-300 bg-white px-1">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-slate-300 bg-white px-1">enter</kbd>
            open
            <span className="mx-1 text-slate-300">·</span>
            <kbd className="rounded border border-slate-300 bg-white px-1">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  )
}
