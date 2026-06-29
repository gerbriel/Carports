import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ── Free, no-key site map (OpenStreetMap) ─────────────────────────────────────
// Address → lat/lng via Nominatim (free geocoder), then real building footprints
// around that point via the Overpass API. Footprints are projected to local FEET
// (the scene's unit) and extruded to 3-D so the surroundings render as a clean
// "massing model" map in the same Three.js scene as the configured building.

const FT_PER_M = 3.28084
const M_PER_DEG_LAT = 111320          // ~constant
const DEFAULT_LEVEL_M = 3.2           // assumed storey height when only levels are tagged
const DEFAULT_HEIGHT_M = 6            // ~2 storeys when a building has no height/levels

// Address string → { lat, lng, label }. Throws on miss.
// Prefers the SERVER geocoder (/api/geocode → Google Geocoding + server-side
// Nominatim with a proper User-Agent) which is far more reliable for US street
// addresses. Falls back to a direct browser Nominatim call when the backend isn't
// running (e.g. a static deploy), so it still works key-free.
export async function geocodeAddress(address) {
  const q = address.trim()
  if (!q) throw new Error('Enter an address')

  // 1) Server geocoder
  try {
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
    if (r.ok) {
      const d = await r.json()
      if (d?.lat != null && d?.lng != null) return { lat: d.lat, lng: d.lng, label: d.label }
    } else if (r.status === 404) {
      // Both Google + server Nominatim found nothing → genuinely not in the data.
      throw new Error('Address not found — try “street number, city, state” (or a nearby cross-street).')
    }
    // 400/500/route-missing → fall through to the browser fallback
  } catch (e) {
    if (String(e?.message).startsWith('Address not found')) throw e
    // network error / no backend → fall through
  }

  // 2) Direct Nominatim fallback (browser)
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Geocoder error (${res.status})`)
  const data = await res.json()
  if (!Array.isArray(data) || data.length === 0) throw new Error('Address not found — try adding the city and state.')
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name }
}

export { FT_PER_M }

// Esri "World Imagery" satellite export for a square-in-metres patch around the
// address. Free, no key, CORS-enabled (so the browser can use it as a WebGL
// texture). Width is widened by 1/cos(lat) so the equirectangular tile isn't
// stretched when mapped onto the square ground patch.
export function esriSatUrl(lat, lng, radiusM = 250, maxPx = 2560) {
  const dLat = radiusM / M_PER_DEG_LAT
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`
  const h = 1536
  const w = Math.min(maxPx, Math.round(h / Math.cos((lat * Math.PI) / 180)))
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=jpg&f=image`
}

// n×n elevation grid (metres) around the point via the server (/api/elevation →
// Google Elevation). Returns null when unavailable (no backend / no key) so the
// terrain falls back to flat-with-satellite.
export async function fetchElevationGrid(lat, lng, radiusM = 250, n = 22) {
  try {
    const r = await fetch(`/api/elevation?lat=${lat}&lng=${lng}&radiusM=${radiusM}&n=${n}`)
    if (!r.ok) return null
    const d = await r.json()
    if (!Array.isArray(d?.elevations) || d.elevations.length !== n * n) return null
    return { n, elevM: d.elevations }
  } catch {
    return null
  }
}

// Project a lat/lng to local scene FEET relative to the map centre (east = +X,
// north = −Z so the model faces the same way the rest of the scene does).
function projectToFeet(lat, lng, lat0, lng0) {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180)
  const eastM  = (lng - lng0) * mPerDegLng
  const northM = (lat - lat0) * M_PER_DEG_LAT
  return { x: eastM * FT_PER_M, z: -northM * FT_PER_M }
}

// Building height in FEET from OSM tags (height → levels → default).
function heightFt(tags) {
  const h = parseFloat(tags?.height)                       // metres (may be "12 m")
  if (!Number.isNaN(h)) return Math.max(6, h * FT_PER_M)
  const lv = parseFloat(tags?.['building:levels'])
  if (!Number.isNaN(lv)) return Math.max(6, lv * DEFAULT_LEVEL_M * FT_PER_M)
  return DEFAULT_HEIGHT_M * FT_PER_M
}

// Coarse building "kind" from OSM tags, so the massing model can colour by use
// (house / commercial / outbuilding / other) instead of one uniform grey.
function buildingKind(tags) {
  const t = (tags?.building || '').toLowerCase()
  const amenity = (tags?.amenity || '').toLowerCase()
  if (['garage', 'garages', 'shed', 'carport', 'hut', 'cabin', 'barn', 'farm_auxiliary', 'roof'].includes(t))
    return 'outbuilding'
  if (['house', 'detached', 'residential', 'semidetached_house', 'bungalow', 'apartments', 'terrace', 'dormitory'].includes(t))
    return 'house'
  if (['commercial', 'retail', 'industrial', 'warehouse', 'office', 'supermarket', 'service', 'hangar', 'civic', 'public', 'school', 'hospital', 'church', 'hotel'].includes(t)
    || amenity)
    return 'commercial'
  return 'other'
}

// Road half-width in FEET from the highway class (so a residential street reads
// narrower than a primary road). Footways/paths get a thin ribbon.
function roadHalfWidthFt(tags) {
  const explicit = parseFloat(tags?.width)               // metres
  if (!Number.isNaN(explicit)) return (explicit * FT_PER_M) / 2
  const lanes = parseFloat(tags?.lanes)
  const hw = (tags?.highway || '').toLowerCase()
  if (!Number.isNaN(lanes)) return (lanes * 11) / 2      // ~11 ft per lane
  const byClass = {
    motorway: 24, trunk: 22, primary: 20, secondary: 18, tertiary: 16,
    residential: 14, unclassified: 14, service: 10, living_street: 12,
    track: 8, footway: 4, path: 3, cycleway: 5, pedestrian: 8,
  }
  return (byClass[hw] ?? 12) / 2
}

// Classify a land polygon's ground cover for recolouring: grass / crop / dirt /
// concrete / asphalt / water (or null to ignore). Driven by landuse / natural /
// leisure / surface / crop tags.
function groundKind(tags) {
  const lu = (tags.landuse || '').toLowerCase()
  const nat = (tags.natural || '').toLowerCase()
  const lei = (tags.leisure || '').toLowerCase()
  const sur = (tags.surface || '').toLowerCase()
  const crop = (tags.crop || '').toLowerCase()

  if (nat === 'water' || tags.water || lu === 'reservoir' || lu === 'basin' || lei === 'swimming_pool') return 'water'

  // Cultivated fields / orchards / vineyards → a distinct "crop" cover (rows of
  // growth), separate from manicured grass so big agricultural parcels read right.
  const CROP_LU = ['farmland', 'orchard', 'vineyard', 'allotments', 'plant_nursery', 'greenhouse_horticulture']
  if (CROP_LU.includes(lu) || crop) return 'crop'

  const GRASS_LU = ['grass', 'meadow', 'recreation_ground', 'village_green', 'greenfield', 'farmyard', 'cemetery', 'forest']
  const GRASS_NAT = ['grassland', 'heath', 'wood', 'scrub']
  const GRASS_LEI = ['park', 'garden', 'golf_course', 'pitch', 'playground', 'common', 'dog_park', 'nature_reserve']
  if (GRASS_LU.includes(lu) || GRASS_NAT.includes(nat) || GRASS_LEI.includes(lei) || sur === 'grass') return 'grass'

  const DIRT_LU = ['brownfield', 'construction', 'landfill', 'quarry']
  const DIRT_NAT = ['sand', 'bare_rock', 'scree', 'beach', 'mud', 'shingle', 'desert']
  if (DIRT_LU.includes(lu) || DIRT_NAT.includes(nat) || ['ground', 'dirt', 'earth', 'sand', 'gravel', 'unpaved', 'compacted', 'fine_gravel'].includes(sur)) return 'dirt'

  // Hard surfaces split: smooth light concrete vs dark asphalt/tar.
  if (['concrete', 'paving_stones', 'sett', 'cobblestone'].includes(sur)) return 'concrete'
  if (['paved', 'asphalt', 'chipseal', 'tar'].includes(sur)) return 'asphalt'

  return null
}

// Decompose the Overpass payload into typed, foot-projected feature lists.
function parseFeatures(data, lat0, lng0) {
  const buildings = [], trees = [], wooded = [], treeRows = [],
        fences = [], roads = [], parking = [], ground = []
  const project = (g) => g.map((n) => projectToFeet(n.lat, n.lon, lat0, lng0))
  const outerRings = (el) =>
    el.type === 'way' && Array.isArray(el.geometry)
      ? [el.geometry]
      : el.type === 'relation' && Array.isArray(el.members)
        ? el.members.filter((m) => m.role === 'outer' && Array.isArray(m.geometry)).map((m) => m.geometry)
        : []

  for (const el of data?.elements ?? []) {
    const tags = el.tags || {}

    // Individual trees (nodes) — carry height / crown / leaf type so the renderer
    // can vary each tree's size and shape (broadleaf vs conifer).
    if (el.type === 'node' && tags.natural === 'tree' && el.lat != null) {
      const p = projectToFeet(el.lat, el.lon, lat0, lng0)
      const htM = parseFloat(tags.height), crownM = parseFloat(tags.diameter_crown)
      const leaf = (tags.leaf_type || '').toLowerCase()
      trees.push({
        ...p,
        ft: Number.isNaN(htM) ? null : htM * FT_PER_M,
        crownFt: Number.isNaN(crownM) ? null : crownM * FT_PER_M,
        conifer: leaf === 'needleleaved' ? true : leaf === 'broadleaved' ? false : null,
      })
      continue
    }
    // Buildings
    if (tags.building) {
      const height = heightFt(tags), kind = buildingKind(tags)
      for (const g of outerRings(el)) {
        const pts = project(g)
        if (pts.length >= 3) buildings.push({ pts, height, kind })
      }
      continue
    }
    // Parking areas → paved ground
    if (tags.amenity === 'parking') {
      for (const g of outerRings(el)) {
        const pts = project(g)
        if (pts.length >= 3) parking.push(pts)
      }
      continue
    }
    // Tree rows (ways)
    if (el.type === 'way' && tags.natural === 'tree_row' && Array.isArray(el.geometry)) {
      const pts = project(el.geometry)
      if (pts.length >= 2) treeRows.push(pts)
      continue
    }
    // Barriers: fences, walls, hedges (ways)
    if (el.type === 'way' && ['fence', 'wall', 'hedge'].includes(tags.barrier) && Array.isArray(el.geometry)) {
      const pts = project(el.geometry)
      if (pts.length >= 2) fences.push({ pts, kind: tags.barrier })
      continue
    }
    // Roads & driveways (ways). service roads/driveways → lighter "concrete" ribbon.
    if (el.type === 'way' && tags.highway && Array.isArray(el.geometry)) {
      const pts = project(el.geometry)
      const service = tags.highway === 'service' || tags.service === 'driveway'
      if (pts.length >= 2) roads.push({ pts, half: roadHalfWidthFt(tags), kind: service ? 'service' : 'road' })
      continue
    }
    // Land cover polygons → recoloured ground patches. Woods also seed tree scatter.
    const gk = groundKind(tags)
    if (gk) {
      // Woods seed dense tree scatter; orchards seed a sparser row-ish scatter.
      const isWood = tags.natural === 'wood' || tags.landuse === 'forest'
      const isOrchard = tags.landuse === 'orchard'
      for (const g of outerRings(el)) {
        const pts = project(g)
        if (pts.length < 3) continue
        ground.push({ pts, kind: gk })
        if (isWood || isOrchard) wooded.push(pts)
      }
      continue
    }
  }
  return { buildings, trees, wooded, treeRows, fences, roads, parking, ground }
}

// ── Tree placement (points in FEET) ──────────────────────────────────────────
function polyBounds(pts) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of pts) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z }
  return { minX, maxX, minZ, maxZ }
}
function pointInPoly(x, z, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z
    if (((zi > z) !== (zj > z)) && (x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)) inside = !inside
  }
  return inside
}

// All tree instances: explicit OSM trees + a scatter inside wooded polygons +
// samples along tree rows. Capped so dense forests stay performant.
export function collectTrees({ trees = [], wooded = [], treeRows = [] }, cap = 600) {
  // Keep per-tree species/size hints from explicit OSM trees; scatter/row trees
  // carry none (filled with sensible randoms below).
  const out = trees.map((p) => ({ x: p.x, z: p.z, ft: p.ft ?? null, conifer: p.conifer }))
  const SPACING = 26                                   // ~ft between scattered/row trees
  for (const poly of wooded) {
    const b = polyBounds(poly)
    for (let z = b.minZ; z <= b.maxZ; z += SPACING) {
      for (let x = b.minX; x <= b.maxX; x += SPACING) {
        const jx = x + (Math.random() - 0.5) * SPACING * 0.7
        const jz = z + (Math.random() - 0.5) * SPACING * 0.7
        if (pointInPoly(jx, jz, poly)) out.push({ x: jx, z: jz })
      }
    }
  }
  for (const line of treeRows) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i], c = line[i + 1]
      const segLen = Math.hypot(c.x - a.x, c.z - a.z)
      const steps = Math.max(1, Math.round(segLen / SPACING))
      for (let s = 0; s < steps; s++) {
        const t = s / steps
        out.push({ x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t })
      }
    }
  }
  // Cap (keep a random subset so coverage stays even)
  if (out.length > cap) {
    for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]] }
    out.length = cap
  }
  // Resolve size + shape: real OSM height → scale (base tree ≈ 15 ft); else random
  // 1.1–2.7 (mature ~16–40 ft). Leaf type → conifer flag (≈28% of unknown ones).
  return out.map((p) => ({
    x: p.x, z: p.z,
    scale: p.ft != null ? Math.max(0.6, Math.min(3.2, p.ft / 15)) : 1.1 + Math.random() * 1.6,
    rot: Math.random() * Math.PI * 2,
    conifer: p.conifer != null ? p.conifer : Math.random() < 0.28,
  }))
}

// Cars parked on OSM parking polygons: a jittered grid of stalls, ~65% occupied,
// each with a random paint colour + aisle-aligned heading. Points in FEET.
export function collectCars(parking = [], cap = 160) {
  const COLORS = ['#33373c', '#9aa0a6', '#c9ccd0', '#1d3b6e', '#7a1f23', '#2c4a2e', '#b7b9bd', '#26282b', '#5a6168', '#704214']
  const STALL = 20                                     // ~ft between parked cars
  const out = []
  for (const poly of parking) {
    const b = polyBounds(poly)
    const aisle = (b.maxX - b.minX) >= (b.maxZ - b.minZ) ? 0 : Math.PI / 2   // long axis
    for (let z = b.minZ + 8; z <= b.maxZ - 8; z += STALL) {
      for (let x = b.minX + 8; x <= b.maxX - 8; x += STALL) {
        if (Math.random() < 0.35) continue             // some empty stalls
        const jx = x + (Math.random() - 0.5) * 4
        const jz = z + (Math.random() - 0.5) * 4
        if (!pointInPoly(jx, jz, poly)) continue
        out.push({ x: jx, z: jz, rot: aisle + (Math.random() - 0.5) * 0.12, color: COLORS[(Math.random() * COLORS.length) | 0] })
      }
    }
  }
  if (out.length > cap) {
    for (let i = out.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]] }
    out.length = cap
  }
  return out
}

// ── Image-based detection (reads the satellite tile itself) ───────────────────
// Swimming-pool finder: pools show up as bright cyan/turquoise blobs in aerial
// imagery — distinctive enough to pick out by colour without an ML model. Loads
// the (CORS-enabled) Esri tile into a canvas, masks pool-coloured pixels, flood-
// fills them into connected blobs, filters by size + compactness to reject blue
// cars/roofs/shadows, and returns each pool as a foot-projected rectangle. Pure
// browser (canvas) — returns [] on any failure so the site model is unaffected.
export async function detectPools(satUrl, lat, lng, radiusM = 250) {
  if (!satUrl || typeof document === 'undefined') return []
  const img = await new Promise((res) => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => res(im)
    im.onerror = () => res(null)
    im.src = satUrl
  })
  if (!img || !img.naturalWidth) return []

  const W = 256, H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth))
  let data
  try {
    const cv = document.createElement('canvas')
    cv.width = W; cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, W, H)
    data = ctx.getImageData(0, 0, W, H).data
  } catch {
    return []                                          // tile tainted the canvas → bail
  }

  // Turquoise mask: bright, with BOTH green and blue clearly above red (distinguishes
  // pool water from navy/sky-blue roofs, which lift blue but not green). Tunable.
  const mask = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    if (Math.max(r, g, b) > 95 && b > r + 22 && g > r + 8 && (b + g) - 2 * r > 45) mask[i] = 1
  }

  // Pixel → lat/lng (tile bbox matches esriSatUrl) → scene feet.
  const dLat = radiusM / M_PER_DEG_LAT
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  const north = lat + dLat, west = lng - dLng
  const pxLat = (py) => north - (py / H) * 2 * dLat
  const pxLng = (px) => west + (px / W) * 2 * dLng

  // Connected components (4-neighbour flood fill). Thresholds in pixels: at 256-wide
  // each px ≈ 6 ft, so MIN_PX≈5 ≈ small backyard pool, MAX caps out lakes/ponds.
  const seen = new Uint8Array(W * H)
  const MIN_PX = 5, MAX_PX = Math.round(W * H * 0.012)
  const stack = [], pools = []
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || seen[s]) continue
    stack.length = 0; stack.push(s); seen[s] = 1
    let minx = W, maxx = 0, miny = H, maxy = 0, count = 0
    while (stack.length) {
      const c = stack.pop(); count++
      const cx = c % W, cy = (c / W) | 0
      if (cx < minx) minx = cx; if (cx > maxx) maxx = cx
      if (cy < miny) miny = cy; if (cy > maxy) maxy = cy
      if (cx > 0 && mask[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; stack.push(c - 1) }
      if (cx < W - 1 && mask[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; stack.push(c + 1) }
      if (cy > 0 && mask[c - W] && !seen[c - W]) { seen[c - W] = 1; stack.push(c - W) }
      if (cy < H - 1 && mask[c + W] && !seen[c + W]) { seen[c + W] = 1; stack.push(c + W) }
    }
    if (count < MIN_PX || count > MAX_PX) continue
    const bw = maxx - minx + 1, bh = maxy - miny + 1
    if (count / (bw * bh) < 0.42 || Math.max(bw, bh) / Math.max(1, Math.min(bw, bh)) > 4) continue
    const pts = [[minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy]]
      .map(([px, py]) => projectToFeet(pxLat(py), pxLng(px), lat, lng))
    pools.push({ pts })
    if (pools.length >= 40) break
  }
  return pools
}

// Overpass query for buildings + greenery + barriers + roads + parking.
export async function fetchSiteFeatures(lat, lng, radiusM = 250) {
  const a = `(around:${radiusM},${lat},${lng})`
  const q =
    `[out:json][timeout:40];(` +
    `way["building"]${a};relation["building"]${a};` +
    `node["natural"="tree"]${a};` +
    `way["natural"]${a};relation["natural"]${a};` +     // tree_row, wood, grassland, water, sand…
    `way["landuse"]${a};relation["landuse"]${a};` +     // forest, grass, farmland, industrial…
    `way["leisure"]${a};relation["leisure"]${a};` +     // park, garden, pitch, golf_course…
    `way["barrier"~"^(fence|wall|hedge)$"]${a};` +
    `way["highway"]${a};` +
    `way["amenity"="parking"]${a};relation["amenity"="parking"]${a};` +
    `);out geom;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(q),
  })
  if (!res.ok) throw new Error(`Map data error (${res.status})`)
  const data = await res.json()
  return parseFeatures(data, lat, lng)
}

// Back-compat: buildings only.
export async function fetchSiteBuildings(lat, lng, radiusM = 250) {
  return (await fetchSiteFeatures(lat, lng, radiusM)).buildings
}

// Overture building subtype/class → our coarse massing kind (colour + roof).
function overtureKind(k) {
  const s = (k || '').toLowerCase()
  if (['outbuilding', 'garage', 'shed', 'carport', 'barn', 'agricultural', 'farm', 'farm_auxiliary', 'hut', 'cabin', 'greenhouse', 'allotment_house'].includes(s)) return 'outbuilding'
  if (['residential', 'house', 'detached', 'semidetached_house', 'bungalow', 'apartments', 'terrace', 'dormitory', 'static_caravan'].includes(s)) return 'house'
  if (['commercial', 'retail', 'industrial', 'warehouse', 'office', 'supermarket', 'service', 'hangar', 'civic', 'public', 'education', 'medical', 'hospital', 'school', 'religious', 'hotel', 'transportation', 'entertainment'].includes(s)) return 'commercial'
  return 'other'
}

// Overture Maps buildings via the backend (/api/buildings). Overture conflates
// OSM + Microsoft (Bing ML) + Google Open Buildings, so it fills the residential
// footprints OSM is missing AND carries real heights. Returns foot-projected
// { pts, height, kind } (same shape as the OSM buildings), or null when the
// endpoint / dataset is unavailable so the caller falls back to OSM with no change.
export async function fetchOvertureBuildings(lat, lng, radiusM = 250) {
  try {
    const r = await fetch(`/api/buildings?lat=${lat}&lng=${lng}&radiusM=${radiusM}`)
    if (!r.ok) return null
    const d = await r.json()
    if (!Array.isArray(d?.buildings) || d.buildings.length === 0) return null
    const out = []
    for (const b of d.buildings) {
      if (!Array.isArray(b.ring) || b.ring.length < 3) continue
      const pts = b.ring.map(([lo, la]) => projectToFeet(la, lo, lat, lng))
      const height = b.height != null ? Math.max(6, b.height * FT_PER_M)
        : b.levels != null ? Math.max(6, b.levels * DEFAULT_LEVEL_M * FT_PER_M)
        : DEFAULT_HEIGHT_M * FT_PER_M
      out.push({ pts, height, kind: overtureKind(b.kind) })
    }
    return out.length ? out : null
  } catch {
    return null
  }
}

// ── Geometry builders (all return flat-laid BufferGeometry in scene feet) ─────

// A hip/pyramid roof cap over a footprint: triangle fan from each base edge up to
// an apex above the centroid. position+uv attributes (normals computed) so the
// caps merge cleanly with one another. Gives houses/sheds a pitched silhouette
// instead of flat boxes. Returns null for degenerate footprints.
function pyramidRoof(pts, baseY, apexY) {
  let cx = 0, cz = 0
  for (const p of pts) { cx += p.x; cz += p.z }
  cx /= pts.length; cz /= pts.length
  const pos = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    pos.push(a.x, baseY, a.z,  b.x, baseY, b.z,  cx, apexY, cz)
  }
  if (!pos.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2))
  g.computeVertexNormals()
  return g
}

// Extrude footprints, grouped by kind → [{ kind, geo }] so each kind gets a colour.
// Houses & outbuildings get walls to an eave height plus a pitched roof cap (which
// is returned as its own `roof` part), so the massing reads as varied real shapes.
const PITCHED = new Set(['house', 'outbuilding'])
export function buildSiteGeometryByKind(buildings) {
  const byKind = {}
  for (const b of buildings) (byKind[b.kind] ??= []).push(b)
  const out = []
  const roofGeos = []
  for (const [kind, list] of Object.entries(byKind)) {
    const geos = []
    for (const b of list) {
      const pitched = PITCHED.has(kind)
      // Footprint extent → roof pitch height (capped); eave = walls below the roof.
      const bb = polyBounds(b.pts)
      const minSpan = Math.min(bb.maxX - bb.minX, bb.maxZ - bb.minZ)
      const pitch = pitched ? Math.min(minSpan * 0.4, kind === 'house' ? 14 : 9) : 0
      const wallH = pitched ? Math.max(7, b.height - pitch * 0.6) : b.height

      const shape = new THREE.Shape()
      b.pts.forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)))
      shape.closePath()
      const g = new THREE.ExtrudeGeometry(shape, { depth: wallH, bevelEnabled: false, steps: 1 })
      g.rotateX(-Math.PI / 2)
      geos.push(g)

      if (pitched) {
        const cap = pyramidRoof(b.pts, wallH, wallH + pitch)
        if (cap) roofGeos.push(cap)
      }
    }
    if (geos.length) {
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      merged.computeVertexNormals()
      out.push({ kind, geo: merged })
    }
  }
  if (roofGeos.length) {
    const merged = mergeGeometries(roofGeos, false)
    roofGeos.forEach((g) => g.dispose())
    if (merged) { merged.computeVertexNormals(); out.push({ kind: 'roof', geo: merged }) }
  }
  return out
}

// Legacy single merged massing geometry (kept for any old callers).
export function buildSiteGeometry(buildings) {
  const parts = buildSiteGeometryByKind(buildings)
  if (!parts.length) return null
  const merged = mergeGeometries(parts.map((p) => p.geo), false)
  parts.forEach((p) => p.geo.dispose())
  merged.computeVertexNormals()
  return merged
}

// Flat ribbon along a polyline (roads). Quad per segment at y≈0, width = 2*half.
function ribbonGeometry(lines, y = 0) {
  const positions = []
  const pushQuad = (ax, az, bx, bz, cx, cz, dx, dz) => {
    positions.push(ax, y, az, bx, y, bz, cx, y, cz, ax, y, az, cx, y, cz, dx, y, dz)
  }
  for (const { pts, half } of lines) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]
      const dx = b.x - a.x, dz = b.z - a.z
      const len = Math.hypot(dx, dz) || 1
      const nx = (-dz / len) * half, nz = (dx / len) * half
      pushQuad(a.x + nx, a.z + nz, b.x + nx, b.z + nz, b.x - nx, b.z - nz, a.x - nx, a.z - nz)
    }
  }
  if (!positions.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}
// Roads as asphalt ribbons + service roads/driveways as a separate concrete ribbon.
// Returns { roadGeo, serviceGeo } (either may be null).
export function buildRoadGeometry(roads) {
  return {
    roadGeo:    ribbonGeometry(roads.filter((r) => r.kind !== 'service')),
    serviceGeo: ribbonGeometry(roads.filter((r) => r.kind === 'service')),
  }
}

// Merge a list of foot-projected polygons into one flat filled BufferGeometry.
function fillPolygons(polys) {
  const geos = []
  for (const pts of polys) {
    if (pts.length < 3) continue
    const shape = new THREE.Shape()
    pts.forEach((p, i) => (i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)))
    shape.closePath()
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    geos.push(g)
  }
  if (!geos.length) return null
  const merged = mergeGeometries(geos, false)
  geos.forEach((g) => g.dispose())
  return merged
}

// Flat filled polygons (parking lots).
export function buildParkingGeometry(parking) { return fillPolygons(parking) }

// Expand a polygon outward from its centroid by `d` feet (pool coping ring).
function expandPoly(pts, d) {
  let cx = 0, cz = 0
  for (const p of pts) { cx += p.x; cz += p.z }
  cx /= pts.length; cz /= pts.length
  return pts.map((p) => {
    const dx = p.x - cx, dz = p.z - cz, len = Math.hypot(dx, dz) || 1
    return { x: p.x + (dx / len) * d, z: p.z + (dz / len) * d }
  })
}

// Image-detected pools → { waterGeo, deckGeo } (water fill + a light coping ring).
export function buildPoolGeometry(pools) {
  const water = [], deck = []
  for (const p of pools) {
    if (!p.pts || p.pts.length < 3) continue
    water.push(p.pts)
    deck.push(expandPoly(p.pts, 2.0))
  }
  return { waterGeo: fillPolygons(water), deckGeo: fillPolygons(deck) }
}

// Ground-cover polygons grouped by kind → geometry per cover type.
export function buildGroundGeometry(ground) {
  const byKind = { grass: [], crop: [], dirt: [], concrete: [], asphalt: [], water: [] }
  for (const g of ground) (byKind[g.kind] ??= []).push(g.pts)
  return {
    grass:    fillPolygons(byKind.grass),
    crop:     fillPolygons(byKind.crop),
    dirt:     fillPolygons(byKind.dirt),
    concrete: fillPolygons(byKind.concrete),
    asphalt:  fillPolygons(byKind.asphalt),
    water:    fillPolygons(byKind.water),
  }
}

// Vertical strips along barrier polylines. fence/wall → grey; hedge → green.
// Returns { railGeo, hedgeGeo } (either may be null).
export function buildBarrierGeometry(fences) {
  const make = (list, height, thick) => {
    const geos = []
    for (const { pts } of list) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1]
        const dx = b.x - a.x, dz = b.z - a.z
        const len = Math.hypot(dx, dz) || 1
        const g = new THREE.BoxGeometry(len, height, thick)
        g.translate(len / 2, height / 2, 0)               // base at y=0, start at local origin
        g.rotateY(Math.atan2(-dz, dx))
        g.translate(a.x, 0, a.z)
        geos.push(g)
      }
    }
    if (!geos.length) return null
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    merged.computeVertexNormals()
    return merged
  }
  const rails  = fences.filter((f) => f.kind === 'fence' || f.kind === 'wall')
  const hedges = fences.filter((f) => f.kind === 'hedge')
  return {
    railGeo:  make(rails, 5, 0.25),
    hedgeGeo: make(hedges, 3.5, 2.2),
  }
}
