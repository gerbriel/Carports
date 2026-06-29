#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Add (or update) a review in the self-hosted store — no API, no SaaS.
//
//   node server/scripts/add-review.mjs \
//     --author "Mike T." --rating 5 --location "Fresno, CA" \
//     --date "August 2024" --text "Quality Metal Carports built our 30x40 garage…"
//
// Optional store-level fields (your real Google totals shown in the headline):
//   --total 52        set the "(N reviews)" count
//   --avg 4.9         set the headline average rating
//
// Just paste your best Google reviews in one at a time. Re-running with the same
// author + text updates in place (deduped). Then restart/redeploy the server.
// ─────────────────────────────────────────────────────────────────────────────

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readStore, writeStore, upsertReviews } from '../lib/reviews.js'

// Reviews are bundled with the site, so the canonical file lives in the client.
// After running this, rebuild the client to publish the change.
const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'client', 'src', 'data', 'reviews.json')

// Minimal --flag value parser.
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      out[key] = val
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

if (!args.text || !args.author) {
  console.error('Required: --author "Name" --text "Review text"')
  console.error('Optional: --rating 5 --location "City, ST" --date "August 2024" --total 52 --avg 4.9')
  process.exit(1)
}

const store = (await readStore(FILE)) || { rating: 5, total: 0, source: 'curated', reviews: [] }

const updated = upsertReviews(
  store,
  [{
    author: args.author,
    rating: args.rating ?? 5,
    location: args.location ?? '',
    date: args.date ?? '',
    text: args.text,
  }],
  {
    total: args.total != null ? Number(args.total) : undefined,
    rating: args.avg != null ? Number(args.avg) : undefined,
  },
)

await writeStore(FILE, updated)
console.log(`✓ Saved. Store now has ${updated.reviews.length} review(s) · headline ${updated.rating}★ (${updated.total} total).`)
console.log(`  ${FILE}`)
