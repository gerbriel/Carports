// ─────────────────────────────────────────────────────────────────────────────
// Self-hosted reviews store — NO external API, no third-party SaaS.
//
// Reviews live in a local JSON file (server/data/reviews.json) that YOU own and
// version-control. The site serves them straight from there: unlimited reviews,
// full control over which ones show, and nothing to break when an API changes or
// a vendor goes down. Curate by hand-editing the JSON, or with the helper:
//   node server/scripts/add-review.mjs --author "Mike T." --rating 5 \
//        --location "Fresno, CA" --date "August 2024" --text "Great work…"
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'

// Stable identity for de-duplication when adding reviews.
function reviewKey(r) {
  return `${(r.author || '').toLowerCase()}|${(r.text || '').slice(0, 40).toLowerCase()}`
}

const clampRating = (n) => Math.max(1, Math.min(5, Math.round(Number(n) || 5)))

// Normalize a review to the shape the homepage cards expect.
export function normalizeReview(r) {
  return {
    author: String(r.author || 'Verified Customer').trim(),
    location: String(r.location || '').trim(),
    rating: clampRating(r.rating),
    text: String(r.text || '').trim(),
    date: String(r.date || '').trim(),
  }
}

export async function readStore(file) {
  try {
    const data = JSON.parse(await readFile(file, 'utf8'))
    if (!Array.isArray(data.reviews)) return null
    return data
  } catch {
    return null // missing/invalid → caller falls back
  }
}

export async function writeStore(file, data) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

// Add reviews to a store (deduped), recompute the headline rating from the cards,
// and sort best-first. `total` is preserved (your real Google review count, which
// you set once in the JSON) unless overridden.
export function upsertReviews(store, incoming = [], opts = {}) {
  const base = store || { rating: 5, total: 0, source: 'curated', reviews: [] }
  const byKey = new Map()
  for (const r of base.reviews || []) byKey.set(reviewKey(r), normalizeReview(r))
  for (const r of incoming) {
    const n = normalizeReview(r)
    if (n.text) byKey.set(reviewKey(n), n)
  }
  const reviews = [...byKey.values()].sort((a, b) => b.rating - a.rating)
  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 5
  return {
    rating: opts.rating ?? base.rating ?? Number(avg.toFixed(1)),
    total: opts.total ?? Math.max(base.total || 0, reviews.length),
    source: 'curated',
    updatedAt: new Date().toISOString(),
    reviews,
  }
}
