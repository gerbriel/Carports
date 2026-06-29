/**
 * QMC Backend Server
 *
 * Handles:
 *   POST /leads         — Receives contact form submissions, forwards to Twenty CRM
 *
 * Required env vars (see ../.env):
 *   TWENTY_API_URL          — Base URL of your self-hosted Twenty CRM instance
 *   TWENTY_API_KEY          — Twenty CRM API key
 *   PORT                    — Server port (default 4000)
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
// Load the repo-root .env for local dev (Docker injects env directly, which wins
// since dotenv doesn't override already-set process.env vars).
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '..', '.env') })

import express from 'express'
import fetch from 'node-fetch'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 4000
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY   // optional (geocoding fallback only; reviews are self-hosted)
// ── Open-source geo backends (no API key) ──────────────────────────────────────
// Elevation: self-hosted Open-Elevation (https://github.com/Jorl17/open-elevation).
// Defaults to the public instance so it works out of the box; point it at your own
// host for speed/reliability, e.g. OPEN_ELEVATION_URL=http://localhost:8080/api/v1/lookup
const OPEN_ELEVATION_URL = process.env.OPEN_ELEVATION_URL || 'https://api.open-elevation.com/api/v1/lookup'
// Geocoding: Nominatim (OpenStreetMap). Public instance by default; self-host or use
// a provider URL via NOMINATIM_URL (must be the /search endpoint base).
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search'
const TWENTY_API_URL = process.env.TWENTY_API_URL
const TWENTY_API_KEY = process.env.TWENTY_API_KEY

// Reviews are bundled with the site (client/src/data/reviews.json) and rendered
// directly — no server endpoint or fetch. Edit that file (or run
// server/scripts/add-review.mjs) and rebuild the client to update them.

// GET /geocode?q=ADDRESS — Address → { lat, lng, label }.
// Tries Google Geocoding first (far better US street-address coverage), then falls
// back to server-side Nominatim with a proper User-Agent (OSM's usage policy needs
// one — a browser can't set it, which is why direct browser calls get blocked/miss).
app.get('/geocode', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const q = (req.query.q || '').toString().trim()
  if (!q) return res.status(400).json({ error: 'Missing q' })

  // 1) Google Geocoding API (uses the existing key; requires "Geocoding API" enabled)
  if (GOOGLE_API_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_API_KEY}`
      const r = await fetch(url)
      const d = await r.json()
      if (d.status === 'OK' && d.results?.length) {
        const g = d.results[0]
        return res.json({ lat: g.geometry.location.lat, lng: g.geometry.location.lng, label: g.formatted_address, source: 'google' })
      }
      if (d.status === 'REQUEST_DENIED') console.error('Google Geocoding denied:', d.error_message)
    } catch (err) {
      console.error('Google Geocoding failed:', err.message)
    }
  }

  // 2) Nominatim — OpenStreetMap, no key (server-side UA per OSM policy). This is
  //    the default geocoder; set NOMINATIM_URL to a self-hosted instance for volume.
  try {
    const url = `${NOMINATIM_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
    const r = await fetch(url, { headers: { 'User-Agent': 'QualityMetalCarports-Builder/1.0 (+https://qualitymetalcarportsca.com)', Accept: 'application/json' } })
    const d = await r.json()
    if (Array.isArray(d) && d.length) {
      return res.json({ lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), label: d[0].display_name, source: 'osm' })
    }
  } catch (err) {
    console.error('Nominatim geocoding failed:', err.message)
  }

  return res.status(404).json({ error: 'Address not found' })
})

// GET /elevation?lat=&lng=&radiusM=&n= — n×n elevation grid (metres) around a point
// via Open-Elevation (open source, no key). Row 0 = NORTH (max lat), col 0 = WEST
// (min lng), so it lines up with the satellite tile + terrain mesh. 502 if the
// elevation host is unreachable (the builder then renders flat terrain).
app.get('/elevation', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng)
  const radiusM = Math.min(2000, parseFloat(req.query.radiusM) || 250)
  const n = Math.min(32, Math.max(2, parseInt(req.query.n) || 22))   // n² points per request
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat/lng required' })

  const M_PER_DEG = 111320
  const dLat = radiusM / M_PER_DEG
  const dLng = radiusM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180))
  // Open-Elevation returns results IN THE SAME ORDER as the posted locations, so the
  // row-major (north→south, west→east) grid order is preserved in the response.
  const locations = []
  for (let r = 0; r < n; r++) {
    const la = lat + dLat - 2 * dLat * (r / (n - 1))
    for (let c = 0; c < n; c++) locations.push({ latitude: la, longitude: lng - dLng + 2 * dLng * (c / (n - 1)) })
  }
  try {
    const r = await fetch(OPEN_ELEVATION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ locations }),
    })
    if (!r.ok) { console.error('Open-Elevation HTTP', r.status, '@', OPEN_ELEVATION_URL); return res.status(502).json({ error: 'Elevation lookup failed' }) }
    const d = await r.json()
    if (Array.isArray(d.results) && d.results.length === n * n) {
      return res.json({ n, elevations: d.results.map((x) => x.elevation) })
    }
    console.error('Open-Elevation: unexpected response', d?.error ?? `results=${d.results?.length}`)
    return res.status(502).json({ error: 'Elevation lookup failed' })
  } catch (err) {
    console.error('Elevation fetch failed:', err.message)
    return res.status(502).json({ error: 'Elevation lookup failed' })
  }
})

// ── Overture Maps buildings (open: OSM + Microsoft + Google, with heights) ─────
// GET /buildings?lat=&lng=&radiusM= → { buildings: [{ ring:[[lng,lat]...], height,
// levels, kind }] }. Queries the PUBLIC Overture GeoParquet on S3 with DuckDB,
// bbox-filtered (the parquet has a `bbox` struct, so only relevant row-groups are
// read). Far better residential coverage + real heights than OSM alone. Returns
// 503 if DuckDB isn't installed / the release is unset, so the client falls back
// to OSM-only with no regression.
//   Setup:  cd server && npm install duckdb
//           OVERTURE_RELEASE=2025-06-25.0   (set to a current Overture release)
const OVERTURE_RELEASE = process.env.OVERTURE_RELEASE || '2025-06-25.0'
let _duckPromise = null
function duckdbConn() {
  if (_duckPromise) return _duckPromise
  _duckPromise = (async () => {
    const duckdb = (await import('duckdb')).default        // throws if not installed
    const db = new duckdb.Database(':memory:')
    const con = db.connect()
    const run = (sql) => new Promise((ok, no) => con.run(sql, (e) => (e ? no(e) : ok())))
    await run("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    const all = (sql) => new Promise((ok, no) => con.all(sql, (e, rows) => (e ? no(e) : ok(rows))))
    return { all }
  })()
  return _duckPromise
}

app.get('/buildings', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const lat = parseFloat(req.query.lat), lng = parseFloat(req.query.lng)
  const radiusM = Math.min(1500, parseFloat(req.query.radiusM) || 250)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat/lng required' })
  const M_PER_DEG = 111320
  const dLat = radiusM / M_PER_DEG
  const dLng = radiusM / (M_PER_DEG * Math.cos((lat * Math.PI) / 180))
  const minLng = lng - dLng, maxLng = lng + dLng, minLat = lat - dLat, maxLat = lat + dLat
  const src = `s3://overturemaps-us-west-2/release/${OVERTURE_RELEASE}/theme=buildings/type=building/*`
  const sql =
    `SELECT ST_AsGeoJSON(geometry) AS gj, height, num_floors AS levels, subtype, class ` +
    `FROM read_parquet('${src}', hive_partitioning=1) ` +
    `WHERE bbox.xmin <= ${maxLng} AND bbox.xmax >= ${minLng} ` +
    `AND bbox.ymin <= ${maxLat} AND bbox.ymax >= ${minLat} LIMIT 6000;`
  try {
    const { all } = await duckdbConn()
    const rows = await all(sql)
    const buildings = []
    for (const r of rows) {
      let geo; try { geo = JSON.parse(r.gj) } catch { continue }
      // Outer ring(s): Polygon → [ring]; MultiPolygon → first ring of each poly.
      const rings = geo.type === 'Polygon' ? [geo.coordinates[0]]
        : geo.type === 'MultiPolygon' ? geo.coordinates.map((p) => p[0]) : []
      for (const ring of rings) {
        if (Array.isArray(ring) && ring.length >= 3) {
          buildings.push({ ring, height: r.height ?? null, levels: r.levels ?? null, kind: r.subtype || r.class || null })
        }
      }
    }
    res.json({ buildings, release: OVERTURE_RELEASE })
  } catch (err) {
    console.error('Overture buildings failed:', err.message)
    res.status(503).json({ error: 'Overture not available', detail: err.message })
  }
})

// POST /leads — Forward contact form to Twenty CRM
app.post('/leads', async (req, res) => {
  const { firstName, lastName, email, phone, structureType, message } = req.body

  if (!firstName || !email) {
    return res.status(400).json({ error: 'firstName and email are required' })
  }

  // Forward to Twenty CRM via their REST API if configured
  if (TWENTY_API_URL && TWENTY_API_KEY) {
    try {
      const twentyRes = await fetch(`${TWENTY_API_URL}/api/people`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TWENTY_API_KEY}`,
        },
        body: JSON.stringify({
          firstName: { firstName, lastName },
          emails: { primaryEmail: email },
          phones: phone ? { primaryPhoneNumber: phone, primaryPhoneCountryCode: '+1' } : undefined,
          note: [structureType && `Structure: ${structureType}`, message].filter(Boolean).join('\n\n'),
        }),
      })

      if (!twentyRes.ok) {
        const err = await twentyRes.text()
        console.error('Twenty CRM error:', err)
      }
    } catch (err) {
      console.error('Twenty CRM request failed:', err.message)
    }
  } else {
    // Log locally if Twenty isn't configured
    console.log('New lead received:', { firstName, lastName, email, phone, structureType })
    console.log('Message:', message)
  }

  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`QMC server running on port ${PORT}`)
  if (!TWENTY_API_URL) console.log('  Twenty CRM: not configured (TWENTY_API_URL missing)')
})
