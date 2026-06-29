// ─────────────────────────────────────────────────────────────────────────────
// Generates a full CityPage record for any NEVADA city/town OR county, from its
// county + region. Mirrors cityContent.js (CA) but with Nevada-specific climate,
// permit, and copy. County pages (isCounty) read at the county level and list the
// county's communities as "nearby areas".
// ─────────────────────────────────────────────────────────────────────────────

import { NV_REGIONS, nvCitySlug, nvCountySlug } from './nvGeo'
import { nvPermitFor, ASCE_HAZARD_TOOL, LOAD_DISCLAIMER } from './nvPermitData'

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}
const pick = (arr, n) => arr[n % arr.length]

// ── Highlight phrases by emphasis tag (4 selected per page) ──────────────────
const HIGHLIGHTS = {
  desert: [
    'Heavy-gauge frames built for desert wind & sun',
    'Galvalume panels that reflect intense desert heat',
  ],
  heat: [
    'Galvalume panels that reflect radiant summer heat',
    'Moisture barrier & fiberglass insulation options',
    'Vertical roofs that shed heat and blowing debris',
  ],
  wind: ['Wind-load engineering & extra anchoring for exposed sites'],
  snow: [
    'Snow-load engineering for higher elevations',
    'Steep-pitch roofs that shed heavy mountain snow',
  ],
  agriculture: [
    'Clear-span hay barns & equipment shelters',
    'Open-front livestock & commodity structures',
  ],
  rural: [
    'Ranch, barn & hobby-farm structures',
    'Remote-site delivery & installation across Nevada',
  ],
  urban: [
    'Residential garages, carports & RV covers',
    'Tight-lot installs with full permit handling',
  ],
}
const HIGHLIGHTS_GENERIC = [
  'Engineer-stamped Nevada drawings included',
  'Free quotes & 20-year rust-through warranty',
  'Custom sizes, colors & door configurations',
  'Licensed & insured steel-building installers',
]

// ── FAQ templates ────────────────────────────────────────────────────────────
const FAQ_GENERIC = [
  (c) => ({
    q: `Do you offer free quotes in ${c.name}?`,
    a: `Yes. We provide free, no-obligation quotes for every ${c.name} and ${c.county} project. We confirm we cover your area, look over your site and how you plan to use the building, and send pricing with engineer-stamped drawings for anything that needs a permit.`,
  }),
  (c) => ({
    q: `What permits do I need for a metal building in ${c.name}?`,
    a: `In most of ${c.county}, a detached accessory structure over about 200 square feet (or above a set height) needs a building permit. Projects inside ${c.name} city limits go through the city building department, and unincorporated parcels go through ${c.county}. We prepare the engineer-stamped drawings and permit package, and you submit the application.`,
  }),
  (c) => ({
    q: `How much does a metal carport or garage cost in ${c.name}?`,
    a: `It comes down to size, wall height, roof style, and how many doors you want. A standard 20×20 two-car garage usually runs $8,000 to $15,000 installed around ${c.name}. Carports start lower, and large enclosed or ag buildings go up from there. Concrete site prep, if you need it, is extra. You get an exact figure with your free quote.`,
  }),
  (c) => ({
    q: `Do you deliver and install in ${c.name}?`,
    a: `Yes. ${c.name} is inside our Nevada service area, and we deliver and install statewide, fully licensed and insured, with engineer-stamped drawings to local code. Most residential carports and garages go up in one to two days. Larger commercial and agricultural buildings take a few days depending on size and site access.`,
  }),
]
const FAQ_BY_TAG = {
  heat: (c) => ({
    q: `Is it worth insulating a metal building in ${c.name}'s heat?`,
    a: `For a workshop or garage you'll use regularly, yes. An uninsulated steel building gets very hot inside on peak Nevada summer days. Our standard moisture barrier is a lightweight bubble film that controls condensation but does little for heat. For real temperature control, step up to fiberglass in 2.5 inch or 3 inch, or Solar Guard, a thinner double-sided option that performs above its thickness and costs less than the 3 inch. The thicker you go, the more the panels can bubble or compress slightly around the screw points. Our Galvalume panels reflect radiant heat to start with.`,
  }),
  desert: (c) => ({
    q: `How do your buildings hold up to ${c.name}'s desert heat and dust storms?`,
    a: `Our all-steel frames and AZ50 Galvalume panels are built for the Mojave. The coating reflects radiant heat and won't warp, rot, or split like wood. We anchor and brace for monsoon wind and dust loading, and vertical-roof panels shed blowing debris and the occasional flash rain efficiently.`,
  }),
  snow: (c) => ({
    q: `Can your buildings handle the snow load near ${c.name}?`,
    a: `Yes. We engineer roof structures to the design snow load for your exact elevation and parcel. Higher-elevation ${c.county} sites get heavier-gauge framing, tighter purlin spacing, and steeper roof pitches so snow sheds cleanly. Your stamped drawings call out the exact design load.`,
  }),
  wind: (c) => ({
    q: `How are your buildings engineered for Nevada wind near ${c.name}?`,
    a: `Every structure is engineered to the design wind speed and exposure category for your parcel, with additional bracing and heavier anchoring on open, exposed sites like much of ${c.county}. Your engineer-stamped drawings call out the wind design for the ${c.name} area.`,
  }),
  agriculture: (c) => ({
    q: `Do you build hay barns and equipment shelters near ${c.name}?`,
    a: `Agricultural and ranch structures are one of our specialties in Nevada. We build open-front hay barns, enclosed equipment shops, livestock shade structures, and clear-span buildings 100′+ wide for ${c.county} farms and ranches, all on heavy galvanized steel that outlasts wood in the high desert.`,
  }),
}

const INTROS = [
  (c, short, region) =>
    `${c.name} sits in ${c.county}, in ${region}. We design and install custom steel carports, garages, RV covers, and agricultural buildings for ${c.name} property owners, and every structure is engineered for ${short} and built to local ${c.county} code.`,
  (c, short) =>
    `From residential garages to large clear-span ag and commercial buildings, we serve ${c.name} and the surrounding ${c.county} area. Our steel structures are engineered for ${short}, and we handle the engineer-stamped drawings and permit paperwork for your ${c.name} project.`,
  (c, short) =>
    `Quality Metal Carports builds custom steel structures throughout ${c.county}, including ${c.name} and nearby communities. Whether you need a backyard carport, an enclosed workshop, or a ranch equipment shelter, we engineer every building for ${short} and ${c.name}'s local requirements.`,
]
const COUNTY_INTRO = (c, short, region) =>
  `We build custom steel carports, garages, RV covers, and agricultural buildings throughout ${c.county}, part of ${region}. From the county seat to the smallest ranch parcels, every ${c.county} structure is engineered for ${short} and built to local code, with engineer-stamped drawings and full permit handling.`

// Build the full record. `siblings` are the other community names in the same
// county (used for "nearby communities"). `opts.isCounty` flips to a county page.
export function generateNvCity({ name, county, region }, siblings = [], opts = {}) {
  const r = NV_REGIONS[region]
  const isCounty = !!opts.isCounty
  const slug = isCounty ? nvCountySlug(county) : nvCitySlug(name)
  const h = hash(slug)
  const base = { name, county, slug }

  const tagHighlights = r.tags.flatMap((t) => HIGHLIGHTS[t] ?? [])
  const pool = [...new Set([...tagHighlights, ...HIGHLIGHTS_GENERIC])]
  const highlights = []
  for (let i = 0; highlights.length < 4 && i < pool.length * 2; i++) {
    const cand = pool[(h + i) % pool.length]
    if (!highlights.includes(cand)) highlights.push(cand)
  }

  const faqs = [pick(FAQ_GENERIC, h)(base), pick(FAQ_GENERIC, h + 1)(base)]
  r.tags.filter((t) => FAQ_BY_TAG[t]).slice(0, 2).forEach((t) => {
    if (faqs.length < 4) faqs.push(FAQ_BY_TAG[t](base))
  })
  if (faqs.length < 4) faqs.push(FAQ_GENERIC[3](base))

  const nearbyAreas = siblings.filter((s) => s !== name).slice(0, 6)

  // Real permit office + adopted design loads for this jurisdiction. City pages
  // resolve to their own building department where one exists; otherwise (and for
  // county pages) the county building department, which permits unincorporated land.
  const permit = nvPermitFor(name, county)
  const permitOffice = permit?.office || `${county} Building & Safety Department`

  // The permit-notes copy: route readers to the right office, and when the
  // jurisdiction carries a real snow load, flag that elevation drives it.
  const elevationLine = permit?.snowNote ? ` ${permit.snowNote}` : ''
  const permitNotes =
    `In ${county}, a detached accessory structure over roughly 200 square feet or above a set height generally ` +
    `requires a building permit. Projects inside ${name} city limits go through the city building department, while ` +
    `properties in unincorporated ${county} are handled by the county. We give you all the documentation we can, ` +
    `including the engineer-stamped drawings. You grab the permit application form from your building department, ` +
    `fill it out, and submit it with our paperwork. Approval usually runs four to eight weeks depending on the jurisdiction.` +
    elevationLine

  return {
    slug,
    name,
    stateCode: 'NV',
    county,
    region: r.label,
    climate: r.climate,
    permitOffice,
    permitUrl: permit?.url || null,
    permitNotes,
    // Adopted structural design-load criteria (for the Design Loads panel).
    designWindMph: permit?.windMph ?? null,
    windExposure: permit?.exposure ?? null,
    specialWind: permit?.specialWind ?? false,
    designSnowPsf: permit?.snowPsf ?? null,
    snowNote: permit?.snowNote ?? null,
    snowCaseStudy: permit?.caseStudy ?? false,
    codeRef: permit?.codeRef ?? null,
    loadDisclaimer: LOAD_DISCLAIMER,
    asceHazardToolUrl: ASCE_HAZARD_TOOL,
    introText: isCounty
      ? COUNTY_INTRO(base, r.short, r.label)
      : pick(INTROS, h)(base, r.short, r.label),
    highlights,
    nearbyAreas,
    faqs,
  }
}
