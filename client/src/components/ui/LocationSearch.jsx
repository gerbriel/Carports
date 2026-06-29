import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MapPin, X, Star } from 'lucide-react'
import { CITIES, isFeaturedCity } from '../../data/cities'

// Pre-built, lowercased search index over all 482 cities (name + county).
const INDEX = CITIES.map((c) => ({
  slug: c.slug,
  name: c.name,
  county: c.county,
  region: c.region,
  featured: isFeaturedCity(c.slug),
  hay: `${c.name} ${c.county} ${c.region}`.toLowerCase(),
  nameLower: c.name.toLowerCase(),
}))

function rank(item, q) {
  // Lower score = better match.
  if (item.nameLower === q) return 0
  if (item.nameLower.startsWith(q)) return 1
  if (item.county.toLowerCase().startsWith(q)) return 2
  if (item.nameLower.includes(q)) return 3
  if (item.hay.includes(q)) return 4
  return 99
}

export default function LocationSearch({
  variant = 'light', // 'light' (on dark hero) | 'dark' (on white bg)
  placeholder = 'Search your city or county…',
  limit = 8,
}) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const results = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (query.length < 2) return []
    return INDEX.map((item) => ({ item, score: rank(item, query) }))
      .filter((r) => r.score < 99)
      .sort(
        (a, b) =>
          a.score - b.score ||
          Number(b.item.featured) - Number(a.item.featured) ||
          a.item.name.localeCompare(b.item.name),
      )
      .slice(0, limit)
      .map((r) => r.item)
  }, [q, limit])

  useEffect(() => setActive(0), [q])

  // Close on outside click.
  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function go(item) {
    if (!item) return
    navigate(`/locations/${item.slug}`)
    setQ('')
    setOpen(false)
    inputRef.current?.blur()
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) return
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
      setOpen(false)
    }
  }

  const showDropdown = open && q.trim().length >= 2
  const dark = variant === 'dark'

  return (
    <div ref={wrapRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search
          size={18}
          className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${
            dark ? 'text-slate-400' : 'text-slate-300'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search service-area cities"
          autoComplete="off"
          className={
            dark
              ? 'w-full rounded-lg border border-slate-200 bg-white py-3.5 pl-12 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand'
              : 'w-full rounded-lg border border-white/15 bg-white/10 py-3.5 pl-12 pr-10 text-sm text-white placeholder-slate-400 backdrop-blur focus:border-brand focus:bg-white/15 focus:outline-none focus:ring-1 focus:ring-brand'
          }
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ('')
              inputRef.current?.focus()
            }}
            aria-label="Clear search"
            className={`absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 ${
              dark ? 'text-slate-400 hover:text-slate-700' : 'text-slate-400 hover:text-white'
            }`}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              No match for “{q.trim()}”. We build statewide — try a nearby city or{' '}
              <span className="font-medium text-brand">contact us</span>.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((item, i) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === active ? 'bg-brand/8' : 'hover:bg-slate-50'
                    }`}
                  >
                    <MapPin size={15} className="shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {item.name}, CA
                      </span>
                      <span className="block truncate text-xs text-slate-500">{item.county}</span>
                    </span>
                    {item.featured && (
                      <Star size={13} className="shrink-0 text-brand" aria-label="Primary service hub" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
