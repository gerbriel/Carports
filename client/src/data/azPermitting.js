// ─────────────────────────────────────────────────────────────────────────────
// Real Arizona permitting authorities + structural design criteria.
//
// Arizona has NO statewide building code: each county and city adopts its own
// version of the IBC/IRC and publishes its own "climatic and geographic design
// criteria", a design wind speed and, critically, a GROUND SNOW LOAD that climbs
// with elevation. The high country (Coconino, Apache, Navajo, Gila, Yavapai) can
// jump from a few psf in a valley to 50 to 75+ psf a few thousand feet up, while the
// desert counties (Maricopa, Pima, Pinal, Yuma, La Paz, lower Mohave) carry 0 psf.
//
// Wind speeds and snow bands are taken from each jurisdiction's published design-
// criteria sheet (see the office links). Where a county publishes a continuous
// snow map/study rather than bands (Coconino, Gila, Apache), per-city values are
// anchored on the published figures (e.g. Flagstaff's 50 psf minimum, Payson's
// 48 psf) and scale with elevation. Everything here is design GUIDANCE for these
// landing pages; the exact load for any parcel is confirmed on the stamped drawings.
// ─────────────────────────────────────────────────────────────────────────────

const ASCE_HAZARD_TOOL = 'https://ascehazardtool.org/'
const LOAD_DISCLAIMER =
  "Published jurisdiction design values, your engineer-stamped drawings confirm the exact wind and snow loads for your specific parcel."

// ── County permitting authority + design criteria ────────────────────────────
// snow models:
//   { flat: n }            → same ground snow load everywhere in the county
//   { bands: [...], ... }   → ground snow load set by elevation band [{from?,to?,psf}] (ft)
//   { elevationDriven }     → continuous map/study; per-city values come from AZ_CITY_LOADS
export const AZ_COUNTY_PERMITTING = {
  'Apache County': {
    office: 'Apache County Community Development',
    url: 'https://www.apachecountyaz.gov/Community-Development',
    windMph: 90, windBasis: '3-second gust', exposure: 'C',
    snow: { elevationDriven: true, countyPsf: 30 },
    snowSummary:
      "Strongly elevation-driven: modest around St. Johns (~5,700 ft) and very heavy up in the White Mountains, where Springerville to Eagar (~7,000 ft) and Alpine and Greer (~8,000+ ft) need a site-specific snow study, often 40 to 60+ psf.",
    seismic: 'B',
  },
  'Cochise County': {
    office: 'Cochise County Building Safety Division',
    url: 'https://www.cochise.az.gov/211/Building-Safety',
    windMph: 90, windBasis: '3-second gust', exposure: 'C',
    snow: { flat: 5 },
    snowSummary:
      'Light high-desert snow, roughly 5 psf around Sierra Vista and the valley floors (~4,600 ft), a little more in the higher country near Bisbee (~5,500 ft).',
    seismic: 'B',
  },
  'Coconino County': {
    office: 'Coconino County Community Development, Building & Safety',
    url: 'https://www.coconino.az.gov/624/Building-and-Safety',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    // Anchored on Flagstaff's 50 psf minimum (to 7,100 ft) and the county's 75 psf
    // ceiling near 8,000 ft; site-specific snow study required above 8,000 ft.
    snow: {
      bands: [
        { to: 5000, psf: 10 },
        { from: 5000, to: 6000, psf: 30 },
        { from: 6000, to: 7100, psf: 50 },
        { from: 7100, to: 8000, psf: 60 },
      ],
      aboveNote: 'a site-specific snow study above ~8,000 ft (up to ~75 psf)',
      countyPsf: 50,
    },
    snowSummary:
      'Climbs steeply with elevation, roughly 50 to 60 psf around Flagstaff (~7,000 ft) and up to 75 psf near 8,000 ft, above which a site-specific snow study is required. Frost depth 30″.',
    seismic: 'C',
  },
  'Gila County': {
    office: 'Gila County Community Development, Building Safety',
    url: 'https://www.gilacountyaz.gov/government/community_development/building_safety/',
    windMph: 90, windBasis: '3-second gust', exposure: 'C',
    snow: { elevationDriven: true, countyPsf: 30 },
    snowSummary:
      'Tied to elevation, about 48 psf up on the Mogollon Rim around Payson and Pine/Strawberry (~5,000 to 6,000 ft), dropping to only a few psf in the lower Globe to Miami country (~3,500 ft).',
    seismic: 'B',
  },
  'Graham County': {
    office: 'Graham County Building & Planning',
    url: 'https://www.graham.az.gov/277/Planning-Zoning',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    snow: { flat: 0 },
    snowSummary:
      'No design snow load on the Gila Valley floor around Safford and Thatcher (~2,900 ft); only the Pinaleño/Mt. Graham high country carries a snow load.',
    seismic: 'B',
  },
  'Greenlee County': {
    office: 'Greenlee County Planning & Zoning',
    url: 'https://www.co.greenlee.az.us/',
    windMph: 90, windBasis: '3-second gust', exposure: 'C',
    snow: { flat: 5 },
    snowSummary:
      'Light, near 0 to 5 psf around Clifton and Duncan (~3,500 ft), rising toward the higher Morenci benches (~4,800 ft).',
    seismic: 'B',
  },
  'La Paz County': {
    office: 'La Paz County Community Development',
    url: 'https://www.co.la-paz.az.us/156/Community-Development',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    snow: { flat: 0 },
    snowSummary: 'No design snow load anywhere in this low-desert, Colorado River county.',
    seismic: 'B',
  },
  'Maricopa County': {
    office: 'Maricopa County Planning & Development',
    url: 'https://www.maricopa.gov/797/Planning-Development',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    snow: { flat: 0 },
    snowSummary: 'No design snow load, the Sonoran Desert floor of the Valley of the Sun sees no ground snow.',
    seismic: 'B',
  },
  'Mohave County': {
    office: 'Mohave County Development Services, Building Division',
    url: 'https://www.mohave.gov/departments/development-services/building-division/',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    snow: {
      bands: [
        { to: 3000, psf: 0 },
        { from: 3000, to: 4500, psf: 5 },
        { from: 4500, to: 5400, psf: 10 },
      ],
      aboveNote: 'a site-specific snow study above ~5,400 ft',
      countyPsf: 5,
    },
    snowSummary:
      'Zero along the Colorado River (Lake Havasu City, Bullhead City), rising to 5 to 10 psf in the higher country around Kingman.',
    seismic: 'C',
  },
  'Navajo County': {
    office: 'Navajo County Planning & Development Services',
    url: 'https://www.navajocountyaz.gov/289/Building-Information',
    windMph: 90, windBasis: '3-second gust', exposure: 'C',
    snow: {
      bands: [
        { to: 3000, psf: 0 },
        { from: 3000, to: 4500, psf: 5 },
        { from: 4500, to: 5400, psf: 10 },
      ],
      aboveNote: 'a site-specific snow study above ~5,400 ft (commonly 25 to 50+ psf in the high country)',
      countyPsf: 20,
    },
    snowSummary:
      'Low on the high-desert plateau (5 to 10 psf around Winslow and Holbrook) and far heavier in the White Mountains, the Pinetop-Lakeside and Show Low high country (6,400 to 7,200 ft) needs a site-specific snow design.',
    seismic: 'B',
  },
  'Pima County': {
    office: 'Pima County Development Services',
    url: 'https://www.pima.gov/2586/Building',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    snow: { flat: 0 },
    snowSummary:
      'No design snow load at Tucson-valley elevations; only the Mt. Lemmon / Summerhaven high country (~7,500 ft+) carries a site-specific snow load.',
    seismic: 'B',
  },
  'Pinal County': {
    office: 'Pinal County Building Safety',
    url: 'https://www.pinal.gov/189/Building-Safety',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    snow: { flat: 0 },
    snowSummary: 'No design snow load across the low-desert valleys around Casa Grande, Maricopa, and San Tan Valley.',
    seismic: 'B',
  },
  'Santa Cruz County': {
    office: 'Santa Cruz County Building Safety',
    url: 'https://www.santacruzcountyaz.gov/166/Permits-Applications',
    windMph: 90, windBasis: '3-second gust', exposure: 'C',
    snow: { flat: 0 },
    snowSummary:
      'Minimal, near 0 around Nogales and Rio Rico (~3,500 to 3,900 ft), a few psf on the higher grassland near Sonoita and Patagonia.',
    seismic: 'B',
  },
  'Yavapai County': {
    office: 'Yavapai County Development Services',
    url: 'https://www.yavapaiaz.gov/Development-and-Permits',
    windMph: 105, windBasis: '3-second gust', exposure: 'C',
    snow: {
      bands: [
        { from: 3000, to: 5000, psf: 20 },
        { from: 5000, to: 5900, psf: 30 },
        { from: 5900, to: 6200, psf: 40 },
        { from: 6200, to: 6500, psf: 45 },
      ],
      aboveNote: 'a site-specific snow design above ~6,500 ft per ASCE 7',
      countyPsf: 30,
    },
    snowSummary:
      'Set by elevation in the county criteria: ~20 psf in the Verde Valley (3,000 to 5,000 ft), ~30 psf around Prescott (5,000 to 5,900 ft), and 40 to 45 psf on the higher ground above 5,900 ft.',
    seismic: 'B',
  },
  'Yuma County': {
    office: 'Yuma County Development Services',
    url: 'https://www.yumacountyaz.gov/government/development-services',
    windMph: 115, windBasis: 'ultimate', exposure: 'C',
    snow: { flat: 0 },
    snowSummary: 'No design snow load, the hottest, lowest corner of the state carries no ground snow.',
    seismic: 'B',
  },
}

// ── Cities that run their own building department (override the county link) ──
// Slugs are the citySlug() output ("<kebab>-az"). Towns not listed fall back to
// their county authority, correct for unincorporated parcels and small towns.
export const AZ_CITY_OFFICE = {
  'phoenix-az': { office: 'City of Phoenix Planning & Development Department', url: 'https://www.phoenix.gov/pdd' },
  'tucson-az': { office: 'City of Tucson Planning & Development Services', url: 'https://www.tucsonaz.gov/Departments/Planning-Development-Services/Permits' },
  'mesa-az': { office: 'City of Mesa Development Services', url: 'https://www.mesaaz.gov/Business-Development/Development-Services/Building-Permit-Plan-Review' },
  'chandler-az': { office: 'City of Chandler Development Services', url: 'https://www.chandleraz.gov/government/departments/development-services' },
  'scottsdale-az': { office: 'City of Scottsdale Building Division', url: 'https://www.scottsdaleaz.gov/codes' },
  'gilbert-az': { office: 'Town of Gilbert Development Services', url: 'https://www.gilbertaz.gov/departments/development-services/plan-review-inspection/permits-applications' },
  'flagstaff-az': { office: 'City of Flagstaff Building Safety', url: 'https://www.flagstaff.az.gov/494/Building-Safety' },
  'prescott-az': { office: 'City of Prescott Permit Center', url: 'https://prescott-az.gov/permit-center/permit-categories/building-permits/' },
  'yuma-az': { office: 'City of Yuma Building Permits', url: 'https://www.yumaaz.gov/residents/building-permits' },
  'sierra-vista-az': { office: 'City of Sierra Vista Building Permits', url: 'https://www.sierravistaaz.gov/our-city/departments/community-development/building-permits' },
  'maricopa-az': { office: 'City of Maricopa Permit Center', url: 'https://www.maricopa-az.gov/Departments/Development-Services/Permit-Center' },
  'apache-junction-az': { office: 'Apache Junction Building Safety & Inspections', url: 'https://www.apachejunctionaz.gov/622/Permits' },
  'lake-havasu-city-az': { office: 'Lake Havasu City Building Division', url: 'https://www.lhcaz.gov/229/Building-Permits' },
  'bullhead-city-az': { office: 'Bullhead City Development Services', url: 'https://www.bullheadcity.com/government/departments/development-services/building/permit-forms-information' },
}

// ── Per-city load overrides (psf / mph) where a city publishes its own, or where
// a continuous-map county (Gila) is best expressed as anchored per-city values. ──
export const AZ_CITY_LOADS = {
  // City of Flagstaff amends ground snow load to a minimum of 50 psf to 7,100 ft.
  'flagstaff-az': { snowPsf: 50 },
  // City of Prescott design criteria: 30 psf snow, 90 mph (3-sec gust).
  'prescott-az': { snowPsf: 30, windMph: 90, windBasis: '3-second gust' },
  // Gila County, Mogollon Rim belt (~48 psf) vs. lower Globe to Miami country (~5 psf).
  'payson-az': { snowPsf: 48 },
  'star-valley-az': { snowPsf: 48 },
  'pine-az': { snowPsf: 48 },
  'strawberry-az': { snowPsf: 48 },
  'globe-az': { snowPsf: 5 },
  'miami-az': { snowPsf: 5 },
  'claypool-az': { snowPsf: 5 },
  'young-az': { snowPsf: 30 },
}

// ── City elevation (ft), where elevation actually drives the snow load ───────
// Desert cities (Maricopa/Pima/Pinal/Yuma/La Paz and the river floor) are 0 psf
// regardless of elevation, so they are intentionally omitted.
export const AZ_CITY_ELEVATION = {
  // Coconino
  'flagstaff-az': 6910, 'williams-az': 6770, 'page-az': 4300, 'fredonia-az': 4671,
  'tusayan-az': 6612, 'bellemont-az': 7150, 'doney-park-az': 6500, 'munds-park-az': 6510,
  'kachina-village-az': 6800, 'mountainaire-az': 6900, 'grand-canyon-village-az': 6800,
  'parks-az': 6900, 'mormon-lake-az': 7120, 'tuba-city-az': 4936, 'cameron-az': 4200, 'leupp-az': 4727,
  // Navajo
  'show-low-az': 6345, 'snowflake-az': 5640, 'taylor-az': 5596, 'winslow-az': 4880,
  'holbrook-az': 5082, 'pinetop-lakeside-az': 6805, 'whiteriver-az': 5180, 'heber-overgaard-az': 6627,
  'kayenta-az': 5640, 'pinon-az': 6460, 'forest-lakes-az': 7497, 'joseph-city-az': 4900,
  'white-mountain-lake-az': 6200,
  // Apache
  'eagar-az': 7110, 'springerville-az': 6964, 'st-johns-az': 5686, 'chinle-az': 5082,
  'window-rock-az': 6755, 'fort-defiance-az': 6862, 'sanders-az': 5754, 'ganado-az': 6386,
  'many-farms-az': 5304, 'round-rock-az': 5600, 'greer-az': 8356, 'alpine-az': 8012,
  'nutrioso-az': 7480, 'concho-az': 6020, 'vernon-az': 6400,
  // Gila
  'payson-az': 4930, 'globe-az': 3540, 'miami-az': 3409, 'star-valley-az': 5050,
  'pine-az': 5450, 'strawberry-az': 6047, 'young-az': 5163, 'claypool-az': 3530,
  'san-carlos-az': 2630, 'hayden-az': 2070,
  // Yavapai
  'prescott-az': 5367, 'prescott-valley-az': 5100, 'cottonwood-az': 3320, 'sedona-az': 4350,
  'chino-valley-az': 4750, 'camp-verde-az': 3160, 'clarkdale-az': 3545, 'dewey-humboldt-az': 4593,
  'jerome-az': 5066, 'cornville-az': 3500, 'verde-village-az': 3300, 'mayer-az': 4408,
  'black-canyon-city-az': 2030, 'bagdad-az': 4137, 'yarnell-az': 4800, 'congress-az': 3000,
  'paulden-az': 4370, 'cordes-lakes-az': 3770, 'ash-fork-az': 5144, 'seligman-az': 5240,
  'rimrock-az': 3550, 'lake-montezuma-az': 3500, 'village-of-oak-creek-az': 4070,
  // Mohave (higher country only, the river cities are 0 psf)
  'kingman-az': 3333, 'colorado-city-az': 4994, 'golden-valley-az': 3300, 'dolan-springs-az': 3399,
  'meadview-az': 3081, 'chloride-az': 4009,
  // Cochise / Santa Cruz (light snow at elevation)
  'bisbee-az': 5538, 'sierra-vista-az': 4623, 'tombstone-az': 4540, 'willcox-az': 4167,
  'benson-az': 3580, 'huachuca-city-az': 4543, 'whetstone-az': 4400,
  'nogales-az': 3865, 'patagonia-az': 4050, 'sonoita-az': 4868, 'elgin-az': 4680,
}

// Ground snow load (psf) for an elevation given a county's published bands.
// Returns the band psf, 0 below the lowest band, or null above the top band
// (site-specific snow study territory).
function bandPsf(bands, elevationFt) {
  for (const b of bands) {
    const from = b.from ?? 0
    const to = b.to ?? Infinity
    if (elevationFt >= from && elevationFt < to) return b.psf
  }
  const lowest = Math.min(...bands.map((b) => b.from ?? 0))
  return elevationFt < lowest ? 0 : null
}

// Resolve the full permitting + design-load record for a city/town. `opts.isCounty`
// resolves a county-level page (no single elevation), using the county's
// representative ground snow load.
export function getAzPermitInfo(name, county, slug, opts = {}) {
  const isCounty = !!opts.isCounty
  const c = AZ_COUNTY_PERMITTING[county] || {}
  const cityOffice = AZ_CITY_OFFICE[slug]
  const cityLoads = AZ_CITY_LOADS[slug] || {}
  const elevationFt = AZ_CITY_ELEVATION[slug] ?? null

  const permitOffice = cityOffice ? cityOffice.office : c.office || `${county} Building & Safety`
  const permitUrl = cityOffice ? cityOffice.url : c.url || null

  const designWindMph = cityLoads.windMph ?? c.windMph ?? null
  const windBasis = cityLoads.windBasis ?? c.windBasis ?? 'ultimate'
  const windExposure = c.exposure ?? 'C'
  const specialWind = c.specialWind ?? false

  // Ground snow load (psf): city override → flat county value → elevation band.
  // null means "site-specific" (above the published bands, or a continuous-map
  // county with no published figure for this town).
  let designSnowPsf = null
  let aboveBands = false
  if (cityLoads.snowPsf != null) designSnowPsf = cityLoads.snowPsf
  else if (c.snow?.flat != null) designSnowPsf = c.snow.flat
  else if (c.snow?.bands && elevationFt != null) {
    const psf = bandPsf(c.snow.bands, elevationFt)
    if (psf == null) aboveBands = true
    else designSnowPsf = psf
  }
  // County pages have no single elevation, show the county's representative
  // ground snow load (for its populated areas) so the panel isn't blank. City
  // pages keep their banded/elevation-driven value (or "site-specific").
  if (isCounty && designSnowPsf == null && c.snow?.countyPsf != null) {
    designSnowPsf = c.snow.countyPsf
  }

  // Elevation note that makes the elevation → snow-load relationship explicit.
  let snowNote = null
  if (aboveBands && c.snow?.aboveNote) {
    snowNote =
      `${name}${elevationFt != null ? ` (~${elevationFt.toLocaleString()} ft)` : ''} sits above the county's published snow bands, so it requires ${c.snow.aboveNote}. ${c.snowSummary || ''}`.trim()
  } else if (isCounty && c.snowSummary) {
    // County page: figure is representative; the summary spells out the range.
    snowNote = `Representative for the county's main communities, ground snow load is elevation-driven. ${c.snowSummary}`
  } else if (c.snowSummary) {
    snowNote =
      elevationFt != null && designSnowPsf !== 0
        ? `${name} sits at roughly ${elevationFt.toLocaleString()} ft. ${c.snowSummary}`
        : c.snowSummary
  }

  return {
    permitOffice,
    permitUrl,
    isCountyOffice: !cityOffice,
    designWindMph,
    windBasis,
    windExposure,
    specialWind,
    designSnowPsf,
    snowNote,
    seismicCategory: c.seismic || null,
    elevationFt,
    codeRef: c.codeRef || `Per ${county}'s adopted IBC/IRC climatic & geographic design criteria.`,
    loadDisclaimer: LOAD_DISCLAIMER,
    asceHazardToolUrl: ASCE_HAZARD_TOOL,
  }
}
