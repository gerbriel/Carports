// ─────────────────────────────────────────────────────────────────────────────
// California permitting offices + representative structural design loads.
//
// For every CA county we store the building/permit department (name + official
// URL) and the TYPICAL design criteria a permit is checked against:
//   • wind , design wind speed (ASCE 7 Vult, mph, Risk Category II)
//   • snow , ground snow load (Pg, PSF) at the county's typical incorporated-city
//             elevation. Snow is ELEVATION-DRIVEN, so each entry carries a
//             `snowNote` explaining how it climbs with elevation, and mountain
//             towns get their own override in CITY_PERMITS (different elevation
//             AND, often, their own building department).
//
// These values are representative for guidance, the exact design loads for a
// specific parcel come from the ASCE 7 Hazard Tool (HAZARD_TOOL_URL) and the
// local building department, which is why every page also links out to both.
//
// URLs verified against official county/city government sites (June 2026).
// ─────────────────────────────────────────────────────────────────────────────

import { citySlug } from './caGeo'

// Authoritative per-coordinate wind/snow/seismic lookup (free, official ASCE/SEI).
export const HAZARD_TOOL_URL = 'https://ascehazardtool.org/'

// Representative California ground snow load vs. elevation (Sierra/Cascade band),
// used to explain how snow load scales for a county's higher-elevation parcels.
export const ELEVATION_SNOW = [
  { band: 'Below 3,000 ft', pg: '0 PSF' },
  { band: '3,000 to 4,000 ft', pg: '~30 to 50 PSF' },
  { band: '4,000 to 5,000 ft', pg: '~60 to 100 PSF' },
  { band: '5,000 to 6,000 ft', pg: '~100 to 150 PSF' },
  { band: '6,000 to 7,000 ft', pg: '~150 to 200 PSF' },
  { band: 'Above 7,000 ft', pg: '200+ PSF' },
]

// Reusable snow notes.
const SNOW_NONE = 'At these low elevations the ground snow load is essentially 0 PSF, this is not a snow-load region. Foothill or mountain parcels in the county rise with elevation (see the elevation guide).'
const SNOW_FOOTHILL = 'Valley-floor sites carry no design snow load, but foothill and mountain parcels in the county climb quickly with elevation, confirm your parcel\'s ground snow load with the building department or the ASCE Hazard Tool.'

// county name (matches caGeo COUNTIES keys) → permit office + design loads.
export const COUNTY_PERMITS = {
  // ── San Francisco Bay Area ──────────────────────────────────────────────
  'Alameda County': { office: 'Alameda County Public Works, Building Inspection', url: 'https://www.acpwa.org/permits/building-inspections/index.page', wind: 100, snow: 0, snowNote: SNOW_NONE },
  'Contra Costa County': { office: 'Contra Costa County Building & Planning', url: 'https://www.contracosta.ca.gov/7228/Building-Planning', wind: 100, snow: 0, snowNote: SNOW_NONE },
  'Marin County': { office: 'Marin County Community Development Agency', url: 'https://www.marincounty.gov/departments/cda', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Exposed coastal ridgelines and Pacific bluffs are higher, verify exposure category.' },
  'San Francisco County': { office: 'San Francisco Department of Building Inspection', url: 'https://www.sf.gov/departments/department-building-inspection', wind: 105, snow: 0, snowNote: SNOW_NONE },
  'San Mateo County': { office: 'San Mateo County Building Division', url: 'https://www.smcgov.org/planning/building', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Coastal sites (Half Moon Bay, Pacifica) fall in Exposure D, higher effective wind load.' },
  'Santa Clara County': { office: 'Santa Clara County Building Division', url: 'https://plandev.santaclaracounty.gov/services/development-services/building', wind: 100, snow: 0, snowNote: SNOW_NONE },

  // ── North Coast ─────────────────────────────────────────────────────────
  'Del Norte County': { office: 'Del Norte County Community Development Dept.', url: 'https://www.co.del-norte.ca.us/', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Exposed North Coast, strong onshore winds; verify exposure category.' },
  'Humboldt County': { office: 'Humboldt County Building Inspection', url: 'https://humboldtgov.org/153/Building-Inspection', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Coastal Exposure D and exposed headlands raise effective wind load.' },
  'Lake County': { office: 'Lake County Community Development Dept.', url: 'https://www.lakecountyca.gov/', wind: 95, snow: 0, snowNote: SNOW_FOOTHILL },
  'Mendocino County': { office: 'Mendocino County Building Division', url: 'https://www.mendocinocounty.gov/departments/planning-building-services/building-division', wind: 105, snow: 0, snowNote: SNOW_FOOTHILL, windNote: 'Coastal sites (Fort Bragg, Point Arena) see strong onshore wind.' },

  // ── Shasta Cascade & Far North ──────────────────────────────────────────
  'Lassen County': { office: 'Lassen County Planning & Building Services', url: 'https://www.lassencounty.org/dept/planning-and-building-services/planning-and-building-services', wind: 105, snow: 60, snowNote: 'Susanville sits near 4,200 ft, design ground snow load runs on the order of 60 PSF and climbs higher in the surrounding mountains.' },
  'Modoc County': { office: 'Modoc County Building Department', url: 'https://www.co.modoc.ca.us/', wind: 105, snow: 50, snowNote: 'Alturas (~4,400 ft) carries roughly 50 PSF ground snow; higher terrain rises further.' },
  'Plumas County': { office: 'Plumas County Building Department', url: 'https://www.plumascounty.us/77/Building-Department', wind: 105, snow: 80, snowNote: 'Portola (~4,900 ft) is a heavy-snow area, on the order of 80 PSF, and surrounding Sierra parcels climb above 100 PSF.' },
  'Shasta County': { office: 'Shasta County Building Division', url: 'https://www.shastacounty.gov/building', wind: 100, snow: 0, snowNote: 'Redding and the valley floor carry no design snow load, but the surrounding mountains rise sharply, sites toward Mount Lassen and the Trinity Alps can exceed 100 PSF.' },
  'Siskiyou County': { office: 'Siskiyou County Building Division', url: 'https://www.siskiyoucounty.gov/building', wind: 105, snow: 40, snowNote: 'Yreka and the lower valleys run around 40 PSF; the Mount Shasta corridor and higher elevations climb well above 60 PSF.' },
  'Tehama County': { office: 'Tehama County Building & Safety', url: 'https://www.co.tehama.ca.us/', wind: 100, snow: 0, snowNote: SNOW_FOOTHILL },
  'Trinity County': { office: 'Trinity County Building Department', url: 'https://www.trinitycounty.org/', wind: 105, snow: 30, snowNote: 'Weaverville (~2,050 ft) is light, but most of the county is mountainous and snow load climbs quickly with elevation.' },

  // ── Sacramento Valley ───────────────────────────────────────────────────
  'Butte County': { office: 'Butte County Development Services', url: 'https://www.buttecounty.net/', wind: 100, snow: 0, snowNote: 'The valley cities (Chico, Oroville) carry no snow load; foothill communities such as Paradise (~1,800 ft) and higher rise with elevation.' },
  'Colusa County': { office: 'Colusa County Planning & Building', url: 'https://www.countyofcolusa.org/', wind: 95, snow: 0, snowNote: SNOW_NONE },
  'Glenn County': { office: 'Glenn County Planning & Community Development', url: 'https://www.countyofglenn.net/', wind: 95, snow: 0, snowNote: SNOW_NONE },
  'Sacramento County': { office: 'Sacramento County Building Permits & Inspection', url: 'https://development.saccounty.gov/content/cd/us/en/building-permits-inspection.html', wind: 95, snow: 0, snowNote: SNOW_NONE },
  'Solano County': { office: 'Solano County Building & Safety Services', url: 'https://www.solanocounty.gov/government/resource-management/building-safety-services', wind: 100, snow: 0, snowNote: SNOW_NONE, windNote: 'Suisun and the Delta corridor channel strong winds off the bay.' },
  'Sutter County': { office: 'Sutter County Building Services', url: 'https://www.sutter.gov/government/county-departments/development-services/building-services', wind: 95, snow: 0, snowNote: SNOW_NONE },
  'Yolo County': { office: 'Yolo County Building Inspection Services', url: 'https://www.yolocounty.gov/government/general-government-departments/community-services/building-inspection-services', wind: 95, snow: 0, snowNote: SNOW_NONE },
  'Yuba County': { office: 'Yuba County Building Department', url: 'https://www.yuba.gov/departments/community_development/building_department/index.php', wind: 95, snow: 0, snowNote: SNOW_FOOTHILL },

  // ── Sierra Nevada & Gold Country ────────────────────────────────────────
  'Alpine County': { office: 'Alpine County Community Development', url: 'https://www.alpinecountyca.gov/', wind: 110, snow: 150, snowNote: 'Alpine County is entirely high Sierra, Markleeville (~5,500 ft) and above carry very heavy ground snow loads (150 PSF and up). Every structure needs site-specific snow engineering.' },
  'Amador County': { office: 'Amador County Building Department', url: 'https://www.amadorcounty.gov/departments/building', wind: 100, snow: 10, snowNote: 'The lower Gold Country towns (Jackson, Ione, Sutter Creek) are light (~10 PSF or less); higher elevations toward the Sierra crest rise sharply.' },
  'Calaveras County': { office: 'Calaveras County Building Department', url: 'https://building.calaverasgov.us/', wind: 105, snow: 10, snowNote: 'Angels Camp (~1,400 ft) is light, but upper-county communities (Arnold, Bear Valley) climb past 100 PSF with elevation.' },
  'El Dorado County': { office: 'El Dorado County Building Division', url: 'https://www.eldoradocounty.ca.gov/Land-Use/Planning-and-Building/Building-Division', wind: 105, snow: 20, snowNote: 'Placerville (~1,860 ft) runs around 20 PSF, but the Sierra and Lake Tahoe parcels rise dramatically, South Shore sites reach 150 to 300+ PSF. El Dorado County publishes a parcel-specific design-criteria lookup.' },
  'Inyo County': { office: 'Inyo County Building & Safety', url: 'https://www.inyocounty.us/services/public-works/building-and-safety', wind: 110, snow: 20, snowNote: 'Bishop and the Owens Valley floor are dry and light (~20 PSF), but eastern-Sierra parcels at elevation carry much heavier loads.', windNote: 'Owens Valley sees strong, sustained down-valley winds.' },
  'Mariposa County': { office: 'Mariposa County Building Department', url: 'https://www.mariposacounty.org/', wind: 105, snow: 20, snowNote: 'The town of Mariposa (~2,000 ft) is light; Yosemite-gateway elevations climb steeply.' },
  'Mono County': { office: 'Mono County Building Division', url: 'https://monocounty.ca.gov/building', wind: 115, snow: 100, snowNote: 'Mono County is high eastern Sierra, design ground snow loads start around 100 PSF and rise well beyond it with elevation. (The Town of Mammoth Lakes runs its own building department.)', windNote: 'Exposed eastern-Sierra terrain sees very high design wind speeds.' },
  'Nevada County': { office: 'Nevada County Building Department', url: 'https://www.nevadacountyca.gov/1114/Building-Department', wind: 105, snow: 40, snowNote: 'Grass Valley / Nevada City (~2,500 ft) run around 40 PSF; the Truckee/Donner area (which runs its own building department) is far heavier at 150+ PSF.' },
  'Placer County': { office: 'Placer County Building Services', url: 'https://www.placer.ca.gov/2128/Building-Services', wind: 105, snow: 0, snowNote: 'The valley cities (Roseville, Rocklin, Lincoln) carry no snow load; foothill Colfax (~2,400 ft) is modest, while Tahoe-basin parcels reach 150 to 300+ PSF.' },
  'Sierra County': { office: 'Sierra County Planning & Building', url: 'https://www.sierracounty.ca.gov/', wind: 110, snow: 70, snowNote: 'Loyalton (~4,950 ft) carries roughly 70 PSF; higher county terrain rises further.' },
  'Tuolumne County': { office: 'Tuolumne County Building Division', url: 'https://www.tuolumnecounty.ca.gov/171/Building-Division', wind: 105, snow: 20, snowNote: 'Sonora (~1,825 ft) is light (~20 PSF); upper-county communities (Twain Harte, Pinecrest) climb sharply with elevation.' },

  // ── Napa & Sonoma Wine Country ──────────────────────────────────────────
  'Napa County': { office: 'Napa County Building Division', url: 'https://www.napacounty.gov/3492/Building-Division', wind: 100, snow: 0, snowNote: SNOW_NONE },
  'Sonoma County': { office: 'Permit Sonoma (Sonoma County)', url: 'https://permitsonoma.org/', wind: 100, snow: 0, snowNote: SNOW_NONE },

  // ── Central Coast ───────────────────────────────────────────────────────
  'Monterey County': { office: 'Monterey County Building Services', url: 'https://www.countyofmonterey.gov/government/departments-a-h/housing-community-development/development-services/building-services', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Coastal Exposure D along the Monterey Bay coastline.' },
  'San Benito County': { office: 'San Benito County Building & Planning', url: 'https://www.sanbenitocountyca.gov/departments/resource-management-agency/building-planning', wind: 100, snow: 0, snowNote: SNOW_NONE },
  'San Luis Obispo County': { office: 'San Luis Obispo County Planning & Building', url: 'https://www.slocounty.ca.gov/departments/planning-building', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Open coastal sites (Morro Bay, the Nipomo Mesa) fall in Exposure D.' },
  'Santa Barbara County': { office: 'Santa Barbara County Building & Safety', url: 'https://www.countyofsb.org/522/Building-Safety-Division', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Gaviota/Point Conception coast and the mountain passes are higher-wind areas.' },
  'Santa Cruz County': { office: 'Santa Cruz County Building & Safety', url: 'https://cdi.santacruzcountyca.gov/UPC/BuildingPermitsSafety.aspx', wind: 105, snow: 0, snowNote: SNOW_NONE, windNote: 'Coastal Exposure D; Santa Cruz Mountains ridgelines are higher.' },
  'Ventura County': { office: 'Ventura County Building & Safety', url: 'https://rma.venturacounty.gov/divisions/building-and-safety/', wind: 100, snow: 0, snowNote: SNOW_NONE, windNote: 'Santa Ana wind events funnel through the canyons and passes.' },

  // ── San Joaquin Valley ──────────────────────────────────────────────────
  'Fresno County': { office: 'Fresno County Building & Safety', url: 'https://www.fresnocountyca.gov/Departments/Public-Works-and-Planning/divisions-of-public-works-and-planning/development-services-division/building-safety', wind: 100, snow: 0, snowNote: 'The valley floor carries no snow load; eastern-county Sierra foothills (Shaver Lake, Huntington Lake) climb steeply with elevation.' },
  'Kern County': { office: 'Kern County Planning & Natural Resources Dept.', url: 'https://kernplanning.com/', wind: 110, snow: 0, snowNote: 'The valley floor carries no snow load; Tehachapi (~4,000 ft) and the mountain communities rise with elevation.', windNote: 'The Tehachapi Pass wind corridor is a special wind region, exposed sites are engineered well above the baseline.' },
  'Kings County': { office: 'Kings County Community Development Agency', url: 'https://www.countyofkingsca.gov/departments/community-development-agency', wind: 100, snow: 0, snowNote: SNOW_NONE },
  'Madera County': { office: 'Madera County Building Division', url: 'https://www.maderacounty.com/government/community-economic-development-department/divisions/building-division', wind: 100, snow: 0, snowNote: 'Lower Madera County (Madera, Chowchilla) carries no snow load; foothill communities (Oakhurst, Coarsegold, Bass Lake) above ~2,000 ft pick up real snow load.' },
  'Merced County': { office: 'Merced County Building & Safety', url: 'https://www.countyofmerced.com/639/Building-Safety', wind: 100, snow: 0, snowNote: SNOW_NONE },
  'San Joaquin County': { office: 'San Joaquin County Community Development Dept.', url: 'https://www.sjgov.org/', wind: 100, snow: 0, snowNote: SNOW_NONE, windNote: 'Delta and Altamont corridor sites see strong, sustained winds.' },
  'Stanislaus County': { office: 'Stanislaus County Building Permits Division', url: 'https://www.stancounty.com/planning/bp/', wind: 100, snow: 0, snowNote: SNOW_NONE },
  'Tulare County': { office: 'Tulare County Resource Management Agency', url: 'https://tularecounty.ca.gov/rma', wind: 100, snow: 0, snowNote: 'The valley floor carries no snow load; Sierra foothill and mountain parcels (Three Rivers, Sequoia gateway) climb sharply with elevation.' },

  // ── Greater Los Angeles ─────────────────────────────────────────────────
  'Los Angeles County': { office: 'L.A. County Public Works, Building & Safety', url: 'https://pw.lacounty.gov/building-and-safety/permits/', wind: 100, snow: 0, snowNote: 'The basin and high desert (Lancaster, Palmdale) carry no snow load; the San Gabriel Mountains and communities like Wrightwood rise above 50 PSF.', windNote: 'The Antelope Valley high desert and foothill Santa Ana canyon corridors are special wind regions.' },

  // ── Orange County ───────────────────────────────────────────────────────
  'Orange County': { office: 'OC Development Services, Building & Safety', url: 'https://pwds.oc.gov/service-areas/oc-development-services/building-safety', wind: 100, snow: 0, snowNote: SNOW_NONE, windNote: 'Santa Ana winds funnel through the inland canyons (Santiago, Silverado).' },

  // ── Inland Empire ───────────────────────────────────────────────────────
  'Riverside County': { office: 'Riverside County Building & Safety', url: 'https://building.rctlma.org/', wind: 110, snow: 0, snowNote: 'The valleys and deserts carry no snow load; the San Jacinto Mountains (Idyllwild, ~5,400 ft) climb past 100 PSF.', windNote: 'The San Gorgonio / Banning Pass is one of the windiest corridors in the U.S., a special wind region with site-specific design.' },
  'San Bernardino County': { office: 'San Bernardino County Land Use Services', url: 'https://lus.sbcounty.gov/', wind: 110, snow: 0, snowNote: 'The valley and desert floors carry no snow load; the San Bernardino Mountains (Lake Arrowhead, Crestline, Running Springs) reach 100+ PSF, and Big Bear Lake runs its own building department.', windNote: 'Cajon Pass and the Mojave high desert are special wind regions.' },

  // ── San Diego County ────────────────────────────────────────────────────
  'San Diego County': { office: 'San Diego County Building Division (PDS)', url: 'https://www.sandiegocounty.gov/content/sdc/pds/bldg.html', wind: 100, snow: 0, snowNote: 'The coast and inland valleys carry no snow load; the East County mountains (Julian, Mount Laguna, ~4,000 to 6,000 ft) pick up a real snow load.', windNote: 'East County mountain passes and Santa Ana corridors see higher winds.' },

  // ── Imperial Valley & Desert ────────────────────────────────────────────
  'Imperial County': { office: 'Imperial County Planning & Development Services', url: 'https://www.icpds.com/', wind: 105, snow: 0, snowNote: 'Low-desert farm country, no design snow load.', windNote: 'Open desert with blowing sand/dust; verify exposure category for unobstructed sites.' },
}

// City-level overrides, mountain towns whose own elevation (and frequently their
// own building department) differ materially from the county. Slug = citySlug(name).
// Fields omitted here fall back to the county entry.
export const CITY_PERMITS = {
  'truckee-ca': {
    office: 'Town of Truckee Building Division',
    url: 'https://www.townoftruckee.gov/200/Snow-Load-Design',
    wind: 105, snow: 150,
    snowNote: 'Truckee is an all-snow jurisdiction. Design ground snow load runs ~150 PSF below 6,000 ft, ~175 PSF from 6,000 to 7,000 ft, and 200+ PSF above 7,000 ft, every structure needs site-specific snow engineering from the Town.',
  },
  'south-lake-tahoe-ca': {
    office: 'City of South Lake Tahoe Building Division',
    url: 'https://www.cityofslt.us/',
    wind: 105, snow: 150,
    snowNote: 'South Lake Tahoe (~6,200 ft) is engineered for roughly 150 PSF ground snow load; surrounding El Dorado County parcels at higher elevations reach 200 to 300 PSF.',
  },
  'mammoth-lakes-ca': {
    office: 'Town of Mammoth Lakes Building Division',
    url: 'https://www.townofmammothlakes.ca.gov/',
    wind: 110, snow: 250,
    snowNote: 'Mammoth Lakes (~7,900 ft, Climate Zone 16) is one of California\'s heaviest snow areas, design ground snow load is roughly 250 PSF and ranges higher by zone. The Town requires site-specific snow engineering.',
  },
  'big-bear-lake-ca': {
    office: 'City of Big Bear Lake Building & Safety',
    url: 'https://bigbearlake.gov/',
    wind: 110, snow: 100,
    snowNote: 'Big Bear Lake (~6,750 ft) carries a heavy mountain snow load, on the order of 100 PSF ground snow, and recent code updates have increased mountain snow-load requirements. Confirm the exact value with the City.',
  },
  'mount-shasta-ca': {
    office: 'City of Mount Shasta Building Department',
    url: 'https://www.mtshastaca.gov/building-department',
    wind: 105, snow: 60,
    snowNote: 'Mount Shasta (~3,600 ft) sits in a heavy-snow band, design ground snow load is on the order of 60 PSF and climbs with elevation on the mountain.',
  },
  // Heavy-snow towns that the county building department still serves (snow only).
  'weed-ca': { snow: 50, snowNote: 'Weed (~3,500 ft) is a snow town, design ground snow load is on the order of 50 PSF.' },
  'dunsmuir-ca': { snow: 40, snowNote: 'Dunsmuir (~2,300 ft) picks up real snow, roughly 40 PSF, and more with elevation up the canyon.' },
  // Featured cities that run their own building department (office/URL only;
  // wind/snow inherit the county).
  'clovis-ca': { office: 'City of Clovis Planning & Development Services', url: 'https://www.cityofclovis.com/' },
  'tulare-ca': { office: 'City of Tulare Building Division', url: 'https://www.tulare.ca.gov/' },
}

// Resolve the permit office + design loads for a city. City override wins over
// the county; county is always returned too (for the "unincorporated" note).
export function getPermitInfo({ name, county }) {
  const slug = citySlug(name)
  const c = COUNTY_PERMITS[county] || {}
  const cityOv = CITY_PERMITS[slug] || {}
  return {
    permitOffice: cityOv.office ?? c.office ?? `${county} Building Department`,
    permitUrl: cityOv.url ?? c.url ?? null,
    isCityOffice: !!cityOv.office,
    countyOffice: c.office ?? `${county} Building Department`,
    countyUrl: c.url ?? null,
    windSpeed: cityOv.wind ?? c.wind ?? null,
    windNote: cityOv.windNote ?? c.windNote ?? null,
    groundSnow: cityOv.snow ?? c.snow ?? 0,
    snowNote: cityOv.snowNote ?? c.snowNote ?? null,
    hazardToolUrl: HAZARD_TOOL_URL,
  }
}

// Suggest a ground snow load (PSF) from a site elevation in FEET, used by the
// builder when an address (with elevation) is known, so the user can apply it.
export function suggestSnowFromElevation(feet) {
  if (feet == null || !Number.isFinite(feet)) return null
  if (feet < 3000) return 0
  if (feet < 4000) return 30
  if (feet < 5000) return 50
  if (feet < 6000) return 100
  if (feet < 7000) return 150
  return 200
}
