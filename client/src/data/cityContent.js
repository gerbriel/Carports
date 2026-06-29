// ─────────────────────────────────────────────────────────────────────────────
// Generates a full CityPage record (climate, intro, highlights, permit notes,
// FAQs, nearby areas) for any incorporated CA city from its county + region.
//
// Content is varied by (a) the region's emphasis tags and (b) a deterministic
// hash of the city slug, so pages are relevant and non-duplicate without needing
// hand-written copy for all 482 cities. Hand-written "featured" cities in
// cities.js override the generated record entirely.
// ─────────────────────────────────────────────────────────────────────────────

import { REGIONS, citySlug, countySlug } from './caGeo'
import { getPermitInfo } from './caPermits'

// Deterministic small hash so every generated field is stable across builds.
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}
const pick = (arr, n) => arr[n % arr.length]

// ── Highlight phrases by emphasis tag (4 are selected per city) ──────────────
const HIGHLIGHTS = {
  agriculture: [
    'Clear-span hay barns & equipment shelters',
    'Open-front commodity & livestock structures',
    'Ag buildings engineered up to 150′+ wide',
  ],
  heat: [
    'Galvalume panels that reflect radiant summer heat',
    'Moisture barrier & fiberglass insulation options',
    'Vertical roofs that shed heat and debris',
  ],
  fog: ['Corrosion-resistant coatings for humid, foggy air'],
  snow: [
    'Snow-load engineering for higher elevations',
    'Steep-pitch roofs that shed heavy snow',
  ],
  wind: ['Wind-load engineering & extra bracing for exposed sites'],
  corrosion: ['AZ50 Galvalume that resists coastal corrosion'],
  coastal: ['Marine-grade hardware for coastal properties'],
  urban: [
    'Residential garages, carports & RV covers',
    'Tight-lot installs with full permit handling',
  ],
  rural: [
    'Ranch, barn & hobby-farm structures',
    'Remote-site delivery & installation',
  ],
  desert: ['Heavy-gauge frames for desert wind & sun'],
}
const HIGHLIGHTS_GENERIC = [
  'CA Licensed Contractor LIC# 1096004',
  'Free on-site quotes & 20-year rust-through warranty',
  'Engineer-stamped drawings included',
  'Custom sizes, colors & door configurations',
]

// ── FAQ templates. Generic ones always apply; tag ones add local relevance. ──
const FAQ_GENERIC = [
  (c) => ({
    q: `Do you offer free quotes in ${c.name}?`,
    a: `Yes. We provide free, no-obligation quotes for every ${c.name} and ${c.county} project. We confirm we cover your area, look over your site and how you plan to use the building, and send pricing with engineer-stamped drawings for anything that needs a permit.`,
  }),
  (c) => ({
    q: `What permits do I need for a metal building in ${c.name}?`,
    a: `In most of ${c.county}, any structure over 120 square feet or above a set height needs a building permit. Projects inside ${c.name} city limits go through the city building department, and parcels in unincorporated areas go through the county. We prepare the engineer-stamped drawings and permit package, and you submit the application.`,
  }),
  (c) => ({
    q: `How much does a metal carport or garage cost in ${c.name}?`,
    a: `It comes down to size, wall height, roof style, and how many doors you want. A standard 20×20 two-car garage usually runs $8,000 to $14,000 installed around ${c.name}. Carports start lower, and large enclosed or ag buildings go up from there. Concrete site prep, if you need it, is extra. You get an exact figure with your free quote.`,
  }),
  (c) => ({
    q: `Do you deliver and install in ${c.name}?`,
    a: `Yes. ${c.name} is inside our California service area, and we deliver and install statewide under CA Contractor LIC# 1096004. Most residential carports and garages go up in one to two days. Larger commercial and agricultural buildings take a few days depending on size and site access.`,
  }),
]
const FAQ_BY_TAG = {
  heat: (c) => ({
    q: `Is it worth insulating a metal building in ${c.name}'s heat?`,
    a: `For a workshop or garage you'll use regularly, it's worth it. An uninsulated steel building can get very hot inside on peak summer days. Our standard moisture barrier is a lightweight bubble film that controls condensation, but it does little for heat. For real temperature control, step up to fiberglass in 2.5 inch or 3 inch, or Solar Guard, a thinner double-sided option that performs above its thickness and costs less than the 3 inch. Just know the thicker you go, the more the panels can bubble or compress slightly around the screw points. Our Galvalume panels reflect radiant heat to start with.`,
  }),
  snow: (c) => ({
    q: `Can your buildings handle the snow load near ${c.name}?`,
    a: `Yes. We engineer roof structures to the design snow load for your exact elevation and parcel. Higher-elevation ${c.county} sites get heavier-gauge framing, tighter purlin spacing, and steeper roof pitches so snow sheds cleanly. Your stamped drawings call out the exact design load.`,
  }),
  agriculture: (c) => ({
    q: `Do you build hay barns and equipment shelters near ${c.name}?`,
    a: `Agricultural structures are one of our specialties. We build open-front hay barns, enclosed equipment shops, livestock shade structures, and clear-span buildings 100′+ wide for ${c.county} farms and ranches. Many ag structures on ag-zoned land may qualify for permit exemptions under California Health & Safety Code §19132.`,
  }),
  corrosion: (c) => ({
    q: `How do your buildings hold up to the humidity around ${c.name}?`,
    a: `All our buildings use AZ50 Galvalume-coated steel, which resists corrosion far better than plain galvanized panels in foggy, marine, or humid conditions. We also specify hot-dip galvanized or stainless hardware in exposed locations for coastal and bay-influenced ${c.county} sites.`,
  }),
  wind: (c) => ({
    q: `How are your buildings engineered for wind in ${c.name}?`,
    a: `Every structure is engineered to California's wind exposure requirements for your parcel, with additional bracing and heavier anchoring specified for exposed sites. Your engineer-stamped drawings call out the design wind speed and exposure category for the ${c.name} area.`,
  }),
}

const INTROS = [
  (c, short, region) =>
    `${c.name} sits in ${c.county}, in California's ${region}. We design and install custom steel carports, garages, RV covers, and agricultural buildings for ${c.name} property owners, and every structure is engineered for ${short} and built to local ${c.county} code.`,
  (c, short) =>
    `From residential garages to large clear-span ag and commercial buildings, we serve ${c.name} and the surrounding ${c.county} area. Our steel structures are engineered for ${short}, and we handle the engineer-stamped drawings and permit paperwork for your ${c.name} project.`,
  (c, short) =>
    `Quality Metal Carports builds custom steel structures throughout ${c.county}, including ${c.name} and nearby communities. Whether you need a backyard carport, an enclosed workshop, or a farm equipment shelter, we engineer every building for ${short} and ${c.name}'s local requirements.`,
]

// County-page intro (opts.isCounty) reads at the county level and points to
// both the incorporated-city departments and the county building office.
const COUNTY_INTRO = (c, short, region) =>
  `Quality Metal Carports designs, delivers, and installs custom steel carports, garages, RV covers, and agricultural buildings across all of ${c.county}, in California's ${region}. From the county seat to the smallest rural parcels, every structure is engineered for ${short} and built to the county's wind and snow load requirements, with engineer-stamped drawings and full permit handling.`

// Build the full record. `siblings` are the other city names in the same county
// (used for "nearby communities"). `opts.isCounty` flips to a county landing page.
export function generateCity({ name, county, region }, siblings = [], opts = {}) {
  const r = REGIONS[region]
  const isCounty = !!opts.isCounty
  const slug = isCounty ? `${countySlug(county)}-county-ca` : citySlug(name)
  const h = hash(slug)
  const base = { name, county, slug }

  // Highlights: pull from this region's tags + generic, dedupe, pick 4.
  const tagHighlights = r.tags.flatMap((t) => HIGHLIGHTS[t] ?? [])
  const pool = [...new Set([...tagHighlights, ...HIGHLIGHTS_GENERIC])]
  const highlights = []
  for (let i = 0; highlights.length < 4 && i < pool.length * 2; i++) {
    const cand = pool[(h + i) % pool.length]
    if (!highlights.includes(cand)) highlights.push(cand)
  }

  // FAQs: 2 rotating generic + up to 2 tag-based (one per distinct tag).
  const faqs = [
    pick(FAQ_GENERIC, h)(base),
    pick(FAQ_GENERIC, h + 1)(base),
  ]
  const tagFaqTags = r.tags.filter((t) => FAQ_BY_TAG[t])
  tagFaqTags.slice(0, 2).forEach((t, i) => {
    if (faqs.length < 4) faqs.push(FAQ_BY_TAG[t](base))
  })
  // Always close with the service-area / install FAQ if room.
  if (faqs.length < 4) faqs.push(FAQ_GENERIC[3](base))

  const nearbyAreas = siblings.filter((s) => s !== name).slice(0, 6)

  // Real permit office (linked) + representative design loads for this jurisdiction.
  const permit = getPermitInfo({ name, county })

  return {
    slug,
    name,
    stateCode: 'CA',
    county,
    region: r.label,
    climate: r.climate,
    permitOffice: permit.permitOffice,
    permitUrl: permit.permitUrl,
    countyOffice: permit.countyOffice,
    countyUrl: permit.countyUrl,
    isCityOffice: permit.isCityOffice,
    windSpeed: permit.windSpeed,
    windNote: permit.windNote,
    groundSnow: permit.groundSnow,
    snowNote: permit.snowNote,
    hazardToolUrl: permit.hazardToolUrl,
    permitNotes: isCounty
      ? `Across ${county}, a detached structure over 120 square feet or above a set height generally requires a building permit. Each incorporated city runs its own building department, while properties in unincorporated ${county} are handled by ${permit.countyOffice}. We give you all the documentation we can, including the engineer-stamped drawings. You grab the permit application form from your building department, fill it out, and submit it with our paperwork, and approval usually runs four to eight weeks depending on the jurisdiction.`
      : `Structures over 120 square feet or above a set height in ${county} generally require a building permit. Projects inside ${name} city limits go through the city building department, while properties in unincorporated ${county} are handled by ${permit.countyOffice}. We give you all the documentation we can, including the engineer-stamped drawings. You grab the permit application form from your building department, fill it out, and submit it with our paperwork, and approval usually runs four to eight weeks depending on the jurisdiction.`,
    introText: isCounty
      ? COUNTY_INTRO(base, r.short, r.label)
      : pick(INTROS, h)(base, r.short, r.label),
    highlights,
    nearbyAreas,
    faqs,
  }
}
