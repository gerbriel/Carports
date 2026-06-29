// ─────────────────────────────────────────────────────────────────────────────
// Generates a full CityPage record (climate, intro, highlights, permit notes,
// FAQs, nearby areas) for any Arizona city/town from its county + region.
//
// Mirrors cityContent.js (the California generator) but with Arizona-correct copy:
// the IBC/IRC as adopted locally (Arizona has no statewide building code), the
// Arizona Registrar of Contractors (ROC), and desert/monsoon/high-country climate.
// Content varies by the region's emphasis tags + a deterministic slug hash so
// pages are relevant and non-duplicate. Featured cities in cities.js override.
// ─────────────────────────────────────────────────────────────────────────────

import { REGIONS, citySlug, countySlug } from './azGeo'
import { getAzPermitInfo } from './azPermitting'

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
    'Open-front commodity & livestock shade structures',
    'Ag buildings engineered up to 150′+ wide',
  ],
  heat: [
    'Galvalume panels that reflect radiant desert heat',
    'Moisture barrier & fiberglass insulation options',
    'Vertical roofs that shed heat and debris',
  ],
  snow: [
    'Snow-load engineering for high-country elevations',
    'Steep-pitch roofs that shed heavy mountain snow',
  ],
  wind: [
    'Monsoon wind & microburst bracing with deep anchoring',
    'Engineered for Arizona monsoon gusts & haboobs',
  ],
  desert: [
    'Heavy-gauge frames for desert sun & blowing dust',
    'UV- and dust-resistant baked-on finishes',
  ],
  urban: [
    'Residential garages, carports & RV covers',
    'Tight-lot installs with full permit handling',
  ],
  rural: [
    'Ranch, barn & hobby-farm structures',
    'Remote-site delivery & installation',
  ],
}
const HIGHLIGHTS_GENERIC = [
  'Arizona ROC licensed & bonded',
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
    a: `Arizona has no statewide building code, so ${c.county} and the City of ${c.name} adopt their own versions of the International Building Code (IBC) and Residential Code (IRC). Most structures over a set size or height need a permit. Projects inside ${c.name} city limits go through the city, and parcels in unincorporated ${c.county} go through the county. We prepare the engineer-stamped drawings and permit package, and you submit the application.`,
  }),
  (c) => ({
    q: `How much does a metal carport or garage cost in ${c.name}?`,
    a: `It comes down to size, wall height, roof style, and how many doors you want. A standard 20×20 two-car garage usually runs $8,000 to $14,000 installed around ${c.name}. Carports start lower, and large enclosed or ag buildings go up from there. Concrete site prep, if you need it, is extra. You get an exact figure with your free quote.`,
  }),
  (c) => ({
    q: `Do you deliver and install in ${c.name}?`,
    a: `Yes. ${c.name} is inside our Arizona service area, and we deliver and install statewide as a licensed, bonded contractor with the Arizona Registrar of Contractors (ROC). Most residential carports and garages go up in one to two days. Larger commercial and agricultural buildings take a few days depending on size and site access.`,
  }),
]
const FAQ_BY_TAG = {
  heat: (c) => ({
    q: `Is it worth insulating a metal building in ${c.name}'s heat?`,
    a: `For a workshop or garage you'll use through the summer, absolutely. An uninsulated steel building gets very hot inside on 110°+ days. Our standard moisture barrier is a lightweight bubble film that controls condensation but does little for heat. For real temperature control, step up to fiberglass in 2.5 inch or 3 inch, or Solar Guard, a thinner double-sided option that performs above its thickness and costs less than the 3 inch. The thicker you go, the more the panels can bubble or compress slightly around the screw points, so it's a tradeoff. Our AZ50 Galvalume panels reflect radiant heat to begin with, which helps out in the ${c.county} desert.`,
  }),
  wind: (c) => ({
    q: `How are your buildings engineered for monsoon winds and haboobs near ${c.name}?`,
    a: `Every structure is engineered to the design wind speed for your parcel, with extra bracing and deep anchoring on exposed sites. That matters a lot for the monsoon microbursts and blowing dust common across ${c.county}. Your engineer-stamped drawings call out the exact design wind speed and exposure category.`,
  }),
  desert: (c) => ({
    q: `Will the finish hold up to the desert sun and dust around ${c.name}?`,
    a: `Yes. We use AZ50 Galvalume-coated steel with baked-on, UV-stable color finishes built for relentless Arizona sun, and heavier-gauge framing options for sites that take a beating from blowing dust and monsoon storms in ${c.county}.`,
  }),
  snow: (c) => ({
    q: `Can your buildings handle the snow load near ${c.name}?`,
    a: `Yes. We engineer roof structures to the design snow load for your exact elevation and parcel. Higher-elevation ${c.county} sites get heavier-gauge framing, tighter purlin spacing, and steeper roof pitches so snow sheds cleanly. Your stamped drawings call out the exact design load.`,
  }),
  agriculture: (c) => ({
    q: `Do you build hay barns and equipment shelters near ${c.name}?`,
    a: `Agricultural structures are one of our specialties. We build open-front hay barns, enclosed equipment shops, livestock shade structures, and clear-span buildings 100′+ wide for ${c.county} farms and ranches. Many ag structures on agriculturally-zoned land may qualify for reduced permitting, and we confirm those requirements with your jurisdiction.`,
  }),
}

const INTROS = [
  (c, short, region) =>
    `${c.name} sits in ${c.county}, in Arizona's ${region}. We design and install custom steel carports, garages, RV covers, and agricultural buildings for ${c.name} property owners, and every structure is engineered for ${short} and built to local ${c.county} code.`,
  (c, short) =>
    `From residential garages to large clear-span ag and commercial buildings, we serve ${c.name} and the surrounding ${c.county} area. Our steel structures are engineered for ${short}, and we handle the engineer-stamped drawings and permit paperwork for your ${c.name} project.`,
  (c, short) =>
    `Quality Metal Carports builds custom steel structures throughout ${c.county}, including ${c.name} and nearby communities. Whether you need a backyard carport, an enclosed workshop, or a farm equipment shelter, we engineer every building for ${short} and ${c.name}'s local requirements.`,
]

// County-page intro (opts.isCounty) reads at the county level.
const COUNTY_INTRO = (c, short, region) =>
  `Quality Metal Carports designs, delivers, and installs custom steel carports, garages, RV covers, and agricultural buildings across all of ${c.county}, in Arizona's ${region}. From the county seat to the most remote desert and high-country parcels, every structure is engineered for ${short} and built to the county's design wind and snow loads, with engineer-stamped drawings and full permit handling.`

// Build the full record. `siblings` are the other city names in the same county
// (used for "nearby communities"). `opts.isCounty` flips to a county landing page.
export function generateCity({ name, county, region }, siblings = [], opts = {}) {
  const r = REGIONS[region]
  const isCounty = !!opts.isCounty
  const slug = isCounty ? `${countySlug(county)}-county-az` : citySlug(name)
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
  tagFaqTags.slice(0, 2).forEach((t) => {
    if (faqs.length < 4) faqs.push(FAQ_BY_TAG[t](base))
  })
  if (faqs.length < 4) faqs.push(FAQ_GENERIC[3](base))

  const nearbyAreas = siblings.filter((s) => s !== name).slice(0, 6)

  // Real permitting authority + design loads (wind, elevation-driven snow).
  const permit = getAzPermitInfo(name, county, slug, { isCounty })
  const authority = permit.isCountyOffice
    ? `properties in and around ${name} in unincorporated ${county} are handled by the county`
    : `projects inside ${name} city limits go through ${permit.permitOffice}, while unincorporated parcels are handled by ${county}`
  const permitNotes = isCounty
    ? `Arizona has no statewide building code, so ${county} and each incorporated city adopt their own versions of the IBC/IRC. Structures over a set size or height generally require a building permit: incorporated cities run their own building departments, while unincorporated parcels are handled by ${permit.permitOffice}. We give you all the documentation we can, including the engineer-stamped drawings. You grab the permit application form from your building department, fill it out, and submit it with our paperwork, and approval usually runs two to six weeks depending on the jurisdiction.`
    : `Arizona has no statewide building code, so ${county} and the City of ${name} adopt their own versions of the IBC/IRC. Structures over a set size or height generally require a building permit, and ${authority}. We give you all the documentation we can, including the engineer-stamped drawings. You grab the permit application form from your building department, fill it out, and submit it with our paperwork, and approval usually runs two to six weeks depending on the jurisdiction.`

  return {
    slug,
    name,
    stateCode: 'AZ',
    county,
    region: r.label,
    climate: r.climate,
    permitOffice: permit.permitOffice,
    permitUrl: permit.permitUrl,
    permitNotes,
    designWindMph: permit.designWindMph,
    windBasis: permit.windBasis,
    windExposure: permit.windExposure,
    specialWind: permit.specialWind,
    designSnowPsf: permit.designSnowPsf,
    snowNote: permit.snowNote,
    seismicCategory: permit.seismicCategory,
    elevationFt: permit.elevationFt,
    codeRef: permit.codeRef,
    loadDisclaimer: permit.loadDisclaimer,
    asceHazardToolUrl: permit.asceHazardToolUrl,
    introText: isCounty
      ? COUNTY_INTRO(base, r.short, r.label)
      : pick(INTROS, h)(base, r.short, r.label),
    highlights,
    nearbyAreas,
    faqs,
  }
}
